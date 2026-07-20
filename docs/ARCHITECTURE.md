# Architecture

Socratic Runtime separates correctness evidence, pedagogical judgment, and safety enforcement.

```text
task marker + target symbol
          |
          v
approved shell-free verifier on an unsaved snapshot
          |
          v
objective pass/fail evidence
          |
          +---- pass ----> verified completion
          |
          +---- fail ----> minimized learner-state packet
                              |
                              v
                    Codex CLI / GPT-5.6
                              |
                              v
                 structured pedagogical decision
                              |
                              v
                    deterministic safety gate
                              |
                 silence or one gated support step
```

`src/taskParser.ts` associates explicit task markers with common function, method, or class declarations across several language shapes.

`src/exerciseConfig.ts` validates relative workspace paths, bounded argument arrays, supported executables, timeouts, and optional snapshot extensions. Task comments cannot configure execution.

`src/verification.ts` writes the unsaved target buffer to a disposable snapshot, runs the approved verifier with `shell: false`, removes credential-like environment variables, captures bounded output, and deletes the snapshot. Exit status is authoritative.

`src/packet.ts` relocates and extracts the current target body, caps its size, and builds a compact revision diff. `src/privacy.ts` abstracts verification and removes paths, test identifiers, quoted values, and numeric literals from diagnostic excerpts.

`src/providers.ts` invokes `codex exec` in an ephemeral read-only sandbox with a strict output schema. A new edit aborts the child process. Invalid, unavailable, timed-out, or unauthenticated providers fail to silence.

`src/policy.ts` collects objective evidence and enforces the local safety gate. It does not reclassify pedagogical progress.

`src/extension.ts` owns workspace trust, verifier approval, revision scheduling, deduplication, cancellation, UI state, session lifecycle, and verified completion.

The first question in a struggle episode is unsolicited and model-selected. Further support requires an explicit learner action and is capped at three total steps per episode. Verified completion may unlock a trusted exercise-authored reference comparison.
