# Binary-search interpretation library

Use these as hypotheses, never diagnoses.

- The loop condition and interval representation may disagree: inclusive `[low, high]` versus half-open `[low, high)`.
- An update may fail to exclude the probed midpoint, preventing strict search-space reduction.
- A final remaining candidate may not be inspected.
- Empty input may violate an assumed valid index.
- Duplicate values may make several indices behaviorally correct.
- An unusual slicing, recursion, bisect-like, or sentinel strategy may still be valid if executable behavior and complexity constraints pass.

Minimal questions include “What should the interval represent when exactly one candidate remains?” and “What is the smallest input that reaches this branch?” Do not mention a specific hidden input or prescribe an update expression.
