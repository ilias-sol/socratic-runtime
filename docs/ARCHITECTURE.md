# Architecture

The extension observes one active VS Code text document. It obtains the task from an `@socratic-task` comment, the current selection, or a Luna-generated proposal that the learner confirms. There are no exercise manifests or language toolchains.

After a meaningful edit, a two-second debounce builds a bounded assessment packet containing the task, language identifier, filename, prior and current source, compact diff, editor diagnostics, trajectory summary, recent decisions, and whether help was explicitly requested. A new edit cancels an in-flight request.

Codex CLI runs GPT-5.6 Luna with medium reasoning in an ephemeral, read-only temporary directory. A packaged `$socratic-runtime` skill supplies the teaching contract. Strict JSON schemas allow three actions: silence, one question, or completion.

Luna owns the semantic and pedagogical decision. Deterministic host code owns process timeouts, cancellation, output size, schema validation, environment minimization, and leakage screening. This boundary prevents a threshold system from second-guessing contextual teaching decisions while retaining safety controls.

Completion stops observation. A separate post-completion call produces reference code, explanation, and complexity material in the Learning Support view. It never writes the learner's file.
