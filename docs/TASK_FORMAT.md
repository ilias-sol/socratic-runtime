# Task and verifier format

Place an explicit `@socratic-task` block immediately above the target function, method, or class.

```python
"""
@socratic-task
Implement binary search over a sorted list.
"""
def binary_search(values, target):
    pass
```

Supported task markers include Python triple quotes, contiguous `#`, `//`, or `--` comments, and `/* ... */` blocks. With multiple markers, cursor proximity selects the task. **Start Session from Selection** is an explicit fallback and still requires a detectable following symbol. **Copy Selection as Task Marker** places a language-appropriate durable marker on the clipboard; the extension never inserts it into learner code.

Changing task text or its target association during a session switches the session to Guidance only and requires a new session before verification can resume. Task text is untrusted and never configures verification.

## Verifier configuration

Most learners do not need to write verifier configuration by hand. For detected pytest, Vitest, Jest, and Node test-runner projects, run **Socratic Runtime: Run Setup Doctor**, choose **Configure detected verifier**, and select the proposed preset. Setup Doctor then writes a validated copy-mode `.socratic/exercise.json` for the detected target. Start Session still shows the exact generated command for separate approval before it can run.

Exercise authors can provide `.socratic/exercise.json` directly for other approved toolchains, custom harnesses, or an optional post-completion reference:

```json
{
  "version": 1,
  "id": "binary-search",
  "language": "python",
  "targetFile": "binary_search.py",
  "targetSymbol": "binary_search",
  "verification": {
    "type": "command",
    "command": ["${python}", "-m", "pytest", "-q"],
    "timeoutMs": 15000,
    "snapshotExtension": ".py",
    "workspaceStrategy": "copy"
  },
  "completion": {
    "referenceSolution": "reference/half-open.py",
    "title": "Reference approach",
    "explanation": "Why this approach is reliable.",
    "complexity": "O(log n) time and O(1) additional space."
  }
}
```

The command must be an argument array using an approved toolchain executable or workspace-local wrapper. With `workspaceStrategy: "snapshot"` (the default), the harness reads the isolated source from `${snapshot}` or `SOCRATIC_SNAPSHOT`. With `workspaceStrategy: "copy"`, the runtime creates a bounded disposable project, replaces the configured target with the unsaved revision, and runs ordinary repository tests from that copy. The bundled Python harness also supports `SOCRATIC_SOLUTION` for compatibility.

Task text and configuration remain separate trust domains: an `@socratic-task` block can describe the assignment but can never supply a command. Setup Doctor detection also never executes package scripts or bypasses command approval.

`completion` is optional. Its workspace-relative reference file is not read or shown until the learner's own snapshot passes executable verification. Completion metadata is bounded and HTML-escaped by the help view.

`targetFile` names the learner's editable working file. It does not imply that the file is already correct and may use any workspace-relative name chosen by the exercise author.
