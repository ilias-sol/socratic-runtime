# Privacy

Live assessment sends a minimized packet to GPT-5.6 through the official local Codex CLI under the user's existing ChatGPT/Codex policies.

The packet includes the explicit task, language, target name and kind, capped previous/current target bodies, compact diff, recent redacted events, aggregate verification state, and a diagnostic excerpt scrubbed of paths, test identifiers, quoted values, and numeric literals.

It excludes credentials, unrelated files, dependency trees, raw keystrokes, exact hidden-test identities, and raw verifier output.

An author-provided reference comparison is read locally only after verified completion and is not added to the GPT learner-state packet.

The extension never reads Codex authentication files, OAuth tokens, environment API keys, or the OS credential store. Session retention is disabled by default. When enabled, a redacted allowlist omits learner code, task text, question text, verifier output, file paths, symbols, and test identities.
