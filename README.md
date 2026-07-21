<p align="center">
  <img src="media/socratic-runtime-logo.png" alt="Socratic Runtime logo" width="300">
</p>

<h1 align="center">Socratic Runtime</h1>

<p align="center"><strong>An abstention-first IDE tutor that protects productive struggle.</strong></p>

<p align="center">OpenAI Build Week 2026 · Education</p>

<p align="center"><strong>Powered by the Codex CLI and GPT-5.6.</strong> If you already have Codex access through ChatGPT, the extension reuses that local Codex sign-in—no Socratic Runtime account or application API key is required.</p>

Socratic Runtime is a VS Code extension for programming learners. It uses the local Codex CLI and an existing ChatGPT subscription sign-in, so there is no separate Socratic Runtime registration, application API key, hosted tutoring backend, or learning platform. The extension follows real coding attempts, asks GPT-5.6 to classify the learner's observable trajectory, and intervenes only when the evidence supports a credible stall. Silence is a deliberate product action—not a missing response.

The extension is the local runtime: it runs the approved executable verifier, constructs a minimized learner-state packet, invokes `codex exec` from an isolated packet-only workspace, and applies deterministic schema, uncertainty, episode, and leakage gates before anything reaches the learner. Codex supplies model-led pedagogical judgment; the host retains authority over execution and safety.

The extension never inserts learner code, never treats model confidence as proof of correctness, and never reveals a solution during an active exercise. Executable checks establish completion. After a verified pass, an exercise may offer an optional author-written reference comparison.

> **Current scope:** The runtime contract is language-neutral and accepts approved, bounded verifier commands for toolchains including Java, Maven, Gradle, .NET, Rust, and Go. Setup Doctor currently generates presets for pytest, Vitest, Jest, and Node's test runner. Python and pytest remain the fully exercised end-to-end demonstration path; other toolchains require author configuration and should not be read as equally validated.

## Install the packaged extension

