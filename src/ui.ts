import * as vscode from "vscode";
import { assessmentStatusCopy } from "./guidance.js";
import {
  isHelpAction,
  nudgeActionLabel,
  type HelpAction,
} from "./helpActions.js";
import type { SessionState } from "./types.js";

export interface SetupDoctorCheck {
  label: string;
  status: "ready" | "warning" | "blocked";
  detail: string;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );
}

function nonce(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function page(title: string, body: string, scripted = false): string {
  const token = nonce();
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src ${scripted ? `'nonce-${token}'` : "'none'"}"><style>
  body{font-family:var(--vscode-font-family);padding:16px;color:var(--vscode-foreground)}
  h1{font-size:20px;font-weight:600;margin-top:0}.card{border:1px solid var(--vscode-panel-border);border-radius:8px;padding:14px;margin:12px 0}
  .metric{display:grid;grid-template-columns:1fr auto;gap:12px;padding:7px 0;border-bottom:1px solid var(--vscode-panel-border)}
  .muted{color:var(--vscode-descriptionForeground)}.why{border-left:3px solid var(--vscode-editorWarning-foreground);padding-left:10px}
  pre{white-space:pre-wrap;overflow-wrap:anywhere;background:var(--vscode-textCodeBlock-background);padding:12px;border-radius:4px}
  .actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}button{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:0;padding:7px 10px;border-radius:2px;cursor:pointer}
  button.secondary{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)} details{margin-top:16px}</style></head><body><h1>${escapeHtml(title)}</h1>${body}${
    scripted
      ? `<script nonce="${token}">const vscode=acquireVsCodeApi();document.querySelectorAll('[data-action]').forEach((button)=>button.addEventListener('click',()=>vscode.postMessage({action:button.dataset.action})));</script>`
      : ""
  }</body></html>`;
}

export class SocraticHelpView
  implements vscode.WebviewViewProvider, vscode.Disposable
{
  static readonly viewId = "socraticRuntime.help";
  private readonly actionEmitter = new vscode.EventEmitter<HelpAction>();
  readonly onDidAction = this.actionEmitter.event;
  private view: vscode.WebviewView | null = null;
  private html = page(
    "Socratic Runtime",
    '<p class="muted">Start a session to review revisions. Verified mode runs approved tests; Guidance-only mode never claims correctness.</p><div class="actions"><button data-action="rerunSetupDoctor">Run Setup Doctor</button></div>',
    true,
  );

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = this.html;
    view.webview.onDidReceiveMessage((message: unknown) => {
      const action =
        message && typeof message === "object"
          ? (message as { action?: unknown }).action
          : undefined;
      if (isHelpAction(action)) this.actionEmitter.fire(action);
    });
    view.onDidDispose(() => {
      this.view = null;
    });
  }

  private update(html: string, reveal = false): void {
    this.html = html;
    if (this.view) {
      this.view.webview.html = html;
      if (reveal) this.view.show?.(true);
    }
  }

  showWatching(hintsPaused = false, supportCount: number | null = null): void {
    const nudgeAction =
      supportCount === null
        ? ""
        : `<div class="actions"><button data-action="moreHelp">${escapeHtml(nudgeActionLabel(supportCount))}</button></div>`;
    this.update(
      page(
        hintsPaused ? "Hints paused" : "Watching quietly",
        hintsPaused
          ? '<p>Verification continues, but Socratic questions are paused.</p><div class="actions"><button data-action="resumeHints">Resume hints</button></div>'
          : `<p class="muted">New revisions are checked after you pause typing. You will only be notified when a minimal question is justified.</p>${nudgeAction}`,
        hintsPaused || supportCount !== null,
      ),
    );
  }

  showAssessing(guidanceOnly = false): void {
    this.update(
      page(
        "Assessing this revision",
        `<p class="muted">${escapeHtml(assessmentStatusCopy(guidanceOnly))}</p>`,
      ),
    );
  }

  showInactive(): void {
    this.update(
      page(
        "Socratic Runtime",
        '<p class="muted">Start a session to review revisions. Verified mode runs approved tests; Guidance-only mode never claims correctness.</p><div class="actions"><button data-action="rerunSetupDoctor">Run Setup Doctor</button></div>',
        true,
      ),
    );
  }

  showGuidanceOnly(reason: string, supportCount: number | null = null): void {
    const nudgeAction =
      supportCount === null
        ? ""
        : `<div class="actions"><button data-action="moreHelp">${escapeHtml(nudgeActionLabel(supportCount))}</button></div>`;
    this.update(
      page(
        "Guidance only",
        `<div class="card"><p>${escapeHtml(reason)}</p></div><p class="muted">GPT-5.6 may compare revisions and ask a minimal question, but executable correctness and completion claims remain disabled.</p>${nudgeAction}`,
        supportCount !== null,
      ),
    );
  }

  showSetupDoctor(checks: SetupDoctorCheck[], presetCount: number): void {
    const icon = { ready: "✓", warning: "!", blocked: "×" } as const;
    const ready = checks.every((check) => check.status === "ready");
    this.update(
      page(
        "Setup Doctor",
        `<p class="muted">Checks the local VS Code, Codex, task, and verifier path. No new account or API key is required.</p><div class="card">${checks
          .map(
            (check) =>
              `<div class="metric"><span><strong>${icon[check.status]} ${escapeHtml(check.label)}</strong><br><span class="muted">${escapeHtml(check.detail)}</span></span><strong>${check.status === "ready" ? "Ready" : check.status === "warning" ? "Review" : "Blocked"}</strong></div>`,
          )
          .join(
            "",
          )}</div><p><strong>${ready ? "Ready to start a verified session." : "Setup needs attention."}</strong></p><div class="actions">${presetCount > 0 ? '<button data-action="configurePreset">Configure detected verifier</button>' : ""}<button class="secondary" data-action="rerunSetupDoctor">Run checks again</button></div>`,
        true,
      ),
      true,
    );
  }

  showWatcherPaused(inactive = false, inactivityMs = 0): void {
    const minutes = Math.round(inactivityMs / 60_000);
    this.update(
      page(
        "Watching paused",
        `<p class="muted">${
          inactive
            ? `Paused after ${minutes} minutes without an edit. The timeout did not run a check or contact AI.`
            : "Paused by you."
        } No automatic checks will run until watching is resumed. “Check Now” remains available.</p><div class="actions"><button data-action="resumeWatching">Resume watching</button></div>`,
        true,
      ),
    );
  }

  showSetupRequired(reason: string): void {
    this.update(
      page(
        "Setup required",
        `<div class="card"><p>${escapeHtml(reason)}</p></div><p class="muted">This is an environment issue, not evidence about the student solution.</p>`,
      ),
      true,
    );
  }

  showQuestion(question: string, reason: string, canAskForMore: boolean): void {
    this.update(
      page(
        "A question, not a fix",
        `<p class="muted">The highlighted region may be worth inspecting. Socratic Runtime has not edited your file or supplied replacement code.</p><div class="card"><h2>${escapeHtml(question)}</h2></div><p class="why"><strong>Why now:</strong> ${escapeHtml(reason)}</p><div class="actions"><button data-action="investigating">I’m investigating</button>${canAskForMore ? '<button data-action="moreHelp">I need another nudge</button>' : ""}<button class="secondary" data-action="dismiss">Dismiss</button><button class="secondary" data-action="pauseHints">Pause hints</button></div>`,
        true,
      ),
      true,
    );
  }

  showCompletion(state: SessionState, referenceAvailable: boolean): void {
    const metrics: Array<[string, string | number]> = [
      [
        "Executable checks reported",
        state.latestVerification?.passedCount ?? 0,
      ],
      ["Learner file auto-saves", 0],
      ["Tutor file edits", state.tutorFileEdits],
      ["Tutor code supplied", `${state.tutorCodeLinesSupplied} lines`],
      ["Interventions shown", state.interventionsShown],
      ["Silent decisions", state.silentDecisions],
      ["Equivalent failures observed", state.equivalentFailureCount],
    ];
    this.update(
      page(
        "Verified complete",
        `<p>Executable checks accepted the implementation from an isolated snapshot. No claim about learning or cognition is made.</p><div class="card">${metrics
          .map(
            ([label, value]) =>
              `<div class="metric"><span>${escapeHtml(String(label))}</span><strong>${escapeHtml(String(value))}</strong></div>`,
          )
          .join(
            "",
          )}</div><details><summary>Optional reflection</summary><div class="card"><strong>Which invariant made your final strategy reliable across boundary cases?</strong></div></details>${referenceAvailable ? '<div class="actions"><button data-action="showReference">Compare with a reference approach</button></div><p class="muted">Available only because executable verification accepted your solution.</p>' : ""}`,
        referenceAvailable,
      ),
      true,
    );
  }

  showReferenceSolution(
    title: string,
    code: string,
    explanation: string,
    complexity: string,
  ): void {
    this.update(
      page(
        "Reference comparison",
        `<p class="muted">Your solution was already accepted. This author-provided example is for comparison, not replacement.</p><div class="card"><h2>${escapeHtml(title)}</h2><pre><code>${escapeHtml(code)}</code></pre></div><div class="card"><h2>Why this approach</h2><p>${escapeHtml(explanation).replaceAll("\n", "<br>")}</p><p><strong>Complexity:</strong> ${escapeHtml(complexity)}</p></div>`,
      ),
      true,
    );
  }

  dispose(): void {
    this.actionEmitter.dispose();
  }
}

export function showPolicyComparison(state: SessionState | null): void {
  const panel = vscode.window.createWebviewPanel(
    "socraticPolicy",
    "Socratic Runtime — Policy Comparison",
    { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
    { enableScripts: false },
  );
  panel.webview.html = page(
    "Policy comparison",
    `<div class="card"><h2>Naive tutor</h2><p>Would intervene after the first failed check.</p></div><div class="card"><h2>Socratic Runtime</h2><p>Remained silent because the learner had not yet had a reasonable opportunity to self-correct.</p><p class="muted">Current trace: ${state ? `${state.silentDecisions} silent decisions; ${state.interventionsShown} intervention${state.interventionsShown === 1 ? "" : "s"}.` : "No active session."}</p></div>`,
  );
}

export function formatTrace(state: SessionState): string {
  const lines = state.eventHistory.map((item) => {
    const time = new Date(item.timestamp).toLocaleTimeString([], {
      hour12: false,
    });
    const details = item.details
      ? `\n          ${Object.entries(item.details)
          .map(([key, value]) => `${key}: ${String(value)}`)
          .join(" · ")}`
      : "";
    return `${time}  ${item.summary}${details}`;
  });
  return [
    `Socratic Runtime decision trace — ${state.sessionId}`,
    `Mode: ${state.mode === "guidance" ? "guidance-only" : state.mode} · Provider: ${state.providerMode}`,
    `Target: ${state.targetSymbol.name} (${state.targetSymbol.file}:${state.targetSymbol.line + 1})`,
    "",
    ...lines,
  ].join("\n");
}
