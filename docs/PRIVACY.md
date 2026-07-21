# Privacy

Live assessment sends a minimized packet to GPT-5.6 through the official local Codex CLI under the user's existing ChatGPT/Codex policies.

The packet includes the explicit task, language, target name and kind, capped previous/current target bodies, compact diff, recent redacted events, aggregate verification state, and a diagnostic excerpt scrubbed of paths, test identifiers, quoted values, and numeric literals.

Guidance-only packets use bounded VS Code error/warning messages instead of executable results and explicitly mark `snapshotVerified: false`.

It excludes credentials, unrelated files, dependency trees, raw keystrokes, exact hidden-test identities, and raw verifier output.

The extension stages the packaged Socratic classification skill in a random temporary assessment directory and launches `codex exec` from that directory. The learner workspace is not the Codex working directory or readable workspace root. The subprocess environment is allowlisted for operating-system and Codex sign-in discovery variables; ambient API keys, repository tokens, database URLs, and application secrets are not inherited.

An author-provided reference comparison is read locally only after verified completion and is not added to the GPT learner-state packet.

Disposable-project verification is local and never becomes the Codex working directory. Copies exclude `.git`, dependency directories, caches, symlinks, common credential/key files, and size limits prevent unbounded collection. JavaScript `node_modules`, when present, is linked into the temporary verifier workspace but is not sent to GPT-5.6.

The extension never reads Codex authentication files, OAuth tokens, environment API keys, or the OS credential store. Session retention is disabled by default. When enabled, a redacted allowlist omits learner code, task text, question text, verifier output, file paths, symbols, and test identities.
