<p align="center">
  <img src="media/socratic-runtime-logo.png" alt="Socratic Runtime logo" width="300">
</p>

<h1 align="center">Socratic Runtime</h1>

<p align="center"><strong>An abstention-first IDE tutor that protects productive struggle.</strong></p>

<p align="center">OpenAI Build Week 2026 · Education</p>

Socratic Runtime is a VS Code extension for programming learners. It checks real coding attempts, asks GPT-5.6 to classify the learner's observable trajectory, and intervenes only when the evidence supports a credible stall. Silence is a deliberate product action—not a missing response.

The extension never inserts learner code, never treats model confidence as proof of correctness, and never reveals a solution during an active exercise. Executable checks establish completion. After a verified pass, an exercise may offer an optional author-written reference comparison.

> **Current scope:** Socratic Runtime works in prepared exercise workspaces containing a trusted verifier configuration. It is not a drop-in tutor for an arbitrary Python file. Python and pytest are the fully tested demonstration path.

## Why it is different

| Conventional coding assistant             | Socratic Runtime                            |
| ----------------------------------------- | ------------------------------------------- |
| Responds whenever invoked                 | Can explicitly choose silence               |
| Optimizes for producing an answer         | Protects space for self-correction          |
| May infer correctness from generated text | Requires executable verification            |
| Often reveals implementation details      | Permits one short, leakage-checked question |
| Treats failures as isolated events        | Compares progress across revisions          |

The design separates three responsibilities:

- **The verifier** establishes objective pass or fail evidence.
- **GPT-5.6** classifies progress and selects silence or a minimal Socratic action.
- **The deterministic host** controls execution, privacy reduction, uncertainty thresholds, episode limits, and leakage safety.

## How it works

```text
unsaved target revision
        |
        v
approved verifier runs an isolated snapshot
        |
        +---- pass ----> verified completion
        |                    |
        |                    +--> optional author reference
        |
        +---- fail ----> minimized learner-state packet
                             |
                             v
                    GPT-5.6 via Codex CLI
                             |
                             v
                  deterministic safety gate
                             |
                    silence or one question
```

There is no fixed “third failure” trigger. Progress, experimentation, uncertainty, and plausible alternative strategies normally produce silence. A credible repeated stall may produce one concise question and a temporary editor attention cue.

If the learner remains stuck, **I need another nudge** can request up to two progressively narrower follow-ups. Meaningful progress opens a new struggle episode. Editing cancels stale work, unchanged code is not rechecked, and elapsed time alone never counts as struggle.

## How an exercise declares the task

The exercise places a human-readable `@socratic-task` block immediately above the function, method, or class the learner should implement:

```python
"""
@socratic-task
Implement binary search over a sorted list.
"""
def binary_search(values, target):
    pass
```

This marker gives Socratic Runtime the assignment text and associates it with the following symbol. Python triple-quoted strings, contiguous `#`, `//`, or `--` comments, and `/* ... */` blocks are supported. If a file contains multiple tasks, cursor proximity selects the active one; **Socratic Runtime: Use Selection as Task** is an explicit fallback.

The task block and verifier configuration have deliberately separate responsibilities:

- `@socratic-task` describes what the learner is trying to implement.
- `.socratic/exercise.json` names the editable target and defines the approved verifier and optional post-completion reference.

Task text is treated as untrusted content. It can never configure or execute a command. A prepared `.socratic/exercise.json` remains required for verified tutoring, executable completion, and the optional reference comparison.

## Install the extension

Installing a release does **not** require Node.js, `npm install`, or `npm run setup`.

### Requirements

- Windows 10 or 11; macOS and Linux have not yet been release-tested
- VS Code 1.95 or newer
- An installed and authenticated Codex CLI
- Network access and GPT-5.6 model entitlement
- A prepared exercise workspace with its own tests, toolchain, and `.socratic/exercise.json`

### Installation

1. Download the `.vsix` attached to the project release.
2. In VS Code, run **Extensions: Install from VSIX**.
3. Reload VS Code and open a prepared exercise workspace.
4. Trust the workspace and confirm `codex login status` succeeds.
5. Open the configured target and run **Socratic Runtime: Start Session**.
6. Inspect and approve the exact verifier command shown by the extension.

The extension never installs exercise dependencies on the learner's behalf.

## Test the release without rebuilding

The release asset and bundled binary-search workspace give judges a complete test path without Node.js or a source build:

