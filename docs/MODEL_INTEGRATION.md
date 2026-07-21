# Model integration

The runtime uses non-interactive `codex exec` with the user's existing ChatGPT sign-in, an explicit GPT-5.6 model, medium reasoning, an ephemeral read-only sandbox, a packaged `$socratic-runtime` skill, and strict JSON Schema output. Each invocation runs from a random packet-only directory rather than the learner workspace.

`luna` is the default responsive mode. `sol` is the optional deeper mode. There is no recorded or offline tutoring mode.

For each new failed verified revision—or each new Guidance-only revision—GPT-5.6 compares the previous and current target, evidence change, redacted diagnostics, and recent trajectory. It explicitly classifies state and progress before selecting silence or an intervention. Guidance-only packets state that executable evidence is absent and forbid correctness or completion claims. The host does not preclassify Python progress or require a fixed failure count.

The action must agree with the model's own classification. Productive, experimenting, self-correcting, or uncertain states remain silent. A model-declared stall with no meaningful progress selects the smallest permitted question. If a response combines a repeated stall with silence, the provider requests one consistency reassessment; it does not reclassify the learner locally.

Packets contain the explicit task, language, target name and kind, capped previous/current target bodies, compact diff, eight recent events, abstracted current/previous verification, redacted diagnostic excerpt, episode state, permitted actions, and policy constraints.

Packets exclude credentials, unrelated files, dependency trees, raw keystrokes, exact hidden-test identities, and raw verifier output.

A new edit aborts an in-flight Codex process. Identical source/evidence pairs are assessed once per session. Missing authentication, unavailable models, timeout, invalid JSON, invalid schema, or cancellation returns a silent fallback.

An explicit learner request may assess the current failed revision again without rerunning the verifier. The request is available after every assessed failure, including an automatic silent decision. The packet marks the request and narrows permitted actions toward a progressively more concrete nudge. This path remains bounded to three support steps per episode and uses the same schema and leakage gate.
