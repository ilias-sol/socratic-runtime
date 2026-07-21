# Beginner journey fixtures

These full-file revisions drive the real-model simulation in `npm run test:live`:

1. `beginner-stub.py` — the unassessed session baseline.
2. `first-failure.py` — a meaningful first attempt.
3. `progress.py` — another attempt with a boundary obstacle.
4. `repeated-stall.py` — the boundary obstacle persists.
5. `persistent-stall.py` — the learner remains stuck after an intervention.
6. `correct-half-open.py` — a valid half-open binary search.

The expected contract is a trajectory containing genuine Luna-selected silence, at least one delivered Socratic question, completion, and a post-completion reference. Exact timing and wording remain live GPT-5.6 Luna medium decisions.
