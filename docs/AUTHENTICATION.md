# Authentication

Socratic Runtime uses Codex CLI and its existing ChatGPT/Codex sign-in. The learner does not create a Socratic Runtime account, paste an API key, or register with another service.

At session start the extension runs `codex login status`. If Codex is missing or authentication is unavailable, it shows a clear error and does not start observation. Credentials remain owned by Codex; the extension neither reads nor stores them.
