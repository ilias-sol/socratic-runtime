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

Supported task markers include Python triple quotes, contiguous `#`, `//`, or `--` comments, and `/* ... */` blocks. With multiple markers, cursor proximity selects the task. **Use Selection as Task** is an explicit fallback and still requires a detectable following symbol.

Changing task text or its target association during a session switches the session to Observation Only. Task text is untrusted and never configures verification.

Verified mode uses `.socratic/exercise.json`:

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
    "snapshotExtension": ".py"
  },
  "completion": {
    "referenceSolution": "reference/half-open.py",
    "title": "Reference approach",
    "explanation": "Why this approach is reliable.",
    "complexity": "O(log n) time and O(1) additional space."
  }
}
```

The command must be an argument array using an approved toolchain executable or workspace-local wrapper. The harness reads the isolated source from `${snapshot}` or `SOCRATIC_SNAPSHOT`. The bundled Python harness also supports `SOCRATIC_SOLUTION` for compatibility.

`completion` is optional. Its workspace-relative reference file is not read or shown until the learner's own snapshot passes executable verification. Completion metadata is bounded and HTML-escaped by the help view.

`targetFile` names the learner's editable working file. It does not imply that the file is already correct and may use any workspace-relative name chosen by the exercise author.
