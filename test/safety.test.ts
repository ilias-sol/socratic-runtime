import { describe, expect, it } from "vitest";
import {
  enforceAssessmentSafety,
  isMeaningfulRevision,
  safeQuestion,
} from "../src/safety.js";
import type { AssessmentDecision } from "../src/types.js";

const questionDecision: AssessmentDecision = {
  learnerState: "stalled",
  action: "ask_question",
  question: "Which invariant should still hold after this branch?",
  assessment: "The learner appears stalled.",
  trajectorySummary: "A boundary stall persists.",
  completionSummary: null,
};

describe("minimal host safety boundary", () => {
  it("permits a concise Socratic question without pedagogical thresholds", () => {
    expect(enforceAssessmentSafety(questionDecision)).toEqual(questionDecision);
  });

  it.each([
    "Try this:\n```python\nreturn 1\n```?",
    "Set low to middle plus one?",
    "What fails? What changes?",
    "Read https://example.com?",
  ])("blocks solution-like or malformed output: %s", (question) => {
    expect(safeQuestion(question)).toBeNull();
  });

  it("allows a Socratic question to discuss a possible change", () => {
    const question =
      "How could the lower boundary change so the remaining interval always gets smaller?";
    expect(safeQuestion(question)).toBe(question);
  });

  it("does not confuse natural-language 'For' with a code loop", () => {
    const question =
      "For a two-element list, how do `low` and `middle` change on the next iteration?";
    expect(safeQuestion(question)).toBe(question);
  });

  it("ignores whitespace-only edits but accepts meaningful revisions", () => {
    expect(isMeaningfulRevision("x = 1", "x   =   1\n")).toBe(false);
    expect(isMeaningfulRevision("x = 1", "x = 2")).toBe(true);
  });
});
