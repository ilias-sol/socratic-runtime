# Socratic Runtime engineering guide

Preserve the live, model-led product in `docs/PRODUCT_INVARIANTS.md`. The Python binary-search file is the primary demonstration; the runtime contract is language-neutral.

## Commands

- Install dependencies: `npm install`
- Mandatory offline verification: `npm run verify`
- Real Luna learner simulation: `npm run test:live`
- Extension-host smoke test: `npm run test:extension`
- Package: `npm run package`

Do not execute learner code or task-comment content. Never write learner files. Treat model output as an untrusted candidate. GPT-5.6 Luna medium owns pedagogical classification; deterministic host code owns process safety, schemas, cancellation, privacy bounds, and active-session solution-leakage prevention. Do not add host confidence thresholds, failure counters, or language-specific verification gates.

Use `$socratic-runtime` for the model's live pedagogical classification. There is no recorded tutoring mode.
