# Architecture

Socratic Runtime separates correctness evidence, pedagogical judgment, and safety enforcement.

Setup Doctor first resolves workspace trust, the existing Codex sign-in, task binding, target symbol, and an approved verifier. Verified sessions follow the executable path below. Without a matching verifier, Guidance-only sessions send explicitly non-executable revision evidence through the same model and safety boundary but cannot reach verified completion.

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

`src/taskParser.ts` associates explicit task markers with common function, method, or class declarations across several language shapes and formats selected problem text as a durable clipboard marker without editing learner files.

`src/frameworkPresets.ts` detects bounded, evidence-backed pytest, Vitest, Jest, and Node test-runner presets. Setup Doctor reports readiness and writes a validated configuration only after an explicit learner action.

`src/exerciseConfig.ts` validates relative workspace paths, bounded argument arrays, supported executables, timeouts, and optional snapshot extensions. Task comments cannot configure execution.

`src/verification.ts` either writes the unsaved target buffer to a disposable snapshot or delegates to `src/workspaceCopy.ts` to create a bounded project copy and replace only the copied target. It runs the approved verifier with `shell: false`, removes credential-like environment variables, captures bounded output, and deletes the temporary workspace. Exit status is authoritative.

`src/guidance.ts` creates explicitly non-executable revision evidence from bounded editor diagnostics. Its result is structurally unable to pass or claim completion.

`src/packet.ts` relocates and extracts the current target body, caps its size, and builds a compact revision diff. `src/privacy.ts` abstracts verification and removes paths, test identifiers, quoted values, and numeric literals from diagnostic excerpts.

`src/providers.ts` stages the packaged Socratic skill in a disposable packet-only workspace, invokes `codex exec` there in an ephemeral read-only sandbox with a strict output schema and allowlisted environment, and removes the workspace afterward. The learner workspace is not exposed as the Codex working directory. A new edit aborts the child process. Invalid, unavailable, timed-out, or unauthenticated providers fail to silence.

`src/assessmentTransition.ts` is the shared production state transition used by both the extension and deterministic evaluation replay. It owns trajectory counters, struggle episodes, final silence/intervention accounting, and phase changes so evaluation fixtures cannot drift from runtime behavior.

`src/policy.ts` collects objective evidence and enforces the local safety gate. It does not reclassify pedagogical progress.

`src/extension.ts` owns Setup Doctor, preset selection, workspace trust, verifier approval, verified/guidance mode selection, revision scheduling, deduplication, cancellation, UI state, session lifecycle, and verified completion.

The first question in a struggle episode is unsolicited and model-selected. Further support requires an explicit learner action and is capped at three total steps per episode. Verified completion may unlock a trusted exercise-authored reference comparison.
