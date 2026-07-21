# Intervention policy

The packet describes observable development behavior, not cognition.

| Model-assessed trajectory | Default action | Rationale |
| --- | --- | --- |
| First failure | `remain_silent` | Preserve a self-correction opportunity. |
| Fewer or different failures | `remain_silent` | Behavior changed meaningfully. |
| Temporary prints, assertions, or trace probes | `remain_silent` | An experiment is active. |
| First syntax or collection error | `remain_silent` | Do not force a conceptual interpretation from one malformed attempt. |
| Syntax or collection error persists | Assess the whole trajectory | If the trajectory establishes a stall, ask the smallest attention-directing question. |
| Equivalent failure repeated | Assess the whole trajectory | Repetition is evidence, not a verdict; if the model establishes a stall with no progress, it asks one minimal question. |
| Executable checks pass | No in-exercise intervention | Optional reflection may be offered. |

Block automatic intervention when confidence is below 0.70, alternative-strategy probability is at least 0.65, leakage risk exceeds 0.15, the short cooldown is active, or the current struggle episode already received a question. Meaningful progress opens a new episode. A learner may explicitly request up to two progressively more concrete follow-up nudges in the same episode; confidence, uncertainty, leakage, and question-shape gates remain mandatory.

Prefer actions in this order: silence, prediction, smallest experiment, evidence direction, invariant question. Never emit a sequence of questions.
