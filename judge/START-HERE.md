# Judge quick start

The bundle contains the packaged extension and one plain Python demonstration file. Python does not need to be installed because Socratic Runtime does not execute learner code.

1. In VS Code, run **Extensions: Install from VSIX...** and choose `socratic-runtime-0.1.0.vsix`.
2. Reload VS Code, then open `binary-search-demo/binary_search.py`. Trust the folder if VS Code shows its standard workspace-trust prompt.
3. Confirm Codex CLI is installed and signed in with your existing ChatGPT/Codex account (`codex login status`). No new account or API key is needed.
4. Press `Ctrl+Shift+P` and run **Socratic Runtime: Start on Current File**.
5. Replace `pass` with a few beginner attempts. Pause for two seconds after each edit.

Watch the **Learning Support** panel. Luna should stay silent during plausible progress and ask one question when it judges that an intervention would help. **Ask for a Nudge** is always available. When Luna considers the exercise complete, observation stops and the tray shows a post-completion reference solution.

Exact intervention timing and wording are live model decisions. **Socratic Runtime: Open Luna Trace** shows the reason for every decision.
