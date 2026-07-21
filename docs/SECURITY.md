# Security

Learner source, comments, task text, diagnostics, and model output are untrusted data.

- No learner or task content is executed.
- Codex runs without a shell, in a read-only sandbox and isolated temporary directory.
- Only a small environment allowlist is forwarded.
- Requests time out and are cancelled when a newer edit makes them stale.
- JSON schemas and validators reject unexpected fields and malformed actions.
- Active-session questions receive a final solution-leakage screen.
- The extension never writes learner files.

The post-completion reference is model-generated and may be imperfect. It is displayed as comparison material, never applied automatically.
