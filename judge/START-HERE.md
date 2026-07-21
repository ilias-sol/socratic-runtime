# Socratic Runtime judge path

Socratic Runtime is a VS Code extension powered by the signed-in Codex CLI and GPT-5.6. The extension runs trusted executable checks locally, sends a minimized learner-state packet to Codex from a packet-only temporary workspace, and applies a deterministic safety gate before showing at most one concise question.

## Prepare the demo

From this bundle directory, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-demo.ps1
```

Then:

1. Install `socratic-runtime-0.2.0.vsix` with **Extensions: Install from VSIX**.
2. Open `binary-search-demo` in VS Code and trust the workspace.
3. Open `binary_search.py` and run **Socratic Runtime: Start Session**.
4. Review and approve the exact verifier command.
5. Copy the numbered files in `demo-states` into `binary_search.py` in sequence.

The live pedagogical wording may vary. The Decision Trace shows verification evidence, GPT-5.6 classification, the model-selected action, and the deterministic gate result. Executable checks—not model confidence—own completion.

For the fresh-project experience, open an ordinary pytest repository with an `@socratic-task` marker and run **Socratic Runtime: Run Setup Doctor**. It checks the existing ChatGPT/Codex sign-in, detects pytest, and can generate a disposable-copy verifier configuration after explicit approval. Without tests, the extension clearly enters Guidance-only mode and cannot claim correctness.
