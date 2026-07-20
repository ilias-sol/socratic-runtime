# Intervention policy

The host sends every new failed target revision to GPT-5.6 with its previous target, compact diff, abstracted verification, redacted diagnostic excerpt, recent events, and intervention history.

GPT-5.6 returns:

- learner state: self-correcting, progressing, experimenting, stalled, or uncertain;
- progress assessment: meaningful, unclear, or none;
- action: remain silent, ask a prediction, suggest an experiment, direct attention, or ask about an invariant;
- confidence, alternative-strategy probability, leakage risk, reasons, and reevaluation trigger.

Silence is preferred whenever productive struggle remains plausible. A repeated failure is evidence, not an automatic stall. Only `stalled` with no meaningful progress can produce a question.

The local gate blocks an unsolicited intervention when confidence is below 0.70, alternative-strategy probability is at least 0.65, leakage risk exceeds 0.15, the short cooldown is active, or the current struggle episode already received a question.

After a question, the learner can explicitly request another nudge. An explicit request bypasses only cooldown and the one-unsolicited-question rule. The model receives a narrower set of progressively more concrete actions, while confidence, alternative-strategy, leakage, wording, and stall-consistency gates remain unchanged. Each episode permits at most three total support steps.

Before display, the gate normalizes Unicode and HTML entities and rejects code, assignments, return statements, mechanical solution recipes, Markdown, links, hidden-test disclosure, multiple questions, and text over 180 characters. Provider failure becomes silence.

After executable verification succeeds, an exercise may offer an author-provided reference implementation, explanation, and complexity note. This content is never model-generated and is unavailable during the exercise.
