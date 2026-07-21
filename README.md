<p align="center">
  <img src="media/socratic-runtime-logo.png" alt="Socratic Runtime logo" width="260">
</p>

<h1 align="center">Socratic Runtime</h1>

<p align="center"><strong>OpenAI Build Week 2026 · Education</strong></p>

**An ambient programming tutor that watches the learning process, stays quiet during productive work, and asks one question when GPT-5.6 Luna judges that help would be useful.**

Socratic Runtime is a VS Code extension powered by Codex CLI. It is deliberately not a chatbot: the learner codes in their own file, and support appears in a small Learning Support view only when the model chooses to intervene. The same model follows the learner's trajectory until it considers the task complete, then ends the session and offers a reference solution for reflection.

## Try it

Prerequisites: VS Code, Codex CLI, and an existing ChatGPT/Codex sign-in. The extension uses that sign-in; there is no separate Socratic Runtime account or API key.

1. Download `socratic-runtime-0.3.0.vsix` from the GitHub release.
2. In VS Code, run **Extensions: Install from VSIX...** and reload when prompted.
3. Open any programming file. Put the exercise in an `@socratic-task` comment, or select the task text before starting. If neither is present, Luna proposes a task for confirmation.
4. Run **Socratic Runtime: Start on Current File** from the Command Palette (`Ctrl+Shift+P`).
5. Code normally. Two seconds after a meaningful edit stops, Luna medium evaluates the current file and recent trajectory.

No Python environment, test suite, hidden configuration, or project registration is required. The included binary-search file is only a demonstration.

```python
"""
@socratic-task
Implement binary search over a sorted list.

Requirements:
- Return a matching index.
- Return -1 when the target is absent.
- Do not use list.index().
- Aim for logarithmic time.
"""
```

## What happens during a session

- **Productive work:** remain silent.
- **A useful intervention point:** show one concise Socratic question and a notification.
- **The learner wants help sooner:** **Ask for a Nudge** is always available.
- **A later stall:** Luna may ask another question; there is no one-question budget.
- **Task appears complete:** end observation automatically and show a post-completion reference solution, explanation, and complexity comparison.

The extension never edits the learner's file. During active work it rejects answers containing code, complete solutions, or mechanical edit recipes. Model output is schema-validated and treated as untrusted.

## Why this exists

Programming assistants optimize for producing answers. Socratic Runtime explores a different interaction: use a capable coding model to protect the learner's own reasoning while still noticing when silence stops being useful.

The design is informed by established findings on active retrieval, productive struggle, feedback timing, and cognitive control. This is a neuroscience- and learning-science-informed product hypothesis—not a claim that this prototype has proven a neuroscientific or educational effect. A controlled learner study remains future work.

## Scope and honesty

GPT-5.6 Luna medium owns the pedagogical classification and judges apparent completion from source code, task requirements, diagnostics, and trajectory. The runtime does **not** execute learner code or prove functional correctness. That removes language- and toolchain-specific setup and permits alternative valid strategies, but it also means completion can be wrong. The UI says _Luna considers this complete_, not _verified correct_.

The contract is language-neutral and operates on VS Code text documents. Python is the polished demo; Java, JavaScript, C++, and other languages use the same path when Luna can interpret the file and task.

## Architecture

```text
current file + task + diagnostics + recent trajectory
                         |
                    2 s idle debounce
                         |
             Codex CLI / GPT-5.6 Luna medium
                         |
          remain silent | ask one question | complete
                                              |
                              post-completion reference
```

The host owns execution safety, cancellation, strict schemas, privacy bounds, and solution-leakage checks. It does not override Luna with confidence thresholds, retry counters, or language-specific verifiers.

## Development

```powershell
npm install
npm run verify
npm run test:live   # authenticated Codex; uses live model quota
```

`npm run verify` formats, lints, type-checks, runs unit and extension-host tests, audits package contents, creates the VSIX, and builds the judge bundle. `npm run test:live` is intentionally separate because it invokes the real model.

See [Judge guide](docs/JUDGE_GUIDE.md), [architecture](docs/ARCHITECTURE.md), [intervention policy](docs/INTERVENTION_POLICY.md), [privacy](docs/PRIVACY.md), and [limitations](docs/LIMITATIONS.md).

MIT licensed.