1. Download `socratic-runtime-0.2.2.vsix` from the [latest release](https://github.com/ilias-sol/socratic-runtime/releases/latest).
2. In VS Code, run **Extensions: Install from VSIX** and select the downloaded file.
3. Reload VS Code when prompted.

That is the complete extension installation. Node.js and `npm` are needed only to build from source, not to install the packaged release.

### Runtime requirements

- Windows 10 or 11; macOS and Linux have not yet been release-tested
- VS Code 1.95 or newer
- An installed and authenticated Codex CLI
- Network access and GPT-5.6 model entitlement
- A source file with a detectable task; supported tests or an author-provided verifier are additionally required for Verified mode

## Start a session

1. Open a source file inside a trusted VS Code workspace.
2. Place an `@socratic-task` problem statement directly above the target function, method, or class—or select the assignment and run **Start Session from Selection**.
3. Run **Socratic Runtime: Run Setup Doctor**.
4. If Setup Doctor detects pytest, Vitest, Jest, or Node's test runner, choose **Configure detected verifier** and select the proposed preset. Setup Doctor creates `.socratic/exercise.json` for the detected target.
5. Start the session and separately approve the exact shell-free verifier command before it can run.

You do not need to hand-write `.socratic/exercise.json` for a detected preset. Setup Doctor reports workspace trust, Codex availability, the existing ChatGPT sign-in, task binding, target detection, and verifier readiness. Detection never runs a command: creating the configuration and approving its exact verifier are two visible learner-controlled actions. If no supported verifier is detected, the learner can use **Guidance only** or an exercise author can provide a bounded configuration for another toolchain. Guidance-only sessions may compare revisions and ask a leakage-checked question, but cannot claim correctness or completion.

## Why this is not just another coding assistant

Most coding assistants optimize the current request: explain, suggest, or generate. Socratic Runtime instead manages **when assistance should enter an active learning process**. After the learner starts a session, it observes bounded evidence across revisions and treats silence as a successful product action when self-correction remains productive.

| Conventional coding assistant                 | Socratic Runtime                                            |
| --------------------------------------------- | ----------------------------------------------------------- |
| Responds when prompted                        | May deliberately remain silent                              |
| Optimizes for producing a useful answer       | Protects room for learner-generated reasoning               |
| May let the model estimate correctness        | Gives executable verification sole completion authority     |
| Can reveal implementation details immediately | Shows one gated question; follow-ups require learner action |
| Usually reacts to the current snapshot        | Compares evidence and progress across revisions             |

GPT-5.6 owns the pedagogical judgment—productive progress, experimentation, uncertainty, or credible stall—but it never gains authority over execution or completion. The deterministic host owns command approval, isolation, schema validation, uncertainty thresholds, intervention limits, privacy reduction, and solution-leakage blocking.

The design separates three responsibilities:

- **The verifier** establishes objective pass or fail evidence.
- **GPT-5.6** classifies progress and selects silence or a minimal Socratic action.
- **The deterministic host** controls execution, privacy reduction, uncertainty thresholds, episode limits, and leakage safety.

## Research-grounded product hypothesis

Research on cognitive interference, including the established [Stroop effect](https://doi.org/10.1037/h0054651), shows that competing information can disrupt goal-directed processing. Research on the [generation effect](https://doi.org/10.1037/0278-7393.4.6.592) and [productive failure](https://doi.org/10.1080/07370000802212669) provides a separate basis for letting learners generate and test an attempt before instruction. Socratic Runtime translates these findings into an engineering hypothesis: avoid adding solution-level guidance while observable work remains productive, then introduce minimal assistance when progress credibly stalls.

The cited research motivates the policy; it does not prove that this particular coding intervention improves learning. The hackathon prototype validates that the policy can be implemented and safety-gated in a live IDE. Establishing educational benefit would require controlled learner evaluation with delayed retention and transfer measures, not only task completion.

## How it works

```text
unsaved target revision
        |
        +---- approved verifier ----> isolated snapshot/project copy
        |                                      |
        |                       +---- pass ----> verified completion
        |                       |                    |
        |                       |                    +--> optional author reference
        |                       |
        |                       +---- fail ----+
        |                                        |
        +---- no verifier ----> guidance only ---+
                                                 |
                                                 v
                                   minimized learner-state packet
                                                 |
                                                 v
                                    GPT-5.6 via Codex CLI
                                                 |
                                                 v
                                      deterministic safety gate
                                                 |
                                       silence or one question
```

There is no fixed “third failure” trigger. Progress, experimentation, uncertainty, and plausible alternative strategies normally produce silence. Once GPT-5.6 establishes a credible stall with no meaningful progress, it selects one concise question and the host applies the safety gate. A contradictory `stalled`-but-silent response is reassessed once rather than silently abandoning the learner.

After any assessed failed revision, **Ask for a nudge** remains available even when the automatic decision is silence. After the first question, **I need another nudge** can request progressively narrower follow-ups. Each struggle episode allows at most three total support steps. Meaningful progress opens a new episode. Editing cancels stale work, unchanged code is not rechecked, and elapsed time alone never counts as struggle.

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

This marker gives Socratic Runtime the assignment text and associates it with the following symbol. Python triple-quoted strings, contiguous `#`, `//`, or `--` comments, and `/* ... */` blocks are supported. If a file contains multiple tasks, cursor proximity selects the active one; **Socratic Runtime: Start Session from Selection** is an explicit fallback.

The task block and verifier configuration have deliberately separate responsibilities:

- `@socratic-task` describes what the learner is trying to implement.
- `.socratic/exercise.json` names the editable target and defines the approved verifier and optional post-completion reference.

For supported pytest, Vitest, Jest, and Node test-runner projects, Setup Doctor can generate `.socratic/exercise.json` after the learner selects a detected preset. Manual author configuration remains available for other approved toolchains and optional post-completion references.

Task text is treated as untrusted content. It can never configure or execute a command. A validated `.socratic/exercise.json` remains required for verified tutoring, executable completion, and the optional reference comparison; Guidance-only mode remains available without one.

**Copy Selection as Task Marker** turns selected problem text into a language-appropriate marker on the clipboard. The learner remains in control of the file: the extension never inserts or edits learner code.

## Try the prepared demonstration

The recommended judge bundle contains the packaged extension, binary-search workspace, setup script, and numbered walkthrough in one download:

1. Download `socratic-runtime-judge-bundle.zip` from the [latest release](https://github.com/ilias-sol/socratic-runtime/releases/latest) and extract it.
2. From the extracted bundle directory, create the demo environment and check Codex readiness:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\setup-demo.ps1
   ```

3. Install the included `socratic-runtime-0.2.2.vsix` with **Extensions: Install from VSIX**.
4. Open `binary-search-demo` in VS Code, trust the workspace, and open `binary_search.py`.
5. Run **Socratic Runtime: Start Session**, review the exact verifier command, and approve it.
6. Copy the numbered files in `demo-states` into `binary_search.py` in sequence to exercise first failure, progress, repeated struggle, and verified completion.

`binary_search.py` is the learner's editable working file, not a supplied answer. The extension never installs dependencies for an ordinary learner project; `setup-demo.ps1` prepares only this bundled demonstration. See the [Judge guide](docs/JUDGE_GUIDE.md) for expected observations and troubleshooting.

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

The model receives a target-scoped packet: the explicit task, target name and kind, capped previous/current target bodies, compact diff, recent redacted events, aggregate verification evidence, and a scrubbed diagnostic excerpt. The Codex process runs from a disposable packet-only workspace containing the packaged Socratic classification skill, not from the learner workspace.

It does not receive unrelated files, dependency trees, raw keystrokes, credentials, exact hidden-test identities, raw verifier output, or the optional reference solution.

The extension also:

- requires workspace trust and approval of the exact verifier configuration;
- runs bounded commands with `shell: false` and removes credential-like environment variables;
- checks unsaved code in disposable snapshots without saving learner files;
- can copy an ordinary project into a bounded temporary workspace, replace only the copied target with the unsaved revision, run approved tests there, and delete the copy;
- invokes Codex in an ephemeral read-only sandbox from a packet-only working directory and a credential-reduced environment;
- rejects malformed output, code, recipes, links, hidden-test disclosure, and multiple questions;
- persists no session by default and uses a redacted allowlist when retention is enabled.

See [Privacy](docs/PRIVACY.md) and [Security](docs/SECURITY.md) for the exact boundaries.

## Verification

`npm run verify` covers formatting, linting, types, 127 automated TypeScript tests including novice syntax stalls, provider consistency retry, first-nudge availability, a production-state learner journey, and disposable-project execution; 21 synthetic traces; four Python exercise families; nine accepted strategies; four rejected defects; timing simulations; Extension Host activation; package auditing; VSIX creation; and the one-download judge bundle.

These checks verify implementation behavior and release composition; they do not prove tutoring efficacy or human learning outcomes.

## Scope and limitations

- Python and pytest are the fully exercised demonstration. Vitest, Jest, and Node test-runner presets depend on each repository's existing scripts and dependencies. Java task parsing and bounded Java, Maven, and Gradle verifier configurations are supported in the contract, but no Java project has completed the full end-to-end certification matrix yet.
- Disposable verification excludes repositories, dependencies, caches, symlinks, common secret files, and workspaces above 50,000 copied files or 256 MB. JavaScript dependencies are linked by location rather than copied.
- Packaged behavior is tested on Windows; macOS and Linux remain unverified.
- Live assessment requires Codex authentication, network access, and model availability.
- A model can misclassify observable behavior; conservative thresholds reduce but do not eliminate that risk.
- Progressive support stops after three questions in one episode and directs a still-stuck learner toward human help.
- The timing simulations are deterministic software tests, not a human-subject usability study.

## Documentation

| Document                                                    | Purpose                                                              |
| ----------------------------------------------------------- | -------------------------------------------------------------------- |
| [Judge guide](docs/JUDGE_GUIDE.md)                          | Fast demonstration path and expected evidence                        |
| [Task and verifier format](docs/TASK_FORMAT.md)             | Setup Doctor output and manual exercise-author configuration         |
| [Architecture](docs/ARCHITECTURE.md)                        | Runtime components and authority boundaries                          |
| [Product invariants](docs/PRODUCT_INVARIANTS.md)            | Non-negotiable behavior the implementation must preserve             |
| [Intervention policy](docs/INTERVENTION_POLICY.md)          | Model decisions, abstention rules, follow-ups, and leakage gates     |
| [Model integration](docs/MODEL_INTEGRATION.md)              | Live Codex invocation, packet shape, cancellation, and fallback      |
| [Authentication](docs/AUTHENTICATION.md)                    | Existing Codex sign-in and credential boundaries                     |
| [Privacy](docs/PRIVACY.md) and [Security](docs/SECURITY.md) | Data minimization, isolation, command approval, and untrusted inputs |
| [Evaluation](docs/EVALUATION.md)                            | Automated evidence and what it does not establish                    |
| [Limitations](docs/LIMITATIONS.md)                          | Current platform, language, verifier, and research boundaries        |

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
