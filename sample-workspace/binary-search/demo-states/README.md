# Demonstration sequence

Copy each file's complete contents into `binary_search.py`, preserving this order:

1. `first-failure.py` — an initial failing attempt; the model should normally preserve self-correction time.
2. `progress.py` — changed executable behavior; the runtime should remain silent while progress is plausible.
3. `repeated-stall.py` — a credible repeated boundary stall; one concise question may be shown.
4. `persistent-stall.py` — the same episode has already received an automatic question, so another must not appear unsolicited.
5. `correct-half-open.py` — executable checks pass and unlock the optional reference comparison.

Exact pedagogical wording is live GPT-5.6 output and is not recorded. Use **Socratic Runtime: Open Decision Trace** to inspect each classification and gate result.

For the novice stress path used by `npm run test:live`, begin with `beginner-syntax-1.py`, `beginner-syntax-2.py`, and `beginner-stub.py`, then continue with the numbered sequence above. This verifies that early malformed attempts retain self-correction time, a credible later stall receives a question, and the learner can always choose **Ask for a nudge** after an assessed failure.
