# Authentication

Socratic Runtime uses the learner's existing local Codex authentication. For users who already have Codex access through ChatGPT, this avoids a separate tutoring account, application API key, or hosted Socratic Runtime login.

Live learner-state assessment requires an installed Codex CLI with an active sign-in. The extension checks `codex login status`; if the CLI is missing or signed out, it shows **Socratic: Sign-in Required** and can open a terminal running `codex login`. Local executable verification can still run, but no fabricated or recorded response replaces GPT-5.6.

Codex CLI and the Codex IDE extension share cached local authentication. Socratic Runtime relies on the CLI's reported status rather than inspecting that cache.

The extension never reads Codex authentication files, OAuth tokens, environment API keys, the OS credential store, or another extension's private API. It does not persist credentials and never asks the learner for an OpenAI API key.

**Socratic Runtime: Run Setup Doctor** reports whether Codex is installed and signed in alongside the task and verifier checks. Authentication readiness is reported separately from executable correctness.
