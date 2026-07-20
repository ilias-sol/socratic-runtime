# Judge guide

## Fast path

1. Install VS Code 1.95 or newer, Python 3.10 or newer, and the Codex CLI.
2. Download and install the release `.vsix` with **Extensions: Install from VSIX**; no Node.js build is required.
3. Download or clone the repository so the bundled exercise workspace is available.
4. From the repository, create the demonstration environment with Python:

   ```powershell
   python -m venv sample-workspace/binary-search/.venv
   .\sample-workspace\binary-search\.venv\Scripts\python.exe -m pip install -r .\sample-workspace\binary-search\requirements.txt
   ```

5. Confirm `codex login status` succeeds.
6. Open `sample-workspace/binary-search`, trust it, and open `binary_search.py`. This is the learner's working file, not a reference answer.
7. Run **Socratic Runtime: Start Session**.
8. Review and approve the exact verifier command.
9. Use the prepared `demo-states` as successive learner revisions.
10. Inspect **Decision Trace** after each check.

If a release asset is unavailable, developers may instead run `npm install`, `npm run setup`, and `npm run package` to build the same VSIX locally.

The trace records objective verification, GPT-5.6 learner state and progress, model action, confidence, provider/model identity, local safety decision, and fallback without retaining learner source.

Pedagogical decisions are live model outputs, so exact wording is not guaranteed. Executable checks—not GPT confidence—establish completion. If Codex is unavailable, the extension reports **Sign-in Required** and does not substitute a recorded response.

Repository verification includes 20 replay cases, 102 TypeScript tests, four Python exercise families, nine accepted strategies, four rejected defects, and an Extension Host smoke test with 10 registered commands.
