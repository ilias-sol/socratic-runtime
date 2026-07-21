import { randomUUID } from "node:crypto";
import * as path from "node:path";
import * as vscode from "vscode";
import { attentionLineRange, currentSymbolLine } from "./attention.js";
import { applyAssessmentTransition } from "./assessmentTransition.js";
import {
  autoCheckDelay,
  isCurrentAnalysisContext,
  normalizeAutoCheckDebounce,
  normalizeAutoCheckInterval,
  normalizeAutoPauseAfter,
  shouldReverifyAfterEdit,
  shouldRunAutoCheck,
} from "./autoCheck.js";
import { loadExerciseConfig } from "./config.js";
import {
  configForPreset,
  detectFrameworkPresets,
  type FrameworkPreset,
} from "./frameworkPresets.js";
import { guidanceResult } from "./guidance.js";
import { availableNudgeSupportCount, type HelpAction } from "./helpActions.js";
import {
  event,
  gateModelDecision,
  MAX_SUPPORTS_PER_EPISODE,
  reduceVerification,
} from "./policy.js";
import { compactRevisionDiff, extractTargetCode } from "./packet.js";
import {
  redactedSessionTrace,
  shouldDeleteRetainedSession,
} from "./persistence.js";
import {
  abstractVerificationResult,
  modelVerificationResult,
  verificationEventDetails,
} from "./privacy.js";
import { checkCodexStatus, CodexCliProvider } from "./providers.js";
import {
  assessmentRevisionKey,
  formatVerifierCommand,
  verifierApprovalKey,
} from "./security.js";
import {
  chooseNearestTask,
  classifyTaskBinding,
  findTargetSymbol,
  parseTaskCandidates,
  selectedTask,
  taskMarkerFor,
} from "./taskParser.js";
import type {
  AnalysisMode,
  ExerciseConfig,
  LearningStatePacket,
  ParsedTask,
  PedagogicalModelProvider,
  SessionState,
  TargetSymbol,
} from "./types.js";
import {
  formatTrace,
  SocraticHelpView,
  showPolicyComparison,
  type SetupDoctorCheck,
} from "./ui.js";
import { VerificationRunner } from "./verification.js";

const LIVE_MODEL_TIMEOUT_MS = 30_000;

