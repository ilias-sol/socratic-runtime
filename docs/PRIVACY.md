# Privacy

Only the active file participates in a session. Each assessment may send its confirmed task, language identifier, filename, up to 30,000 characters of current source, a bounded prior revision/diff, capped VS Code diagnostics, and a short recent trajectory through the authenticated Codex CLI.

The extension does not crawl the workspace, read `.env` files, collect Git history, run learner code, or persist source packets. Temporary schema, skill, and response files are created with restricted permissions and removed after every call. Decision trace output contains decisions and timing for local inspection; it should not reproduce source code.

Users should not start a session on files they are not permitted to send to the configured Codex service.