1. Download the release `.vsix` and the repository source archive.
2. Install the `.vsix` with **Extensions: Install from VSIX**.
3. From the extracted repository, create the demo's Python environment:

   ```powershell
   python -m venv sample-workspace/binary-search/.venv
   .\sample-workspace\binary-search\.venv\Scripts\python.exe -m pip install -r .\sample-workspace\binary-search\requirements.txt
   ```

4. Open `sample-workspace/binary-search` in VS Code, trust it, and open `binary_search.py`.
5. Run **Socratic Runtime: Start Session**, review the verifier command, and approve it.
6. Copy the prepared `demo-states` into the learner file in sequence to exercise first failure, progress, repeated struggle, and verified completion.

`binary_search.py` is the learner's editable working file, not a supplied answer. For expected observations and troubleshooting, use the shorter [Judge guide](docs/JUDGE_GUIDE.md).

## Build and verify from source

Source development requires Node.js 20 or newer and Python 3.10 or newer.

```text
npm install
npm run setup
npm run verify
npm run package
```

`npm run setup` creates only the bundled demo's Python environment. It is not an extension installation step.

## Privacy and safety

The model receives a target-scoped packet: the explicit task, target name and kind, capped previous/current target bodies, compact diff, recent redacted events, aggregate verification evidence, and a scrubbed diagnostic excerpt.

It does not receive unrelated files, dependency trees, raw keystrokes, credentials, exact hidden-test identities, raw verifier output, or the optional reference solution.

The extension also:

- requires workspace trust and approval of the exact verifier configuration;
- runs bounded commands with `shell: false` and removes credential-like environment variables;
- checks unsaved code in disposable snapshots without saving learner files;
- invokes Codex in an ephemeral read-only sandbox;
- rejects malformed output, code, recipes, links, hidden-test disclosure, and multiple questions;
- retains no session by default and uses a redacted allowlist when retention is enabled.

See [Privacy](docs/PRIVACY.md) and [Security](docs/SECURITY.md) for the exact boundaries.

## Verification

`npm run verify` covers formatting, linting, types, 102 automated TypeScript tests, 20 synthetic traces, four Python exercise families, nine accepted strategies, four rejected defects, timing simulations, Extension Host activation, package auditing, and VSIX creation.

The dependency audit reports no known vulnerabilities. These checks verify implementation behavior; they do not prove tutoring efficacy or human learning outcomes.

## Scope and limitations

- Packaged behavior is tested on Windows; macOS and Linux remain unverified.
- Live assessment requires Codex authentication, network access, and model availability.
- A model can misclassify observable behavior; conservative thresholds reduce but do not eliminate that risk.
- Progressive support stops after three questions in one episode and directs a still-stuck learner toward human help.
- The timing simulations are deterministic software tests, not a human-subject usability study.

Exercise authors can review the [task and verifier format](docs/TASK_FORMAT.md). Additional technical detail is available in [Architecture](docs/ARCHITECTURE.md), [Intervention policy](docs/INTERVENTION_POLICY.md), [Model integration](docs/MODEL_INTEGRATION.md), [Evaluation](docs/EVALUATION.md), and [Limitations](docs/LIMITATIONS.md).

## Built with Codex and GPT-5.6

Codex was the primary engineering collaborator during OpenAI Build Week and accelerated work across the complete extension lifecycle:

| Area                | Codex contribution                                                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Architecture        | Traced the end-to-end runtime, pressure-tested the intervention policy, and separated model judgment from deterministic execution and safety controls.     |
| Implementation      | Built and refined the VS Code session flow, unsaved snapshot verification, progressive-help UI, cancellation, redaction, persistence, and packaging paths. |
| Verification        | Generated adversarial cases, alternative correct strategies, beginner-timing simulations, privacy checks, Extension Host tests, and the release audit.     |
| Release preparation | Reviewed the UI and documentation, audited dependencies and publishable files, packaged the VSIX, and checked the judge installation path.                 |

The key product decisions remained explicit: executable tests—not model confidence—own correctness; the runtime abstains while progress remains plausible; only one question appears automatically per struggle episode; follow-ups require learner action; learner files are never written; and an author reference is available only after a verified pass.

At runtime, GPT-5.6 performs live learner-trajectory classification through the signed-in Codex CLI. Its output is treated as an untrusted pedagogical candidate and must pass deterministic schema, confidence, uncertainty, episode, and leakage gates before anything is shown.

## License

[MIT](LICENSE)