class SocraticRuntime implements vscode.Disposable {
  private readonly status = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    90,
  );
  private readonly trace = vscode.window.createOutputChannel(
    "Socratic Runtime — Decision Trace",
  );
  private readonly verifier = new VerificationRunner();
  private readonly helpView = new SocraticHelpView();
  private readonly attentionDecoration =
    vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      backgroundColor: new vscode.ThemeColor(
        "editor.findMatchHighlightBackground",
      ),
      borderColor: new vscode.ThemeColor("editorWarning.foreground"),
      borderStyle: "solid",
      borderWidth: "0 0 0 2px",
      overviewRulerColor: new vscode.ThemeColor("editorWarning.foreground"),
      overviewRulerLane: vscode.OverviewRulerLane.Right,
      after: {
        contentText: "  Socratic focus",
        color: new vscode.ThemeColor("editorCodeLens.foreground"),
        fontStyle: "italic",
      },
    });
  private readonly disposables: vscode.Disposable[] = [];
  private state: SessionState | null = null;
  private exercise: ExerciseConfig | null = null;
  private folder: vscode.WorkspaceFolder | null = null;
  private checking = false;
  private autoCheckTimer: ReturnType<typeof setTimeout> | null = null;
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingAutoCheck = false;
  private lastCheckedCode: string | null = null;
  private documentRevision = 0;
  private scheduledRevision = 0;
  private activeAutomaticCheck = false;
  private watcherPaused = false;
  private hintsPaused = false;
  private lastChangedLines: number[] = [];
  private activeModelAbort: AbortController | null = null;
  private supportRequestInFlight = false;
  private sessionLanguage = "unknown";
  private doctorPresets: FrameworkPreset[] = [];
  private doctorContext: {
    folder: vscode.WorkspaceFolder;
    target: TargetSymbol;
    targetFile: string;
  } | null = null;
  private readonly assessedRevisionKeys = new Set<string>();

  constructor(private readonly context: vscode.ExtensionContext) {
    this.status.command = "socraticRuntime.openDecisionTrace";
    this.status.tooltip = "Open the Socratic Runtime decision trace";
    this.status.show();
    this.setStatus("Socratic: Inactive");
    this.disposables.push(
      this.status,
      this.trace,
      this.verifier,
      this.helpView,
      this.attentionDecoration,
      vscode.window.registerWebviewViewProvider(
        SocraticHelpView.viewId,
        this.helpView,
      ),
      this.helpView.onDidAction((action) => this.onHelpAction(action)),
      vscode.workspace.onDidChangeTextDocument((change) =>
        this.onDocumentChanged(change),
      ),
      vscode.languages.onDidChangeDiagnostics(() =>
        this.onDiagnosticsChanged(),
      ),
      vscode.workspace.onDidChangeConfiguration((change) => {
        const retentionChanged = change.affectsConfiguration(
          "socraticRuntime.retainSessions",
        );
        const retainSessions = vscode.workspace
          .getConfiguration("socraticRuntime")
          .get<boolean>("retainSessions", false);
        if (shouldDeleteRetainedSession(retentionChanged, retainSessions))
          void this.context.workspaceState.update("lastSession", undefined);
      }),
    );
  }

  dispose(): void {
    this.cancelModelAssessment();
    this.stopAutoChecks();
    this.clearQuestionCue();
    this.disposables.forEach((disposable) => disposable.dispose());
  }

  private cancelModelAssessment(): void {
    this.activeModelAbort?.abort();
    this.activeModelAbort = null;
  }

  private setStatus(text: string, question?: string): void {
    this.status.text = `$(lightbulb) ${text}`;
    this.status.backgroundColor = question
      ? new vscode.ThemeColor("statusBarItem.warningBackground")
      : undefined;
    this.status.tooltip = question
      ? `Socratic question: ${question}\n\nOpen the decision trace`
      : "Open the Socratic Runtime decision trace";
  }

  private watchingStatus(): string {
    return this.state?.mode === "guidance"
      ? "Socratic: Guidance Only"
      : "Socratic: Watching";
  }

  private showWatchingView(hintsPaused = false): void {
    const supportCount = availableNudgeSupportCount({
      hintsPaused,
      hasFailedAssessment: Boolean(
        this.state?.latestVerification && !this.state.latestVerification.passed,
      ),
      verifiedComplete: this.state?.phase === "verified_complete",
      supportCount: this.state?.episodeSupportCount ?? 0,
      maximumSupports: MAX_SUPPORTS_PER_EPISODE,
    });
    if (this.state?.mode === "guidance")
      this.helpView.showGuidanceOnly(
        "No matching approved verifier is configured for this task.",
        supportCount,
      );
    else this.helpView.showWatching(hintsPaused, supportCount);
  }

  private startAutoChecks(): void {
    this.stopAutoChecks();
    if (
      !this.state ||
      !vscode.workspace
        .getConfiguration("socraticRuntime")
        .get<boolean>("autoCheck", true)
    )
      return;
    this.watcherPaused = false;
    this.pendingAutoCheck = true;
    this.scheduleAutoCheck(true);
    this.resetInactivityTimer();
    void vscode.commands.executeCommand(
      "setContext",
      "socraticRuntime.watching",
      true,
    );
    void vscode.commands.executeCommand(
      "setContext",
      "socraticRuntime.paused",
      false,
    );
  }

  private scheduleAutoCheck(initial = false): void {
    if (
      !this.state ||
      this.state.phase === "verified_complete" ||
      this.watcherPaused
    )
      return;
    if (this.autoCheckTimer) clearTimeout(this.autoCheckTimer);
    const configuration = vscode.workspace.getConfiguration("socraticRuntime");
    const intervalMs = normalizeAutoCheckInterval(
      configuration.get<number>("autoCheckIntervalMs", 5_000),
    );
    const debounceMs = normalizeAutoCheckDebounce(
      configuration.get<number>("autoCheckDebounceMs", 4_000),
    );
    this.scheduledRevision = this.documentRevision;
    const delay = autoCheckDelay(initial, intervalMs, debounceMs);
    this.autoCheckTimer = setTimeout(() => {
      this.autoCheckTimer = null;
      void this.maybeRunAutoCheck(this.scheduledRevision);
    }, delay);
  }

  private stopAutoChecks(): void {
    if (this.autoCheckTimer) clearTimeout(this.autoCheckTimer);
    this.autoCheckTimer = null;
    this.pendingAutoCheck = false;
    this.clearInactivityTimer();
  }

  private clearInactivityTimer(): void {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    this.inactivityTimer = null;
  }

  private resetInactivityTimer(): void {
    this.clearInactivityTimer();
    if (
      !this.state ||
      this.state.phase === "verified_complete" ||
      this.watcherPaused
    )
      return;
    const delay = normalizeAutoPauseAfter(
      vscode.workspace
        .getConfiguration("socraticRuntime")
        .get<number>("autoPauseAfterMs", 600_000),
    );
    if (delay === 0) return;
    this.inactivityTimer = setTimeout(() => {
      this.inactivityTimer = null;
      this.pauseWatchingForInactivity(delay);
    }, delay);
  }

  private pauseWatchingForInactivity(delay: number): void {
    if (
      !this.state ||
      this.state.phase === "verified_complete" ||
      this.watcherPaused
    )
      return;
    this.watcherPaused = true;
    if (this.autoCheckTimer) clearTimeout(this.autoCheckTimer);
    this.autoCheckTimer = null;
    if (this.activeAutomaticCheck) this.verifier.cancel();
    this.appendEvent(
      event(
        "watcher_paused",
        `Automatic watching paused after ${Math.round(delay / 60_000)} minutes without an edit`,
        { inactivityMs: delay, pedagogicalEvidence: false, modelCall: false },
      ),
    );
    this.setStatus("Socratic: Paused (inactive)");
    this.helpView.showWatcherPaused(true, delay);
    void vscode.commands.executeCommand(
      "setContext",
      "socraticRuntime.watching",
      false,
    );
    void vscode.commands.executeCommand(
      "setContext",
      "socraticRuntime.paused",
      true,
    );
  }

  private async maybeRunAutoCheck(scheduledRevision: number): Promise<void> {
    if (!this.state) return;
    const document = await vscode.workspace.openTextDocument(
      vscode.Uri.file(this.state.targetSymbol.file),
    );
    if (
      !shouldRunAutoCheck({
        active: Boolean(this.state && !this.watcherPaused),
        verified: this.state.phase === "verified_complete",
        checking: this.checking,
        pendingRevision: this.pendingAutoCheck,
        currentCode: document.getText(),
        lastCheckedCode: this.lastCheckedCode,
        revision: this.documentRevision,
        scheduledRevision,
      })
    )
      return;
    await this.runCheck({ automatic: true, revision: scheduledRevision });
  }

  private clearQuestionCue(): void {
    for (const editor of vscode.window.visibleTextEditors)
      editor.setDecorations(this.attentionDecoration, []);
  }

  private attentionRange(document: vscode.TextDocument): vscode.Range {
    const diagnosticLines = vscode.languages
      .getDiagnostics(document.uri)
      .filter((item) => item.severity === vscode.DiagnosticSeverity.Error)
      .map((item) => item.range.start.line);
    const lines = Array.from(
      { length: document.lineCount },
      (_, line) => document.lineAt(line).text,
    );
    const targetLine = currentSymbolLine(
      lines,
      this.state?.targetSymbol.name ?? "",
      this.state?.targetSymbol.line ?? 0,
    );
    const focus = attentionLineRange(
      lines,
      targetLine,
      diagnosticLines,
      this.lastChangedLines,
    );
    return new vscode.Range(
      focus.start,
      0,
      focus.end,
      document.lineAt(focus.end).text.length,
    );
  }

  private showQuestionCue(
    question: string,
    document: vscode.TextDocument,
  ): void {
    this.clearQuestionCue();
    const range = this.attentionRange(document);
    for (const editor of vscode.window.visibleTextEditors)
      if (editor.document.uri.fsPath === document.uri.fsPath)
        editor.setDecorations(this.attentionDecoration, [range]);
    this.helpView.showQuestion(
      question,
      this.state?.mode === "guidance"
        ? "GPT-5.6 compared recent revisions and selected this minimal question. Guidance-only mode makes no correctness or completion claim."
        : "GPT-5.6 assessed the recent attempt trajectory and selected this minimal intervention; executable checks remain authoritative.",
      (this.state?.episodeSupportCount ?? 0) < MAX_SUPPORTS_PER_EPISODE,
    );
  }

  private onHelpAction(action: HelpAction): void {
    if (action === "configurePreset") {
      void this.configureDetectedPreset();
      return;
    }
    if (action === "rerunSetupDoctor") {
      void this.runSetupDoctor();
      return;
    }
    if (!this.state) return;
    if (action === "resumeWatching") {
      this.resumeWatching();
      return;
    }
    if (action === "moreHelp") {
      void this.requestMoreHelp();
      return;
    }
    if (action === "showReference") {
      void this.showReferenceSolution();
      return;
    }
    if (action === "dismiss") {
      this.clearQuestionCue();
      this.appendEvent(
        event("hint_dismissed", "Question dismissed by learner"),
      );
      this.setStatus(this.watchingStatus());
      this.showWatchingView(this.hintsPaused);
      return;
    }
    if (action === "investigating") {
      this.appendEvent(
        event(
          "hint_acknowledged",
          "Learner marked the question as under investigation",
        ),
      );
      this.setStatus("Socratic: Investigating");
      return;
    }
    if (action === "pauseHints") {
      this.hintsPaused = true;
      this.clearQuestionCue();
      this.appendEvent(
        event("hints_paused", "Socratic questions paused by learner"),
      );
      this.setStatus("Socratic: Watching · Hints Paused");
      this.helpView.showWatching(true);
      return;
    }
    this.hintsPaused = false;
    this.setStatus(this.watchingStatus());
    if (this.state.mode === "guidance")
      this.helpView.showGuidanceOnly(
        "No matching approved verifier is configured for this task.",
      );
    else this.helpView.showWatching(false);
  }

  private appendEvent(item: ReturnType<typeof event>): void {
    if (!this.state) return;
    this.state.eventHistory.push({
      ...item,
      file: this.state.targetSymbol.file,
      symbol: this.state.targetSymbol.name,
    });
    this.renderTrace();
    void this.persist();
  }

  private renderTrace(): void {
    this.trace.clear();
    if (this.state) this.trace.append(formatTrace(this.state));
  }

  private async persist(): Promise<void> {
    if (!this.state) return;
    const retain = vscode.workspace
      .getConfiguration("socraticRuntime")
      .get<boolean>("retainSessions", false);
    await this.context.workspaceState.update(
      "lastSession",
      retain ? redactedSessionTrace(this.state) : undefined,
    );
  }

  private async resolveTask(
    editor: vscode.TextEditor,
    explicit?: ParsedTask,
  ): Promise<{ task: ParsedTask; target: TargetSymbol } | null> {
    const source = editor.document.getText();
    const task =
      explicit ??
      chooseNearestTask(
        parseTaskCandidates(source),
        editor.selection.active.line,
      );
    if (!task) {
      void vscode.window.showWarningMessage(
        "No valid @socratic-task block was found. Select task text and run ‘Start Session from Selection’.",
      );
      return null;
    }
    const target = findTargetSymbol(
      source,
      task,
      editor.document.uri.fsPath,
      editor.document.languageId,
    );
    if (!target) {
      void vscode.window.showWarningMessage(
        "The task has no detectable function or class below it. Place the task directly above the target symbol.",
      );
      return null;
    }
    return { task, target };
  }

  async startSession(explicit?: ParsedTask): Promise<void> {
    if (this.state) {
      const replace = await vscode.window.showWarningMessage(
        "A Socratic Runtime session is already active.",
        { modal: true },
        "End and Start New",
      );
      if (replace !== "End and Start New") return;
      await this.endSession(false);
    }
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      void vscode.window.showWarningMessage(
        "Open the exercise source file before starting Socratic Runtime.",
      );
      return;
    }
    const folder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
    if (!folder) {
      void vscode.window.showWarningMessage(
        "The exercise file must be inside an open workspace folder.",
      );
      return;
    }
    if (!vscode.workspace.isTrusted) {
      void vscode.window.showWarningMessage(
        "Trust this workspace before Socratic Runtime can run its verifier or send a target revision to Codex.",
      );
      return;
    }
    const resolved = await this.resolveTask(editor, explicit);
    if (!resolved) return;
    let exercise: ExerciseConfig | null = null;
    try {
      exercise = await loadExerciseConfig(folder);
    } catch (error) {
      void vscode.window.showErrorMessage(
        `Trusted exercise configuration is invalid: ${error instanceof Error ? error.message : String(error)}`,
      );
      return;
    }
    const relativeTarget = path
      .relative(folder.uri.fsPath, editor.document.uri.fsPath)
      .replaceAll("\\", "/");
    const mode =
      exercise &&
      exercise.targetFile.replaceAll("\\", "/") === relativeTarget &&
      exercise.targetSymbol === resolved.target.name
        ? "Verified"
        : "Guidance Only";
    if (mode === "Verified" && exercise) {
      const setup = await this.verifier.preflight(folder, exercise);
      if (!setup.ready) {
        const reason = setup.reason ?? "Trusted verification is unavailable.";
        this.setStatus("Socratic: Setup Required");
        this.helpView.showSetupRequired(reason);
        void vscode.window.showErrorMessage(
          `Socratic Runtime setup required: ${reason}`,
        );
        return;
      }
      const approvalKey = verifierApprovalKey(folder.uri.fsPath, exercise);
      if (!this.context.workspaceState.get<boolean>(approvalKey, false)) {
        const approval = await vscode.window.showWarningMessage(
          `This workspace asks Socratic Runtime to run this verifier without a shell:\n\n${formatVerifierCommand(exercise)}\n\nApprove only if you trust this command. Any configuration change requires approval again.`,
          { modal: true },
          "Approve Verifier",
        );
        if (approval !== "Approve Verifier") return;
        await this.context.workspaceState.update(approvalKey, true);
      }
    }
    if (!this.context.workspaceState.get<boolean>("onboardingSeen", false)) {
      const onboarding = await vscode.window.showInformationMessage(
        "Socratic Runtime checks an isolated unsaved snapshot after you pause typing. On a failed revision, it sends only the task, target code/diff, and redacted check evidence to GPT-5.6 through your signed-in Codex CLI. Editing cancels stale analysis; the extension never inserts replacement code.",
        { modal: true },
        "Continue",
      );
      if (onboarding !== "Continue") return;
      await this.context.workspaceState.update("onboardingSeen", true);
    }
    const choice = await vscode.window.showInformationMessage(
      `Socratic Runtime found: “${resolved.task.summary}” · Target: ${resolved.target.name}() · Mode: ${mode}`,
      { modal: true },
      "Start Session",
      "Select Different Task",
    );
    if (choice === "Select Different Task") {
      void vscode.window.showInformationMessage(
        "Select the assignment text, then run ‘Socratic Runtime: Start Session from Selection’. ",
      );
      return;
    }
    if (choice !== "Start Session") return;

    const providerMode = vscode.workspace
      .getConfiguration("socraticRuntime")
      .get<AnalysisMode>("analysisMode", "luna");
    const source = editor.document.getText();
    this.folder = folder;
    this.exercise = exercise;
    this.sessionLanguage = editor.document.languageId;
    this.documentRevision = 0;
    this.scheduledRevision = 0;
    this.hintsPaused = false;
    this.lastChangedLines = [];
    this.assessedRevisionKeys.clear();
    this.state = {
      version: 1,
      sessionId: randomUUID(),
      mode: mode === "Verified" ? "verified" : "guidance",
      providerMode,
      task: resolved.task,
      targetSymbol: resolved.target,
      phase: "observing",
      equivalentFailureCount: 0,
      semanticProgressScore: 0,
      experimentationEvidence: 0,
      alternativeStrategyProbability: 0,
      interventionsShown: 0,
      silentDecisions: 0,
      tutorFileEdits: 0,
      tutorCodeLinesSupplied: 0,
      checkCount: 0,
      modelAssessmentCount: 0,
      lastInterventionCheck: null,
      struggleEpisode: 1,
      episodeHasIntervention: false,
      episodeSupportCount: 0,
      latestVerification: null,
      eventHistory: [],
      lastCode: source,
      lastFailureFingerprint: null,
      observedFailureFingerprints: [],
    };
    this.appendEvent(
      event("session_started", "Session started", {
        mode: this.state.mode,
        provider: providerMode,
      }),
    );
    this.setStatus(
      this.state.mode === "verified"
        ? "Socratic: Watching"
        : "Socratic: Guidance Only",
    );
    if (this.state.mode === "guidance")
      this.helpView.showGuidanceOnly(
        "No matching approved verifier is configured for this task.",
      );
    else this.helpView.showWatching(false);
    void vscode.commands.executeCommand(
      "setContext",
      "socraticRuntime.active",
      true,
    );

    const codexPath = vscode.workspace
      .getConfiguration("socraticRuntime")
      .get<string>("codexPath", "codex");
    const codexStatus = await checkCodexStatus(codexPath);
    if (codexStatus !== "ready") {
      this.setStatus("Socratic: Sign-in Required");
      const action = await vscode.window.showWarningMessage(
        codexStatus === "unavailable"
          ? "The Codex CLI is unavailable. Install or configure it before learner-state analysis can run."
          : "Codex ChatGPT sign-in is required before learner-state analysis can run.",
        "Start Codex Sign-in",
      );
      if (action === "Start Codex Sign-in")
        vscode.window
          .createTerminal({
            name: "Socratic Runtime: Codex Sign-in",
            shellPath: codexPath,
            shellArgs: ["login"],
          })
          .show();
    }
    this.lastCheckedCode = null;
    this.startAutoChecks();
  }

  async useSelectionAsTask(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.selection.isEmpty) {
      void vscode.window.showWarningMessage(
        "Select the assignment text first.",
      );
      return;
    }
    const task = selectedTask(
      editor.document.getText(editor.selection),
      editor.selection.start.line,
    );
    if (task) await this.startSession(task);
  }

  async copySelectionAsTaskMarker(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.selection.isEmpty) {
      void vscode.window.showWarningMessage(
        "Select the assignment text first.",
      );
      return;
    }
    const marker = taskMarkerFor(
      editor.document.languageId,
      editor.document.getText(editor.selection),
    );
    await vscode.env.clipboard.writeText(marker);
    void vscode.window.showInformationMessage(
      "Copied a durable @socratic-task marker. Paste it directly above the function, method, or class you want to practice.",
    );
  }

  async runSetupDoctor(): Promise<void> {
    const checks: SetupDoctorCheck[] = [];
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      checks.push({
        label: "Active source file",
        status: "blocked",
        detail: "Open the file containing the exercise target.",
      });
      this.doctorPresets = [];
      this.doctorContext = null;
      this.helpView.showSetupDoctor(checks, 0);
      await this.openHelp();
      return;
    }
    const folder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
    if (!folder) {
      checks.push({
        label: "Workspace",
        status: "blocked",
        detail: "Open the source file inside a VS Code workspace folder.",
      });
      this.doctorPresets = [];
      this.doctorContext = null;
      this.helpView.showSetupDoctor(checks, 0);
      await this.openHelp();
      return;
    }

    checks.push({
      label: "Workspace trust",
      status: vscode.workspace.isTrusted ? "ready" : "blocked",
      detail: vscode.workspace.isTrusted
        ? "The workspace is trusted."
        : "Trust the workspace before any verifier can run.",
    });
    const codexPath = vscode.workspace
      .getConfiguration("socraticRuntime")
      .get<string>("codexPath", "codex");
    const codexStatus = await checkCodexStatus(codexPath);
    checks.push({
      label: "Codex and ChatGPT sign-in",
      status: codexStatus === "ready" ? "ready" : "blocked",
      detail:
        codexStatus === "ready"
          ? "Codex is available through the existing ChatGPT sign-in."
          : codexStatus === "auth_required"
            ? "Run codex login; no separate Socratic Runtime account or API key is needed."
            : "Install Codex CLI or configure socraticRuntime.codexPath.",
    });

    const source = editor.document.getText();
    const task = chooseNearestTask(
      parseTaskCandidates(source),
      editor.selection.active.line,
    );
    const target = task
      ? findTargetSymbol(
          source,
          task,
          editor.document.uri.fsPath,
          editor.document.languageId,
        )
      : null;
    checks.push({
      label: "Socratic task",
      status: task && target ? "ready" : "blocked",
      detail:
        task && target
          ? `Found “${task.summary}” for ${target.name}().`
          : "Add an @socratic-task marker directly above a detectable target symbol.",
    });

    const targetFile = path
      .relative(folder.uri.fsPath, editor.document.uri.fsPath)
      .replaceAll("\\", "/");
    const presets = target
      ? await detectFrameworkPresets(
          folder.uri.fsPath,
          editor.document.languageId,
        )
      : [];
    let exercise: ExerciseConfig | null = null;
    let configError: string | null = null;
    try {
      exercise = await loadExerciseConfig(folder);
    } catch (error) {
      configError = error instanceof Error ? error.message : String(error);
    }
    const matchesTarget = Boolean(
      exercise &&
        target &&
        exercise.targetFile.replaceAll("\\", "/") === targetFile &&
        exercise.targetSymbol === target.name,
    );
    let verifierReady = false;
    let verifierDetail = "";
    if (configError)
      verifierDetail = `Configuration is invalid: ${configError}`;
    else if (!exercise)
      verifierDetail =
        presets.length > 0
          ? `${presets.map((preset) => preset.label).join(" or ")} detected. Configure a preset to enable verified mode.`
          : "No supported verifier was detected; Guidance-only mode remains available.";
    else if (!matchesTarget)
      verifierDetail =
        "The existing verifier configuration targets a different file or symbol.";
    else {
      const preflight = await this.verifier.preflight(folder, exercise);
      verifierReady = preflight.ready;
      verifierDetail = preflight.ready
        ? `${formatVerifierCommand(exercise)} is ready for explicit approval.`
        : (preflight.reason ?? "The configured verifier is unavailable.");
    }
    checks.push({
      label: "Executable verifier",
      status: verifierReady
        ? "ready"
        : presets.length > 0
          ? "warning"
          : "blocked",
      detail: verifierDetail,
    });

    this.doctorPresets = verifierReady ? [] : presets;
    this.doctorContext = target ? { folder, target, targetFile } : null;
    this.helpView.showSetupDoctor(checks, this.doctorPresets.length);
    await this.openHelp();
  }

  private async configureDetectedPreset(): Promise<void> {
    const context = this.doctorContext;
    if (!context || this.doctorPresets.length === 0) {
      void vscode.window.showInformationMessage(
        "Run Setup Doctor with a supported task and test framework first.",
      );
      return;
    }
    const choice = await vscode.window.showQuickPick(
      this.doctorPresets.map((preset) => ({
        label: preset.label,
        description: preset.detail,
        preset,
      })),
      {
        title: "Choose a trusted verifier preset",
        placeHolder:
          "The exact command will still require approval before it runs",
      },
    );
    if (!choice) return;
    const existing = await loadExerciseConfig(context.folder).catch(() => null);
    if (existing) {
      const overwrite = await vscode.window.showWarningMessage(
        "Replace the existing .socratic/exercise.json configuration?",
        { modal: true },
        "Replace Configuration",
      );
      if (overwrite !== "Replace Configuration") return;
    }
    const config = configForPreset(
      context.folder.uri.fsPath,
      context.targetFile,
      context.target,
      choice.preset,
    );
    const directory = vscode.Uri.joinPath(context.folder.uri, ".socratic");
    await vscode.workspace.fs.createDirectory(directory);
    await vscode.workspace.fs.writeFile(
      vscode.Uri.joinPath(directory, "exercise.json"),
      Buffer.from(`${JSON.stringify(config, null, 2)}\n`, "utf8"),
    );
    void vscode.window.showInformationMessage(
      `${choice.preset.label} configured for disposable-project verification. Start Session will show the exact command for approval.`,
    );
    await this.runSetupDoctor();
  }

  async runCheck(
    options: { automatic?: boolean; revision?: number } = {},
  ): Promise<void> {
    const automatic = options.automatic === true;
    if (!this.state || !this.folder) {
      if (!automatic)
        void vscode.window.showWarningMessage(
          "Start a Socratic Runtime session first.",
        );
      return;
    }
    if (this.checking) {
      if (!automatic)
        void vscode.window.showInformationMessage(
          "A verification check is already running.",
        );
      return;
    }
    this.checking = true;
    const guidanceOnly = this.state.mode === "guidance" || !this.exercise;
    const checkedRevision = options.revision ?? this.documentRevision;
    const checkedSessionId = this.state.sessionId;
    this.activeAutomaticCheck = automatic;
    this.setStatus(
      guidanceOnly
        ? "Socratic: Assessing Guidance Only"
        : automatic
          ? "Socratic: Checking Quietly"
          : "Socratic: Checking",
    );
    this.appendEvent(
      event(
        "check_started",
        guidanceOnly ? "Guidance review started" : "Trusted check started",
        {
          trigger: automatic ? "automatic_revision" : "manual",
          executableVerification: !guidanceOnly,
        },
      ),
    );
    try {
      const document = await vscode.workspace.openTextDocument(
        vscode.Uri.file(this.state.targetSymbol.file),
      );
      const currentCode = document.getText();
      const diagnostics = vscode.languages
        .getDiagnostics(document.uri)
        .filter(
          (item) =>
            item.severity === vscode.DiagnosticSeverity.Error ||
            item.severity === vscode.DiagnosticSeverity.Warning,
        )
        .map((item) => ({
          severity:
            item.severity === vscode.DiagnosticSeverity.Error
              ? ("error" as const)
              : ("warning" as const),
          message: item.message,
        }));
      const result = guidanceOnly
        ? guidanceResult(diagnostics)
        : automatic
          ? await this.verifier.run(this.folder, this.exercise!, currentCode)
          : await vscode.window.withProgress(
              {
                location: vscode.ProgressLocation.Notification,
                title: "Socratic Runtime: running trusted checks",
                cancellable: true,
              },
              async (_progress, token) =>
                await this.verifier.run(
                  this.folder!,
                  this.exercise!,
                  currentCode,
                  token,
                ),
            );
      if (
        result.cancelled ||
        !isCurrentAnalysisContext(
          this.state?.sessionId ?? null,
          checkedSessionId,
          checkedRevision,
          this.documentRevision,
        )
      ) {
        if (this.state?.sessionId === checkedSessionId)
          this.appendEvent(
            event("check_completed", "Stale check discarded", {
              checkedRevision,
              currentRevision: this.documentRevision,
            }),
          );
        return;
      }
      this.lastCheckedCode = currentCode;
      this.state.checkCount += 1;
      this.appendEvent(
        event(
          "check_completed",
          result.summary,
          verificationEventDetails(result),
        ),
      );

      if (result.infrastructureFailure) {
        const reason =
          result.infrastructureReason ?? "Trusted verification is unavailable.";
        this.appendEvent(
          event(
            "setup_check",
            "Verification unavailable; no pedagogical inference made",
            {
              reason,
            },
          ),
        );
        this.setStatus("Socratic: Verification Unavailable");
        this.helpView.showSetupRequired(reason);
        void vscode.window.showErrorMessage(
          `Socratic Runtime verification unavailable: ${reason}`,
        );
        return;
      }

      const prior = this.state.latestVerification;
      const reduced = reduceVerification(this.state, result, currentCode);

      if (result.passed && this.exercise) {
        this.state.latestVerification = result;
        this.state.lastCode = currentCode;
        this.state.phase = "verified_complete";
        this.appendEvent(
          event("verified_completion", "Final decision: verified complete", {
            executableAuthority: this.exercise.verification.type,
            language: this.exercise.language,
            passedChecks: result.passedCount,
          }),
        );
        this.stopAutoChecks();
        this.clearQuestionCue();
        this.setStatus("Socratic: Verified");
        this.helpView.showCompletion(
          this.state,
          Boolean(this.exercise.completion),
        );
        void vscode.commands.executeCommand(
          "setContext",
          "socraticRuntime.watching",
          false,
        );
        void vscode.commands.executeCommand(
          "setContext",
          "socraticRuntime.paused",
          false,
        );
        return;
      }

      if (!reduced.shouldCallModel) {
        this.state.silentDecisions += 1;
        this.state.phase = "observing";
        this.setStatus(this.watchingStatus());
        this.showWatchingView(this.hintsPaused);
        return;
      }

      if (this.hintsPaused) {
        this.state.silentDecisions += 1;
        this.appendEvent(
          event(
            guidanceOnly ? "guidance_review" : "equivalent_failure",
            "Final decision: remain silent",
            {
              reason: "learner_paused_hints",
            },
          ),
        );
        this.setStatus("Socratic: Watching · Hints Paused");
        return;
      }

      const provider = this.providerForState();
      const revisionKey = assessmentRevisionKey(
        this.state.sessionId,
        currentCode,
        result,
      );
      if (this.assessedRevisionKeys.has(revisionKey)) {
        this.state.silentDecisions += 1;
        this.appendEvent(
          event(
            guidanceOnly ? "guidance_review" : "equivalent_failure",
            "Duplicate revision assessment skipped",
            {
              decision: "remain_silent",
              reason: "revision_already_assessed",
            },
          ),
        );
        this.setStatus(this.watchingStatus());
        this.showWatchingView(this.hintsPaused);
        return;
      }
      this.assessedRevisionKeys.add(revisionKey);
      const packet = this.packet(
        result,
        currentCode,
        prior,
        this.state.lastCode,
      );
      const analyzedSessionId = this.state.sessionId;
      this.cancelModelAssessment();
      const assessmentAbort = new AbortController();
      this.activeModelAbort = assessmentAbort;
      this.setStatus("Socratic: Assessing Revision");
      this.helpView.showAssessing(this.state.mode === "guidance");
      const providerResult = await provider.analyze(packet, {
        mode: this.state.providerMode,
        timeoutMs: LIVE_MODEL_TIMEOUT_MS,
        signal: assessmentAbort.signal,
      });
      if (this.activeModelAbort === assessmentAbort)
        this.activeModelAbort = null;
      if (providerResult.fallbackReason === "assessment_cancelled")
        this.assessedRevisionKeys.delete(revisionKey);
      if (
        !isCurrentAnalysisContext(
          this.state?.sessionId ?? null,
          analyzedSessionId,
          checkedRevision,
          this.documentRevision,
        )
      ) {
        if (this.state?.sessionId === analyzedSessionId)
          this.appendEvent(
            event("check_completed", "Stale model result discarded", {
              checkedRevision,
              currentRevision: this.documentRevision,
            }),
          );
        return;
      }
      const gate = gateModelDecision(
        this.state,
        providerResult.decision,
        reduced,
      );
      const assessment = providerResult.decision;
      const transition = applyAssessmentTransition(
        this.state,
        result,
        currentCode,
        assessment,
        reduced,
        gate,
      );
      this.appendEvent(
        event(
          transition.assessmentEventType,
          `GPT-5.6 assessment: ${assessment.learnerState}`,
          {
            progress: assessment.progressAssessment,
            confidence: assessment.confidence,
            reasonCodes: assessment.reasonCodes,
            provider: providerResult.provider,
            model: providerResult.model ?? "unavailable",
            fallback: providerResult.fallbackReason ?? "none",
          },
        ),
      );
      if (transition.finalAction === "remain_silent") {
        this.appendEvent(
          event(
            guidanceOnly ? "guidance_review" : "equivalent_failure",
            "Final decision: remain silent",
            {
              modelRecommendation: providerResult.decision.decision,
              localPolicy: gate.reason,
              provider: providerResult.provider,
              fallback: providerResult.fallbackReason ?? "none",
            },
          ),
        );
        this.setStatus(
          providerResult.fallbackReason === "authentication_required"
            ? "Socratic: Sign-in Required"
            : this.watchingStatus(),
        );
        this.showWatchingView(this.hintsPaused);
        return;
      }

      const visibleText = gate.visibleText!;
      this.appendEvent(
        event("intervention_shown", `Question: ${visibleText}`, {
          modelRecommendation: providerResult.decision.decision,
          localPolicy: gate.reason,
          provider: providerResult.provider,
          model: providerResult.model ?? "unavailable",
          confidence: providerResult.decision.confidence,
          leakageRisk: providerResult.decision.solutionLeakageRisk,
          latencyMs: providerResult.latencyMs,
        }),
      );
      this.setStatus("Socratic: Question Available", visibleText);
      this.showQuestionCue(visibleText, document);
      void vscode.window
        .showInformationMessage(
          `Socratic Runtime: ${visibleText}`,
          "Open Help",
          "I'm Investigating",
          "Dismiss",
        )
        .then((action) => {
          if (action === "Open Help") void this.openHelp();
          if (action === "I'm Investigating")
            this.onHelpAction("investigating");
          if (action === "Dismiss") this.onHelpAction("dismiss");
        });
    } finally {
      this.checking = false;
      this.activeAutomaticCheck = false;
      if (this.state && this.state.phase !== "verified_complete") {
        const latestDocument = await vscode.workspace.openTextDocument(
          vscode.Uri.file(this.state.targetSymbol.file),
        );
        this.pendingAutoCheck =
          latestDocument.getText() !== this.lastCheckedCode;
        if (this.pendingAutoCheck && !this.watcherPaused)
          this.scheduleAutoCheck();
      }
    }
  }

  private async requestMoreHelp(): Promise<void> {
    const state = this.state;
    if (
      !state ||
      !this.folder ||
      state.phase === "verified_complete" ||
      !state.latestVerification ||
      state.latestVerification.passed
    ) {
      void vscode.window.showInformationMessage(
        "Run a revision check before requesting a nudge.",
      );
      return;
    }
    if (this.hintsPaused) {
      void vscode.window.showInformationMessage(
        "Resume Socratic questions before requesting a nudge.",
      );
      return;
    }
    if (state.episodeSupportCount >= MAX_SUPPORTS_PER_EPISODE) {
      void vscode.window.showInformationMessage(
        "This struggle episode has reached its three-step support limit. Try a revision or ask an instructor for direct help.",
      );
      return;
    }
    if (this.supportRequestInFlight || this.checking) {
      void vscode.window.showInformationMessage(
        "Socratic Runtime is already assessing this revision.",
      );
      return;
    }

    const document = await vscode.workspace.openTextDocument(
      vscode.Uri.file(state.targetSymbol.file),
    );
    const currentCode = document.getText();
    if (currentCode !== state.lastCode) {
      void vscode.window.showInformationMessage(
        "This revision changed after the last assessment. Run Check Now so the next nudge uses current evidence.",
      );
      return;
    }

    const sessionId = state.sessionId;
    const revision = this.documentRevision;
    const result = state.latestVerification;
    const reduced = reduceVerification(state, result, currentCode);
    this.supportRequestInFlight = true;
    this.appendEvent(
      event("support_requested", "Learner explicitly requested a nudge", {
        supportLevel: state.episodeSupportCount + 1,
      }),
    );
    this.cancelModelAssessment();
    const assessmentAbort = new AbortController();
    this.activeModelAbort = assessmentAbort;
    this.setStatus("Socratic: Preparing Nudge");
    this.helpView.showAssessing(state.mode === "guidance");
    try {
      const providerResult = await this.providerForState().analyze(
        this.packet(result, currentCode, result, currentCode, true),
        {
          mode: state.providerMode,
          timeoutMs: LIVE_MODEL_TIMEOUT_MS,
          signal: assessmentAbort.signal,
        },
      );
      if (this.activeModelAbort === assessmentAbort)
        this.activeModelAbort = null;
      if (
        !isCurrentAnalysisContext(
          this.state?.sessionId ?? null,
          sessionId,
          revision,
          this.documentRevision,
        )
      )
        return;

      const currentState = this.state!;
      currentState.modelAssessmentCount += 1;
      currentState.alternativeStrategyProbability =
        providerResult.decision.alternativeStrategyProbability;
      const gate = gateModelDecision(
        currentState,
        providerResult.decision,
        reduced,
        { explicitHelpRequest: true },
      );
      this.appendEvent(
        event(
          "support_requested",
          `Explicit support assessment: ${providerResult.decision.learnerState}`,
          {
            modelRecommendation: providerResult.decision.decision,
            localPolicy: gate.reason,
            provider: providerResult.provider,
            model: providerResult.model ?? "unavailable",
            confidence: providerResult.decision.confidence,
          },
        ),
      );
      if (
        !gate.permitted ||
        gate.action === "remain_silent" ||
        !gate.visibleText
      ) {
        currentState.silentDecisions += 1;
        this.setStatus(this.watchingStatus());
        this.showWatchingView(false);
        void vscode.window.showInformationMessage(
          "No nudge passed the safety and confidence checks for this revision.",
        );
        return;
      }

      currentState.interventionsShown += 1;
      currentState.lastInterventionCheck = currentState.checkCount;
      currentState.episodeHasIntervention = true;
      currentState.episodeSupportCount += 1;
      currentState.phase = "investigating";
      this.appendEvent(
        event("intervention_shown", `Question: ${gate.visibleText}`, {
          trigger: "explicit_help_request",
          supportLevel: currentState.episodeSupportCount,
          modelRecommendation: providerResult.decision.decision,
          localPolicy: gate.reason,
          provider: providerResult.provider,
          model: providerResult.model ?? "unavailable",
          confidence: providerResult.decision.confidence,
          leakageRisk: providerResult.decision.solutionLeakageRisk,
          latencyMs: providerResult.latencyMs,
        }),
      );
      this.setStatus("Socratic: Nudge Available", gate.visibleText);
      this.showQuestionCue(gate.visibleText, document);
    } finally {
      if (this.activeModelAbort === assessmentAbort)
        this.activeModelAbort = null;
      this.supportRequestInFlight = false;
    }
  }

  private async showReferenceSolution(): Promise<void> {
    if (
      !this.state ||
      !this.folder ||
      this.state.phase !== "verified_complete" ||
      !this.exercise?.completion
    ) {
      void vscode.window.showInformationMessage(
        "A reference comparison is available only after verified completion.",
      );
      return;
    }
    const completion = this.exercise.completion;
    try {
      const uri = vscode.Uri.joinPath(
        this.folder.uri,
        completion.referenceSolution,
      );
      const bytes = await vscode.workspace.fs.readFile(uri);
      if (bytes.byteLength > 24_000)
        throw new Error("reference solution exceeds 24000 bytes");
      const code = Buffer.from(bytes).toString("utf8");
      this.appendEvent(
        event(
          "reference_opened",
          "Author-provided reference comparison opened after verification",
        ),
      );
      this.helpView.showReferenceSolution(
        completion.title,
        code,
        completion.explanation,
        completion.complexity,
      );
    } catch (error) {
      void vscode.window.showErrorMessage(
        `Unable to open the reference comparison: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private providerForState(): PedagogicalModelProvider {
    if (!this.state || !this.folder)
      throw new Error("A live Socratic Runtime session is required");
    const codexPath = vscode.workspace
      .getConfiguration("socraticRuntime")
      .get<string>("codexPath", "codex");
    return new CodexCliProvider(
      this.folder.uri.fsPath,
      codexPath,
      [],
      path.join(
        this.context.extensionPath,
        ".agents",
        "skills",
        "socratic-runtime",
      ),
    );
  }

  private packet(
    result: NonNullable<SessionState["latestVerification"]>,
    currentCode: string,
    previousVerification: SessionState["latestVerification"],
    previousCode: string,
    explicitHelpRequested = false,
  ): LearningStatePacket {
    const state = this.state!;
    const language = this.exercise?.language ?? this.sessionLanguage;
    const currentTarget = extractTargetCode(
      currentCode,
      state.targetSymbol,
      language,
    );
    const previousTarget = previousVerification
      ? extractTargetCode(previousCode, state.targetSymbol, language)
      : null;
    return {
      language,
      task: { summary: state.task.summary, text: state.task.text },
      target: { name: state.targetSymbol.name, kind: state.targetSymbol.kind },
      currentCode: currentTarget,
      previousCode: previousTarget,
      revisionDiff: compactRevisionDiff(previousTarget, currentTarget),
      recentEvents: state.eventHistory.slice(-8),
      verification: modelVerificationResult(result),
      previousVerification: previousVerification
        ? abstractVerificationResult(previousVerification)
        : null,
      state: {
        phase: state.phase,
        equivalentFailureCount: state.equivalentFailureCount,
        semanticProgressScore: state.semanticProgressScore,
        experimentationEvidence: state.experimentationEvidence,
        interventionsShown: state.interventionsShown,
        checksSinceIntervention:
          state.lastInterventionCheck === null
            ? null
            : state.checkCount - state.lastInterventionCheck,
        struggleEpisode: state.struggleEpisode,
        episodeHasIntervention: state.episodeHasIntervention,
        episodeSupportCount: state.episodeSupportCount,
        explicitHelpRequested,
      },
      permittedActions: explicitHelpRequested
        ? state.episodeSupportCount >= 2
          ? ["remain_silent", "direct_attention", "ask_invariant"]
          : [
              "remain_silent",
              "suggest_experiment",
              "direct_attention",
              "ask_invariant",
            ]
        : [
            "remain_silent",
            "ask_prediction",
            "suggest_experiment",
            "direct_attention",
            "ask_invariant",
          ],
      policyConstraints: [
        "preserve silence while self-correction, progress, or experimentation remains plausible; when the trajectory establishes stalled with no meaningful progress, select the smallest safe question",
        "no code",
        "no file edits",
        "no hidden-test disclosure",
        "one concise question per intervention",
        "consider at least two plausible interpretations",
        "the model owns progress and intervention classification",
        state.mode === "guidance"
          ? "guidance-only evidence cannot establish correctness or completion"
          : "executable verification alone establishes correctness and completion",
        explicitHelpRequested
          ? "the learner explicitly requested one additional nudge"
          : "the learner has not explicitly requested help; this does not block one unsolicited question when the trajectory establishes a stall",
      ],
    };
  }

  pauseWatching(): void {
    if (!this.state || this.state.phase === "verified_complete") {
      void vscode.window.showInformationMessage(
        "No active watching session can be paused.",
      );
      return;
    }
    this.watcherPaused = true;
    this.cancelModelAssessment();
    this.clearInactivityTimer();
    if (this.autoCheckTimer) clearTimeout(this.autoCheckTimer);
    this.autoCheckTimer = null;
    if (this.activeAutomaticCheck) this.verifier.cancel();
    this.appendEvent(
      event("watcher_paused", "Automatic watching paused by learner"),
    );
    this.setStatus("Socratic: Paused");
    this.helpView.showWatcherPaused();
    void vscode.commands.executeCommand(
      "setContext",
      "socraticRuntime.watching",
      false,
    );
    void vscode.commands.executeCommand(
      "setContext",
      "socraticRuntime.paused",
      true,
    );
  }

  resumeWatching(): void {
    if (!this.state || this.state.phase === "verified_complete") {
      void vscode.window.showInformationMessage(
        "Start an active session before resuming watching.",
      );
      return;
    }
    this.watcherPaused = false;
    this.pendingAutoCheck = true;
    this.appendEvent(event("watcher_resumed", "Automatic watching resumed"));
    this.setStatus(this.watchingStatus());
    this.showWatchingView(this.hintsPaused);
    void vscode.commands.executeCommand(
      "setContext",
      "socraticRuntime.watching",
      true,
    );
    void vscode.commands.executeCommand(
      "setContext",
      "socraticRuntime.paused",
      false,
    );
    this.scheduleAutoCheck(true);
    this.resetInactivityTimer();
  }

  async openHelp(): Promise<void> {
    await vscode.commands.executeCommand(
      "workbench.view.extension.socraticRuntime",
    );
  }

  showDevelopmentPreview(kind: "question" | "reference"): void {
    if (this.context.extensionMode !== vscode.ExtensionMode.Development) return;
    if (kind === "question") {
      this.helpView.showQuestion(
        "What observation would distinguish the two interval interpretations?",
        "Development preview of a gated first support step.",
        true,
      );
      this.setStatus("Socratic: Question Available");
    } else {
      this.helpView.showReferenceSolution(
        "Half-open interval reference",
        "def binary_search(values, target):\n    # Author-provided verified comparison\n    ...",
        "This preview verifies code wrapping, explanatory hierarchy, and completion-only messaging.",
        "O(log n) time and O(1) additional space.",
      );
      this.setStatus("Socratic: Verified");
    }
    void this.openHelp();
  }

  openDecisionTrace(): void {
    if (!this.state) {
      void vscode.window.showInformationMessage(
        "No active Socratic Runtime session.",
      );
      return;
    }
    this.renderTrace();
    this.trace.show(true);
  }

  openPolicyComparison(): void {
    showPolicyComparison(this.state);
  }

  async resetDemo(): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      void vscode.window.showWarningMessage(
        "Open the bundled binary-search workspace first.",
      );
      return;
    }
    let config: ExerciseConfig | null;
    try {
      config = await loadExerciseConfig(folder);
    } catch (error) {
      void vscode.window.showErrorMessage(
        `Cannot reset demo: ${error instanceof Error ? error.message : String(error)}`,
      );
      return;
    }
    if (!config?.demo?.starterFile) {
      void vscode.window.showWarningMessage(
        "This workspace does not provide a trusted demo starter file.",
      );
      return;
    }
    await this.endSession(false);
    const source = vscode.Uri.joinPath(folder.uri, config.demo.starterFile);
    const target = vscode.Uri.joinPath(folder.uri, config.targetFile);
    const bytes = await vscode.workspace.fs.readFile(source);
    await vscode.workspace.fs.writeFile(target, bytes);
    this.trace.clear();
    this.setStatus("Socratic: Inactive");
    const document = await vscode.workspace.openTextDocument(target);
    await vscode.window.showTextDocument(document);
    void vscode.window.showInformationMessage(
      "Socratic Runtime demo reset to the clean starter state.",
    );
  }

  async endSession(notify = true): Promise<void> {
    if (!this.state) {
      if (notify)
        void vscode.window.showInformationMessage(
          "No Socratic Runtime session is active.",
        );
      return;
    }
    this.appendEvent(event("session_ended", "Session ended"));
    await this.persist();
    this.verifier.cancel();
    this.cancelModelAssessment();
    this.stopAutoChecks();
    this.clearQuestionCue();
    this.lastCheckedCode = null;
    this.watcherPaused = false;
    this.hintsPaused = false;
    this.assessedRevisionKeys.clear();
    this.state = null;
    this.exercise = null;
    this.folder = null;
    this.sessionLanguage = "unknown";
    this.setStatus("Socratic: Inactive");
    this.helpView.showInactive();
    void vscode.commands.executeCommand(
      "setContext",
      "socraticRuntime.active",
      false,
    );
    void vscode.commands.executeCommand(
      "setContext",
      "socraticRuntime.watching",
      false,
    );
    void vscode.commands.executeCommand(
      "setContext",
      "socraticRuntime.paused",
      false,
    );
    if (notify)
      void vscode.window.showInformationMessage(
        "Socratic Runtime session ended.",
      );
  }

  private onDocumentChanged(change: vscode.TextDocumentChangeEvent): void {
    if (
      !this.state ||
      change.document.uri.fsPath !== this.state.targetSymbol.file ||
      change.contentChanges.length === 0
    )
      return;
    this.cancelModelAssessment();
    const wasVerified = shouldReverifyAfterEdit(this.state.phase);
    this.clearQuestionCue();
    this.documentRevision += 1;
    this.lastChangedLines = change.contentChanges
      .flatMap((item) => {
        const lineCount = Math.max(1, item.text.split(/\r?\n/).length);
        return Array.from(
          { length: Math.min(lineCount, 4) },
          (_, index) => item.range.start.line + index,
        );
      })
      .slice(0, 8);
    this.pendingAutoCheck = true;
    const source = change.document.getText();
    const taskBinding = classifyTaskBinding(
      source,
      this.state.task,
      this.state.targetSymbol,
      change.document.languageId,
    );
    if (taskBinding !== "unchanged") {
      this.appendEvent(
        event(
          "task_changed",
          "Task binding changed during the active session",
          { reason: `task_binding_${taskBinding}` },
        ),
      );
      this.setStatus("Socratic: Guidance Only");
      this.state.mode = "guidance";
      this.stopAutoChecks();
      if (this.activeAutomaticCheck) this.verifier.cancel();
      this.helpView.showGuidanceOnly(
        "The active task binding changed. Start a new session after restoring or selecting the task.",
      );
      return;
    }
    if (wasVerified) {
      this.state.phase = "observing";
      this.state.latestVerification = null;
      this.state.lastFailureFingerprint = null;
      this.state.observedFailureFingerprints = [];
      this.lastCheckedCode = null;
      this.state.struggleEpisode += 1;
      this.state.episodeHasIntervention = false;
      this.state.episodeSupportCount = 0;
      void vscode.commands.executeCommand(
        "setContext",
        "socraticRuntime.watching",
        true,
      );
    }
    if (!this.watcherPaused) {
      this.resetInactivityTimer();
      this.setStatus(this.watchingStatus());
      this.showWatchingView(this.hintsPaused);
    }
    if (this.activeAutomaticCheck) this.verifier.cancel();
    if (!this.watcherPaused) this.scheduleAutoCheck();
  }

  private onDiagnosticsChanged(): void {
    if (!this.state) return;
    const uri = vscode.Uri.file(this.state.targetSymbol.file);
    const diagnostics = vscode.languages.getDiagnostics(uri);
    const errors = diagnostics.filter(
      (item) => item.severity === vscode.DiagnosticSeverity.Error,
    ).length;
    if (errors > 0)
      this.appendEvent(
        event(
          "diagnostic_change",
          `${errors} relevant editor diagnostic${errors === 1 ? "" : "s"} observed`,
        ),
      );
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const runtime = new SocraticRuntime(context);
  context.subscriptions.push(
    runtime,
    vscode.commands.registerCommand("socraticRuntime.startSession", () =>
      runtime.startSession(),
    ),
    vscode.commands.registerCommand("socraticRuntime.runCheck", () =>
      runtime.runCheck(),
    ),
    vscode.commands.registerCommand("socraticRuntime.useSelectionAsTask", () =>
      runtime.useSelectionAsTask(),
    ),
    vscode.commands.registerCommand(
      "socraticRuntime.copySelectionAsTaskMarker",
      () => runtime.copySelectionAsTaskMarker(),
    ),
    vscode.commands.registerCommand("socraticRuntime.runSetupDoctor", () =>
      runtime.runSetupDoctor(),
    ),
    vscode.commands.registerCommand("socraticRuntime.openDecisionTrace", () =>
      runtime.openDecisionTrace(),
    ),
    vscode.commands.registerCommand(
      "socraticRuntime.openPolicyComparison",
      () => runtime.openPolicyComparison(),
    ),
    vscode.commands.registerCommand("socraticRuntime.resetDemo", () =>
      runtime.resetDemo(),
    ),
    vscode.commands.registerCommand("socraticRuntime.endSession", () =>
      runtime.endSession(),
    ),
    vscode.commands.registerCommand("socraticRuntime.pauseWatching", () =>
      runtime.pauseWatching(),
    ),
    vscode.commands.registerCommand("socraticRuntime.resumeWatching", () =>
      runtime.resumeWatching(),
    ),
    vscode.commands.registerCommand("socraticRuntime.openHelp", () =>
      runtime.openHelp(),
    ),
  );
  if (
    context.extensionMode === vscode.ExtensionMode.Development &&
    ["question", "reference"].includes(
      process.env.SOCRATIC_VISUAL_PREVIEW ?? "",
    )
  )
    runtime.showDevelopmentPreview(
      process.env.SOCRATIC_VISUAL_PREVIEW as "question" | "reference",
    );
}

export function deactivate(): void {}
