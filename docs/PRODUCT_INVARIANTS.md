# Product invariants

1. The product is an ambient learning companion, not a chatbot or answer generator.
2. One command starts a session on the active text file.
3. GPT-5.6 Luna with medium reasoning is the only pedagogical model.
4. Luna sees the task, current and previous code, editor diagnostics, and recent trajectory.
5. Luna chooses among `remain_silent`, `ask_question`, and `complete`. The host does not impose confidence, failure-count, verifier, or one-question gates.
6. A meaningful edit is assessed two seconds after typing stops; newer edits cancel stale assessments.
7. During an active task, an intervention is exactly one concise question—never code, a complete solution, or a mechanical recipe.
8. **Ask for a Nudge** remains available throughout the session.
9. A useful question may recur after later progress and a new stall.
10. When Luna considers the task complete, observation ends automatically and a clearly labeled post-completion reference becomes available.
11. The extension never edits or executes learner files.
12. The interaction contract is language-neutral. Python is the demonstration, not a runtime dependency.
13. Codex CLI reuses the learner's existing ChatGPT/Codex sign-in. No project account or API key is introduced.
14. Completion is a model assessment, not proof of correctness; the UI and documentation must say so.
