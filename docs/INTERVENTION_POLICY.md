# Intervention policy

Socratic Runtime asks the model to judge the whole trajectory, not count failures.

- **Remain silent** while the learner is making meaningful progress, experimenting, or plausibly self-correcting.
- **Ask one question** when focused attention, a prediction, an invariant, or a small thought experiment would unlock reasoning.
- **Complete** only when the current implementation appears to satisfy every explicit task requirement.

There is no fixed confidence threshold, mandatory silent period, or one-question budget. If a question helps and the learner later stalls on another issue, the loop can intervene again. An explicit nudge request strongly favors one useful question unless the task is already complete or evidence is genuinely insufficient.

During active learning, questions may not contain code, a complete solution, pseudocode that reconstructs one, a mechanical edit recipe, or hidden expected outputs. Alternative and inelegant but plausible strategies are accepted rather than forced toward a canonical implementation.
