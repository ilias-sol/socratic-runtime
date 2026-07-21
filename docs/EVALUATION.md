# Evaluation

`npm run test:evals` replays 20 deterministic synthetic revision traces through the production evidence collector, scripted GPT-shaped decisions, strict schema validator, and safety gate.

The suite covers first failures, progress, experimentation, equivalent failures, alternative strategies, executable completion, malformed output, provider failure, authentication failure, leakage attempts, confidence thresholds, alternative-strategy uncertainty, question shape, cooldown, and intervention episodes.

Scripted decisions are test fixtures only. The production runtime uses live GPT-5.6. These tests prove deterministic implementation behavior; they do not prove model quality or human learning outcomes.

`npm run test:python` verifies four exercise families, accepts nine structurally valid strategies, and rejects four targeted defects. The TypeScript suite contains 121 tests across 19 files, including framework detection, generated configuration, task-marker formatting, Guidance-only non-completion, bounded disposable copies, secret/cache exclusion, and an ordinary Node test suite executing successfully against the copied unsaved target while the original source remains unchanged. `npm run test:extension` activates the production bundle in an isolated Extension Host and confirms 12 registered commands.
