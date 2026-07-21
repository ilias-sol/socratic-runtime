import * as vscode from "vscode";
import { isHelpAction, type HelpAction } from "./helpActions.js";
import type { RuntimeSession } from "./types.js";

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );
}

function page(title: string, body: string, scripted = false): string {
  const nonce = Math.random().toString(36).slice(2);
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src ${scripted ? `'nonce-${nonce}'` : "'none'"}"><style>
body{font-family:var(--vscode-font-family);padding:16px;color:var(--vscode-foreground)}h1{font-size:20px;margin:0 0 12px}h2{font-size:15px}.muted{color:var(--vscode-descriptionForeground)}.card{border:1px solid var(--vscode-panel-border);border-radius:8px;padding:13px;margin:12px 0}.question{border-left:3px solid var(--vscode-editorWarning-foreground)}.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}button{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:0;padding:7px 10px;border-radius:2px;cursor:pointer}button.secondary{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:var(--vscode-textCodeBlock-background);padding:12px;border-radius:4px}.metric{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--vscode-panel-border)}</style></head><body><h1>${escapeHtml(title)}</h1>${body}${scripted ? `<script nonce="${nonce}">const vscode=acquireVsCodeApi();document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>vscode.postMessage({action:button.dataset.action})));</script>` : ""}</body></html>`;
}

const activeActions = (paused = false): string =>
  `<div class="actions"><button data-action="askForNudge">Ask for a nudge</button><button class="secondary" data-action="${paused ? "resume" : "pause"}">${paused ? "Resume" : "Pause"}</button><button class="secondary" data-action="endSession">End session</button></div>`;

export class LearningSupportView
  implements vscode.WebviewViewProvider, vscode.Disposable
{
  static readonly id = "socraticRuntime.support";
  private readonly emitter = new vscode.EventEmitter<HelpAction>();
  readonly onDidAction = this.emitter.event;
  private view: vscode.WebviewView | null = null;
  private html = page(
    "Socratic Runtime",
    '<p class="muted">Open a programming file and run <strong>Socratic Runtime: Start on Current File</strong>.</p>',
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
      if (isHelpAction(action)) this.emitter.fire(action);
    });
    view.onDidDispose(() => (this.view = null));
  }

  private update(html: string, reveal = false): void {
    this.html = html;
    if (!this.view) return;
    this.view.webview.html = html;
    if (reveal) this.view.show?.(true);
  }

  showInactive(): void {
    this.update(
      page(
        "Socratic Runtime",
        '<p class="muted">Run <strong>Socratic Runtime: Start on Current File</strong>. No project setup or local tests are required.</p>',
      ),
    );
  }

  showStarting(detail: string): void {
    this.update(
      page(
        "Starting Socratic Runtime",
        `<p class="muted">${escapeHtml(detail)}</p>`,
      ),
      true,
    );
  }

  showObserving(session: RuntimeSession): void {
    this.update(
      page(
        session.phase === "paused"
          ? "Session paused"
          : "Watching your revisions",
        `<div class="card"><strong>${escapeHtml(session.task.summary)}</strong><p class="muted">${escapeHtml(session.fileName)} · ${escapeHtml(session.languageId)} · GPT-5.6 Luna medium</p></div><p class="muted">${session.phase === "paused" ? "No assessments will run until you resume." : "A meaningful revision is assessed two seconds after you stop typing. Silence means Luna believes your current process should continue uninterrupted."}</p>${activeActions(session.phase === "paused")}`,
        true,
      ),
    );
  }

  showAssessing(session: RuntimeSession, explicitHelp: boolean): void {
    this.update(
      page(
        explicitHelp ? "Preparing a nudge" : "Assessing this revision",
        `<p class="muted">GPT-5.6 Luna is comparing the current code with your task and recent trajectory. Keep coding if you already know what to try; a new edit cancels this assessment.</p><div class="card"><strong>${escapeHtml(session.task.summary)}</strong></div>`,
      ),
    );
  }

  showQuestion(
    session: RuntimeSession,
    question: string,
    reason: string,
  ): void {
    this.update(
      page(
        "A question, not a solution",
        `<div class="card question"><h2>${escapeHtml(question)}</h2></div><p class="muted">${escapeHtml(reason)}</p>${activeActions()}`,
        true,
      ),
      true,
    );
  }

  showCompleting(session: RuntimeSession): void {
    this.update(
      page(
        "Luna considers the task complete",
        `<div class="card"><strong>${escapeHtml(session.completionSummary ?? "The implementation appears to satisfy the stated task.")}</strong></div><p class="muted">The learning session has ended automatically. Preparing a post-completion reference approach…</p>`,
      ),
      true,
    );
  }

  showComplete(session: RuntimeSession, referenceError?: string): void {
    const reference = session.reference;
    this.update(
      page(
        "Task complete",
        `<div class="card"><strong>${escapeHtml(session.completionSummary ?? "Luna assessed the task as complete.")}</strong><div class="metric"><span>Questions shown</span><strong>${session.questionsShown}</strong></div><div class="metric"><span>Silent assessments</span><strong>${session.silentAssessments}</strong></div></div>${reference ? `<h2>${escapeHtml(reference.title)}</h2><pre><code>${escapeHtml(reference.code)}</code></pre><div class="card"><p>${escapeHtml(reference.explanation).replaceAll("\n", "<br>")}</p><p><strong>Complexity:</strong> ${escapeHtml(reference.complexity)}</p></div>` : `<p class="muted">${escapeHtml(referenceError ?? "No reference approach is available.")}</p>`}`,
      ),
      true,
    );
  }

  showError(message: string, session?: RuntimeSession): void {
    this.update(
      page(
        "Socratic Runtime needs attention",
        `<div class="card"><p>${escapeHtml(message)}</p></div>${session ? activeActions(session.phase === "paused") : ""}`,
        Boolean(session),
      ),
      true,
    );
  }

  dispose(): void {
    this.emitter.dispose();
  }
}
