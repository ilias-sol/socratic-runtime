# Model integration

All pedagogical calls use `gpt-5.6-luna` with `model_reasoning_effort="medium"` through Codex CLI. There is no fallback model and no hidden host threshold that changes a valid Luna decision.

The extension invokes Codex ephemerally, with a strict output schema, read-only sandbox, isolated temporary working directory, 45-second timeout, bounded output, and a reduced environment. The learner's project is not mounted as the model's working directory; only the bounded packet is supplied.

Three model operations share this configuration: task inference, trajectory assessment, and post-completion reference generation. Only assessment uses the active-session no-solution contract. Reference generation is permitted after the session has ended and is labeled accordingly.

Authentication comes from `codex login status` and the user's existing ChatGPT/Codex entitlement. Socratic Runtime stores no credentials.
