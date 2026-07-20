import { describe, expect, it } from "vitest";
import { reduceVerification } from "../src/policy.js";
import { normalizeAutoPauseAfter } from "../src/autoCheck.js";
import type { SessionState, VerificationResult } from "../src/types.js";

const verification = (
  fingerprint: string,
  failedCount = 2,
): VerificationResult => ({
  passed: false,
  exitCode: 1,
  timedOut: false,
  cancelled: false,
  durationMs: 150,
  failedTests: [fingerprint],
  passedCount: 4,
  failedCount,
  summary: `${failedCount} failed`,
  output: "abstracted",
  fingerprint,
  syntaxError: false,
  infrastructureFailure: false,
  infrastructureReason: null,
  snapshotVerified: true,
});

const session = (language = "java"): SessionState => ({
  version: 1,
  sessionId: `simulated-${language}`,
  mode: "verified",
  providerMode: "luna",
  task: {
    text: "Implement the exercise",
    summary: "Implement the exercise",
    source: "selection",
    startLine: 0,
    endLine: 0,
  },
  targetSymbol: {
    name: "solve",
    kind: "method",
    line: 0,
    file: `Solution.${language === "java" ? "java" : "py"}`,
  },
  phase: "observing",
  equivalentFailureCount: 0,
  semanticProgressScore: 0,
  experimentationEvidence: 0,
  alternativeStrategyProbability: 0,
  interventionsShown: 0,
  silentDecisions: 0,
  tutorFileEdits: 0,
  tutorCodeLinesSupplied: 0,
  checkCount: 0,
  modelAssessmentCount: 0,
  lastInterventionCheck: null,
  struggleEpisode: 1,
  episodeHasIntervention: false,
  episodeSupportCount: 0,
  latestVerification: null,
  eventHistory: [],
  lastCode: "",
  lastFailureFingerprint: null,
  observedFailureFingerprints: [],
});

describe("model-led student revision simulations", () => {
  it("treats inactivity as lifecycle only", () => {
    const state = session();
    const before = {
      checks: state.checkCount,
      assessments: state.modelAssessmentCount,
    };
    expect(normalizeAutoPauseAfter(600_000)).toBe(600_000);
    expect({
      checks: state.checkCount,
      assessments: state.modelAssessmentCount,
    }).toEqual(before);
  });

  it("sends first, changed, equivalent, and syntax-failing attempts to GPT-5.6", () => {
    const state = session();
    const attempts = [
      ["class Solution { int solve(){ return -1; } }", verification("a")],
      ["class Solution { int solve(){ return 0; } }", verification("b", 1)],
      ["class Solution { int solve(){ return 1; } }", verification("b", 1)],
      [
        "class Solution { int solve( { }",
        { ...verification("syntax"), syntaxError: true },
      ],
    ] as const;
    for (const [code, result] of attempts) {
      expect(reduceVerification(state, result, code).shouldCallModel).toBe(
        true,
      );
      state.latestVerification = result;
      state.lastCode = code;
    }
  });

  it("collects equivalence as evidence without declaring a stall", () => {
    const state = session("python");
    state.latestVerification = verification("same");
    const evidence = reduceVerification(
      state,
      verification("same"),
      "def solve(): return -1",
    );
    expect(evidence).toMatchObject({
      equivalent: true,
      progress: false,
      shouldCallModel: true,
    });
    expect(evidence.reason).toBe("model_trajectory_assessment_required");
  });
});
