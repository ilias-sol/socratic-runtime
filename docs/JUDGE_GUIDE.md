# Judge guide

The fastest evaluation path is in the release judge bundle and takes about two minutes: install the VSIX, open the provided `binary_search.py`, accept VS Code's standard workspace-trust prompt if shown, run **Socratic Runtime: Start on Current File**, and make a few edits with two-second pauses.

What to notice:

- One command starts on an ordinary file; there is no setup doctor, manifest, Python environment, API key, or new account.
- The task is discovered from the visible `@socratic-task` block.
- GPT-5.6 Luna medium can remain silent, ask one question, and later intervene again based on trajectory rather than counters.
- **Ask for a Nudge** is available even before an automatic question.
- The model accepts alternative strategies instead of comparing against one hidden implementation.
- When Luna considers the task complete, observation ends and a reference solution appears only then.
- **Open Luna Trace** makes decisions and latency inspectable.

The key tradeoff is explicit: this release favors near-zero language-specific setup and contextual model judgment over executable proof. It never labels completion as verified correctness.
