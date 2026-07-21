# Judge guide

## Fast path

The recommended artifact is `socratic-runtime-judge-bundle.zip`. It contains the VSIX, demo workspace, setup script, and a numbered walkthrough, so the repository source and Node.js are not required.

1. Install VS Code 1.95 or newer, Python 3.10 or newer, and the Codex CLI.
2. Download `socratic-runtime-judge-bundle.zip` from the release and extract it.
3. From the extracted bundle directory, prepare the demonstration environment:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\setup-demo.ps1
   ```

4. Install the included `socratic-runtime-0.2.2.vsix` with **Extensions: Install from VSIX**.
5. Open `binary-search-demo`, trust the workspace, and open `binary_search.py`. This is the learner's working file, not a reference answer.
6. Run **Socratic Runtime: Start Session**.
7. Review and approve the exact verifier command.
8. Use the numbered files in `demo-states` as successive learner revisions. After any assessed failure, **Ask for a nudge** remains available even when GPT-5.6 preserves self-correction time.
9. Inspect **Decision Trace** after each check.

## Fresh-project path

To inspect the broader setup flow, open an ordinary Python/pytest repository containing an `@socratic-task` marker and run **Socratic Runtime: Run Setup Doctor**. The doctor checks workspace trust, the existing ChatGPT/Codex sign-in, task binding, target detection, and verifier readiness. Selecting the detected pytest preset makes Setup Doctor create a validated configuration; Start Session separately displays the exact command for approval. The unsaved target is then tested in a bounded disposable project copy while the original repository remains unchanged.

Without a supported verifier, the extension enters **Guidance only**. GPT-5.6 may compare revisions and ask a gated question, but the UI, trace, and result type cannot claim correctness or completion.

If the release asset is unavailable, developers may instead clone the repository and run `npm install`, `npm run setup`, and `npm run package` to build the same VSIX locally.

The trace records objective verification, GPT-5.6 learner state and progress, model action, confidence, provider/model identity, local safety decision, and fallback without retaining learner source.

Pedagogical decisions are live model outputs, so exact wording is not guaranteed. Executable checks—not GPT confidence—establish completion. If Codex is unavailable, the extension reports **Sign-in Required** and does not substitute a recorded response.

Repository verification includes 21 replay cases, 127 TypeScript tests including persistent-syntax, provider-consistency, first-nudge, production-state learner journeys, ordinary-test disposable-copy execution, four Python exercise families, nine accepted strategies, four rejected defects, and an Extension Host smoke test with 12 registered commands. The live probe additionally runs a novice sequence through real pytest evidence and GPT-5.6.
