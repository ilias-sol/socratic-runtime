import { describe, expect, it } from "vitest";
import { applyAssessmentTransition } from "../src/assessmentTransition.js";
import { gateModelDecision, reduceVerification } from "../src/policy.js";
import type {
  ModelDecision,
  SessionState,
  VerificationResult,
} from "../src/types.js";

const verification = (
  fingerprint: string,
  passed = false,
): VerificationResult => ({
  passed,
  exitCode: passed ? 0 : 1,
  timedOut: false,
  cancelled: false,
  durationMs: 10,
  failedTests: passed ? [] : [fingerprint],
  passedCount: passed ? 11 : 8,
  failedCount: passed ? 0 : 3,
  summary: passed ? "Verified: 11 checks passed" : "3 checks failed",
  output: "abstracted",
  fingerprint,
  syntaxError: false,
  infrastructureFailure: false,
  infrastructureReason: null,
  snapshotVerified: true,
});

const decision = (overrides: Partial<ModelDecision> = {}): ModelDecision => ({
  learnerState: "uncertain",
  progressAssessment: "unclear",
  decision: "remain_silent",
  confidence: 0.9,
  studentVisibleText: null,
  alternativeStrategyProbability: 0.2,
  solutionLeakageRisk: 0,
  reasonCodes: ["journey"],
  reevaluateAfter: "next_check",
  ...overrides,
});

const initialState = (): SessionState => ({
  version: 1,
  sessionId: "journey",
  mode: "verified",
  providerMode: "luna",
  task: {
    text: "Implement binary search",
    summary: "Binary search",
    source: "selection",
    startLine: 0,
    endLine: 0,
  },
  targetSymbol: {
    name: "binary_search",
    kind: "function",
    line: 0,
    file: "binary_search.py",
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

function assess(
  state: SessionState,
  result: VerificationResult,
  code: string,
  model: ModelDecision,
) {
  const reduced = reduceVerification(state, result, code);
  state.checkCount += 1;
  const gated = gateModelDecision(state, model, reduced);
  return applyAssessmentTransition(state, result, code, model, reduced, gated);
}

describe("production assessment journey", () => {
  it("keeps guidance-only reviews distinct from executable failures", () => {
    const state = { ...initialState(), mode: "guidance" as const };
    const result = { ...verification("guidance"), snapshotVerified: false };
    expect(
      assess(
        state,
        result,
        "revision",
        decision({ learnerState: "stalled", progressAssessment: "none" }),
      ),
    ).toMatchObject({ assessmentEventType: "guidance_review" });
    expect(state.equivalentFailureCount).toBe(0);
    expect(state.lastFailureFingerprint).toBeNull();
    expect(state.observedFailureFingerprints).toEqual([]);
  });

  it("preserves struggle, intervenes once, and leaves completion to verification", () => {
    const state = initialState();

    expect(assess(state, verification("a"), "first", decision())).toMatchObject(
      { finalAction: "remain_silent" },
    );

    expect(
      assess(
        state,
        verification("b"),
        "progress",
        decision({
          learnerState: "progressing",
          progressAssessment: "meaningful",
        }),
      ),
    ).toMatchObject({
      assessmentEventType: "meaningful_progress",
      finalAction: "remain_silent",
    });

    const stalled = decision({
      learnerState: "stalled",
      progressAssessment: "none",
      decision: "ask_invariant",
      studentVisibleText: "What should remain true when one candidate remains?",
      alternativeStrategyProbability: 0.1,
    });
    expect(assess(state, verification("b"), "stalled", stalled)).toMatchObject({
      finalAction: "intervene",
    });
    expect(
      assess(state, verification("b"), "still stalled", stalled),
    ).toMatchObject({ finalAction: "remain_silent" });

    const passed = verification("pass", true);
    expect(reduceVerification(state, passed, "correct")).toMatchObject({
      shouldCallModel: false,
      reason: "verified_completion",
    });
    expect(state).toMatchObject({
      interventionsShown: 1,
      episodeSupportCount: 1,
      tutorFileEdits: 0,
      tutorCodeLinesSupplied: 0,
    });
  });
});
