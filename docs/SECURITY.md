# Security

## Execution boundary

- Verified mode requires a trusted VS Code workspace.
- The exact `.socratic/exercise.json` verifier is shown for explicit approval.
- Changing the verifier configuration invalidates its approval.
- Commands run as bounded argument arrays with `shell: false`.
- Relative path traversal, unknown fields, inline interpreter evaluation, and `npx` auto-downloads are rejected.
- The verifier receives a disposable unsaved snapshot and a time limit. Cancellation terminates the owned process tree on Windows.
- Environment variables whose names indicate tokens, secrets, passwords, API keys, or authentication are removed before verifier launch.

## Untrusted inputs

Task text, learner code, diagnostics, verifier output, retained state, and model output are treated as untrusted data. Task comments never configure execution. Model instructions label the packet as data and run in a read-only sandbox.

## Model-output boundary

Model output must match a strict schema. The deterministic gate normalizes encoded text and enforces confidence, alternative-strategy, leakage, question-shape, length, cooldown, and episode constraints. It rejects code, recipes, links, Markdown, hidden-test details, and multiple questions.

New edits cancel stale verification or Codex work. Duplicate source/evidence pairs are not reassessed unless the learner explicitly requests a bounded follow-up nudge. Provider errors fail to silence.

Optional reference comparisons are exercise-authored workspace files declared in the validated configuration. They are size-bounded, HTML-escaped, included in the approval fingerprint, and unavailable until executable verification passes.
