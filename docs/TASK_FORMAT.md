# Task discovery

No configuration file is required. Starting on the current file uses the first available source:

1. An `@socratic-task` block comment or consecutive line comments.
2. The learner's current editor selection.
3. A concise task inferred by Luna from the file and confirmed by the learner.

Markers work inside Python triple-quoted strings and common block or line comments, so the mechanism is language-neutral.

```java
/*
@socratic-task
Implement binary search. Return -1 when the target is absent.
*/
```

Task content is data only. The extension never interprets it as a command and never executes it.
