import { randomUUID } from "node:crypto";
import * as path from "node:path";
import * as vscode from "vscode";
import type { HelpAction } from "./helpActions.js";
import { CodexLunaProvider, checkCodexStatus } from "./providers.js";
import { enforceAssessmentSafety, isMeaningfulRevision } from "./safety.js";
import { DEFAULT_IDLE_DELAY_MS } from "./runtimeConfig.js";
import {
  boundedCode,
  compactDiff,
  inferredTask,
  taskFromMarker,
  taskFromSelection,
} from "./taskContext.js";
import type {
  AssessmentPacket,
  DiagnosticContext,
  RuntimeSession,
  TrajectoryEvent,
} from "./types.js";
import { LearningSupportView } from "./ui.js";

class SocraticRuntime implements vscode.Disposable {
  private readonly status = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    90,
  );
  private readonly trace = vscode.window.createOutputChannel(
    "Socratic Runtime — Luna Trace",
  );
  private readonly support = new LearningSupportView();
  private readonly subscriptions: vscode.Disposable[] = [];
  private session: RuntimeSession | null = null;
  private provider: CodexLunaProvider | null = null;
  private timer: NodeJS.Timeout | null = null;
  private activeAbort: AbortController | null = null;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.status.command = "socraticRuntime.openSupport";
    this.status.text = "$(lightbulb) Socratic: Inactive";
    this.status.tooltip = "Start Socratic Runtime on the current file";
    this.status.show();
    this.subscriptions.push(
      this.status,
      this.trace,
      this.support,
      vscode.window.registerWebviewViewProvider(
        LearningSupportView.id,
        this.support,
      ),
      this.support.onDidAction((action) => this.onHelpAction(action)),
      vscode.workspace.onDidChangeTextDocument((event) =>
        this.onDocumentChanged(event),
      ),
    );
  }

  private setStatus(text: string, tooltip?: string): void {
    this.status.text = `$(lightbulb) ${text}`;
    this.status.tooltip = tooltip ?? "Open Socratic Runtime";
  }

  private log(event: string, details: Record<string, unknown> = {}): void {
    const time = new Date().toLocaleTimeString([], { hour12: false });
    this.trace.appendLine(`${time}  ${event}`);
    const entries = Object.entries(details);
    if (entries.length)
      this.trace.appendLine(
        `          ${entries.map(([key, value]) => `${key}: ${String(value)}`).join(" · ")}`,
      );
  }

  private codexPath(): string {
    return vscode.workspace
      .getConfiguration("socraticRuntime")
      .get<string>("codexPath", "codex");
  }

  private idleDelay(): number {
    return vscode.workspace
      .getConfiguration("socraticRuntime")
      .get<number>("idleDelayMs", DEFAULT_IDLE_DELAY_MS);
  }

  private createProvider(): CodexLunaProvider {
    return new CodexLunaProvider(
      this.codexPath(),
      path.join(
        this.context.extensionPath,
        ".agents",
        "skills",
        "socratic-runtime",
      ),
    );
  }

  async startSession(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.scheme !== "file") {
      void vscode.window.showWarningMessage(
        "Open the programming file you want to learn in, then start Socratic Runtime again.",
      );
      return;
    }

    await this.endSession(false);
    await this.openSupport();
    this.support.showStarting("Checking your existing Codex sign-in…");
    this.setStatus("Socratic: Checking Codex");
    const status = await checkCodexStatus(this.codexPath());
    if (status !== "ready") {
      const message =
        status === "auth_required"
          ? "Codex is installed but not signed in. Sign in with your existing ChatGPT account, then start again."
          : "The Codex CLI was not found. Install Codex or set socraticRuntime.codexPath, then start again.";
      this.support.showError(message);
      this.setStatus("Socratic: Sign-in Required");
      return;
    }

    this.provider = this.createProvider();
    const document = editor.document;
    const source = document.getText();
    const selection = editor.selection.isEmpty
      ? null
      : taskFromSelection(document.getText(editor.selection));
    let task = taskFromMarker(source) ?? selection;
    if (!task) {
      this.support.showStarting("Inferring the task from the current file…");
      this.setStatus("Socratic: Inferring Task");
      const inferred = source.trim()
        ? await this.provider.inferTask(
            document.languageId,
            path.basename(document.fileName),
            boundedCode(source),
          )
        : { value: null, error: null };
      const confirmed = await vscode.window.showInputBox({
        title: "Confirm the Socratic task",
        prompt:
          "What are you trying to implement? This becomes Luna's task context for the session.",
        value: inferred.value ?? "",
        ignoreFocusOut: true,
        validateInput: (value) =>
          value.trim() ? null : "Describe the programming task to continue.",
      });
      if (!confirmed) {
        this.support.showInactive();
        this.setStatus("Socratic: Inactive");
        return;
      }
      task = inferredTask(confirmed);
    }

    this.session = {
      id: randomUUID(),
      documentUri: document.uri.toString(),
      fileName: path.basename(document.fileName),
      languageId: document.languageId,
      task,
      startedAt: Date.now(),
      revision: 0,
      lastAssessedCode: boundedCode(source),
      trajectorySummary: "Session started; no revision has been assessed yet.",
      events: [],
      questionsShown: 0,
      silentAssessments: 0,
      phase: "observing",
      completionSummary: null,
      reference: null,
    };
    await vscode.commands.executeCommand(
      "setContext",
      "socraticRuntime.active",
      true,
    );
    this.log("Session started", {
      file: this.session.fileName,
      language: this.session.languageId,
      taskSource: task.source,
      model: "gpt-5.6-luna",
      reasoning: "medium",
    });
    this.setStatus("Socratic: Watching");
    this.support.showObserving(this.session);
    this.scheduleAssessment();
  }

  private onDocumentChanged(event: vscode.TextDocumentChangeEvent): void {
    const session = this.session;
    if (
      !session ||
      event.document.uri.toString() !== session.documentUri ||
      ["complete", "completing", "paused"].includes(session.phase)
    )
      return;
    this.cancelAssessment();
    this.cancelTimer();
    session.phase = "observing";
    this.setStatus("Socratic: Waiting for Pause");
    this.support.showObserving(session);
    this.scheduleAssessment();
  }

  private scheduleAssessment(): void {
    if (!this.session || this.session.phase === "paused") return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.assess(false);
    }, this.idleDelay());
  }

  private currentDocument(): vscode.TextDocument | null {
    const session = this.session;
    if (!session) return null;
    return (
      vscode.workspace.textDocuments.find(
        (document) => document.uri.toString() === session.documentUri,
      ) ?? null
    );
  }

  private diagnostics(document: vscode.TextDocument): DiagnosticContext[] {
    return vscode.languages
      .getDiagnostics(document.uri)
      .filter(
        (item) =>
          item.severity === vscode.DiagnosticSeverity.Error ||
          item.severity === vscode.DiagnosticSeverity.Warning,
      )
      .slice(0, 12)
      .map((item) => ({
        severity:
          item.severity === vscode.DiagnosticSeverity.Error
            ? ("error" as const)
            : ("warning" as const),
        message: item.message.slice(0, 500),
        line: item.range.start.line + 1,
      }));
  }

  private packet(
    document: vscode.TextDocument,
    currentCode: string,
    explicitHelpRequested: boolean,
  ): AssessmentPacket {
    const session = this.session!;
    return {
      task: session.task,
      languageId: session.languageId,
      fileName: session.fileName,
      previousCode: session.revision === 0 ? null : session.lastAssessedCode,
      currentCode,
      revisionDiff: compactDiff(
        session.revision === 0 ? null : session.lastAssessedCode,
        currentCode,
      ),
      diagnostics: this.diagnostics(document),
      trajectorySummary: session.trajectorySummary,
      recentEvents: session.events.slice(-8),
      explicitHelpRequested,
    };
  }

  private async assess(explicitHelpRequested: boolean): Promise<void> {
    const session = this.session;
    const provider = this.provider;
    const document = this.currentDocument();
    if (!session || !provider || !document || session.phase === "paused")
      return;
    const currentCode = boundedCode(document.getText());
    if (
      !explicitHelpRequested &&
      !isMeaningfulRevision(session.lastAssessedCode, currentCode)
    ) {
      this.setStatus("Socratic: Watching");
      this.support.showObserving(session);
      return;
    }

    this.cancelAssessment();
    this.cancelTimer();
    const abort = new AbortController();
    this.activeAbort = abort;
    const sessionId = session.id;
    const assessedCode = currentCode;
    session.phase = "assessing";
    this.setStatus(
      explicitHelpRequested
        ? "Socratic: Preparing Nudge"
        : "Socratic: Assessing",
    );
    this.support.showAssessing(session, explicitHelpRequested);
    this.log("Luna assessment started", {
      revision: session.revision + 1,
      trigger: explicitHelpRequested ? "learner_nudge" : "stable_revision",
    });
    const packet = this.packet(document, currentCode, explicitHelpRequested);
    const result = await provider.assess(packet, abort.signal);
    if (this.activeAbort === abort) this.activeAbort = null;
    if (
      !this.session ||
      this.session.id !== sessionId ||
      boundedCode(document.getText()) !== assessedCode
    ) {
      this.log("Stale assessment discarded");
      return;
    }
    if (!result.value) {
      if (result.error === "cancelled") return;
      session.phase = "observing";
      this.setStatus(
        result.error === "authentication_required"
          ? "Socratic: Sign-in Required"
          : "Socratic: Watching",
      );
      this.support.showError(
        result.error === "authentication_required"
          ? "Codex authentication is no longer available. Sign in and restart the session."
          : "Luna could not assess this revision. Your session remains active and the next meaningful revision will try again.",
        session,
      );
      this.log("Assessment unavailable", { error: result.error ?? "unknown" });
      return;
    }

    const decision = enforceAssessmentSafety(result.value);
    session.revision += 1;
    session.lastAssessedCode = currentCode;
    session.trajectorySummary = decision.trajectorySummary;
    const event: TrajectoryEvent = {
      revision: session.revision,
      learnerState: decision.learnerState,
      action: decision.action,
      summary: decision.assessment,
      question: decision.question,
    };
    session.events.push(event);
    this.log("Luna decision", {
      state: decision.learnerState,
      action: decision.action,
      latencyMs: result.latencyMs,
    });

    if (decision.action === "complete") {
      await this.complete(
        packet,
        decision.completionSummary ?? decision.assessment,
      );
      return;
    }
    if (decision.action === "ask_question" && decision.question) {
      session.questionsShown += 1;
      session.phase = "question";
      this.setStatus("Socratic: Question Available", decision.question);
      this.support.showQuestion(
        session,
        decision.question,
        decision.assessment,
      );
      void vscode.window
        .showInformationMessage(
          `Socratic Runtime: ${decision.question}`,
          "Open Support",
          "Keep Coding",
        )
        .then((choice) => {
          if (choice === "Open Support") void this.openSupport();
        });
      return;
    }

    session.silentAssessments += 1;
    session.phase = "observing";
    this.setStatus("Socratic: Watching");
    this.support.showObserving(session);
  }

  private async complete(
    assessmentPacket: AssessmentPacket,
    completionSummary: string,
  ): Promise<void> {
    const session = this.session!;
    const provider = this.provider!;
    session.phase = "completing";
    session.completionSummary = completionSummary;
    this.cancelTimer();
    this.setStatus("Socratic: Task Complete");
    this.support.showCompleting(session);
    this.log("Session completed by Luna", { revision: session.revision });
    const reference = await provider.createReference(
      assessmentPacket,
      completionSummary,
    );
    if (!this.session || this.session.id !== session.id) return;
    session.phase = "complete";
    session.reference = reference.value;
    await vscode.commands.executeCommand(
      "setContext",
      "socraticRuntime.active",
      false,
    );
    this.support.showComplete(
      session,
      reference.error
        ? "The task is complete, but Luna could not prepare the reference approach."
        : undefined,
    );
    void vscode.window
      .showInformationMessage(
        "Socratic Runtime: Luna considers the task complete. The session ended and a reference approach is available in Learning Support.",
        "Open Support",
      )
      .then((choice) => {
        if (choice === "Open Support") void this.openSupport();
      });
  }

  async askForNudge(): Promise<void> {
    if (
      !this.session ||
      ["complete", "completing"].includes(this.session.phase)
    ) {
      void vscode.window.showInformationMessage(
        "Start an active Socratic Runtime session before asking for a nudge.",
      );
      return;
    }
    await this.assess(true);
  }

  pause(): void {
    if (
      !this.session ||
      ["complete", "completing"].includes(this.session.phase)
    )
      return;
    this.cancelAssessment();
    this.cancelTimer();
    this.session.phase = "paused";
    this.setStatus("Socratic: Paused");
    this.support.showObserving(this.session);
  }

  resume(): void {
    if (!this.session || this.session.phase !== "paused") return;
    this.session.phase = "observing";
    this.setStatus("Socratic: Watching");
    this.support.showObserving(this.session);
    this.scheduleAssessment();
  }

  async endSession(notify = true): Promise<void> {
    this.cancelAssessment();
    this.cancelTimer();
    const existed = Boolean(this.session);
    this.session = null;
    this.provider = null;
    await vscode.commands.executeCommand(
      "setContext",
      "socraticRuntime.active",
      false,
    );
    this.setStatus("Socratic: Inactive");
    this.support.showInactive();
    if (notify && existed)
      void vscode.window.showInformationMessage(
        "Socratic Runtime session ended.",
      );
  }

  private cancelTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private cancelAssessment(): void {
    this.activeAbort?.abort();
    this.activeAbort = null;
  }

  async openSupport(): Promise<void> {
    await vscode.commands.executeCommand(
      "workbench.view.extension.socraticRuntime",
    );
  }

  openTrace(): void {
    this.trace.show(true);
  }

  private onHelpAction(action: HelpAction): void {
    if (action === "askForNudge") void this.askForNudge();
    if (action === "dismissQuestion" && this.session) {
      this.session.phase = "observing";
      this.support.showObserving(this.session);
    }
    if (action === "pause") this.pause();
    if (action === "resume") this.resume();
    if (action === "endSession") void this.endSession();
  }

  dispose(): void {
    this.cancelAssessment();
    this.cancelTimer();
    for (const subscription of this.subscriptions) subscription.dispose();
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const runtime = new SocraticRuntime(context);
  context.subscriptions.push(
    runtime,
    vscode.commands.registerCommand("socraticRuntime.startSession", () =>
      runtime.startSession(),
    ),
    vscode.commands.registerCommand("socraticRuntime.askForNudge", () =>
      runtime.askForNudge(),
    ),
    vscode.commands.registerCommand("socraticRuntime.pause", () =>
      runtime.pause(),
    ),
    vscode.commands.registerCommand("socraticRuntime.resume", () =>
      runtime.resume(),
    ),
    vscode.commands.registerCommand("socraticRuntime.endSession", () =>
      runtime.endSession(),
    ),
    vscode.commands.registerCommand("socraticRuntime.openSupport", () =>
      runtime.openSupport(),
    ),
    vscode.commands.registerCommand("socraticRuntime.openDecisionTrace", () =>
      runtime.openTrace(),
    ),
  );
}

export function deactivate(): void {}
