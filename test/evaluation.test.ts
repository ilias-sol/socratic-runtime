import { describe, expect, it } from "vitest";
import { evaluateTrace } from "../src/evaluation.js";

describe("production policy evaluation", () => {
  it("derives outcomes from the runtime rather than expected labels", async () => {
    const result = await evaluateTrace({
      id: "mismatched-expectation",
      revisions: [
        {
          code: "def binary_search():\n    return -1",
          fingerprint: "first",
        },
      ],
      expected: { finalAction: "intervene", modelCalls: 1 },
    });

    expect(result).toMatchObject({
      finalAction: "remain_silent",
      modelCalls: 1,
      interventionsShown: 0,
      passed: false,
    });
  });

  it("runs leaking provider output through the real Intervention Gate", async () => {
    const result = await evaluateTrace({
      id: "leakage",
      revisions: [
        {
          code: "def binary_search():\n    return -1",
          fingerprint: "same",
        },
        {
          code: "def binary_search(values):\n    return -1",
          fingerprint: "same",
        },
      ],
      providerOutput: {
        learnerState: "stalled",
        progressAssessment: "none",
        decision: "ask_invariant",
        confidence: 0.95,
        studentVisibleText: "Try this:\n```python\nreturn 1\n```?",
        alternativeStrategyProbability: 0.1,
        solutionLeakageRisk: 0,
        reasonCodes: ["equivalent_failure"],
        reevaluateAfter: "next_check",
      },
      expected: { finalAction: "remain_silent", modelCalls: 2 },
    });

    expect(result).toMatchObject({
      finalAction: "remain_silent",
      modelCalls: 2,
      gateReasons: [
        "local_solution_leakage_filter",
        "local_solution_leakage_filter",
      ],
      passed: true,
    });
  });
});
