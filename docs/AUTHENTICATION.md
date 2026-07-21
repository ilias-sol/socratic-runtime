# Authentication

Live learner-state assessment requires an installed Codex CLI with an active ChatGPT sign-in.

The extension checks `codex login status`. If the CLI is missing or signed out, it shows **Socratic: Sign-in Required** and can open a terminal running `codex login`. Verification can still run, but no fabricated or recorded response replaces GPT-5.6.

The extension never reads Codex authentication files, OAuth tokens, environment API keys, the OS credential store, or another extension's private API. It does not persist credentials and never asks the learner for an OpenAI API key.

**Socratic Runtime: Run Setup Doctor** reports whether Codex is installed and whether the existing ChatGPT sign-in is ready. It does not create a Socratic Runtime account, inspect credentials, or require separate registration.
