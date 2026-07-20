import { describe, expect, it } from "vitest";
import { gateModelDecision, reduceVerification } from "../src/policy.js";
import type {
  ModelDecision,
  SessionState,
  VerificationResult,
} from "../src/types.js";

const result = (fingerprint: string, failedCount = 2): VerificationResult => ({
  passed: false,
  exitCode: 1,
  timedOut: false,
  cancelled: false,
  durationMs: 20,
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

const state = (latest: VerificationResult | null = null): SessionState => ({
  version: 1,
  sessionId: "test",
  mode: "verified",
  providerMode: "luna",
  task: {
    text: "Task",
    summary: "Task",
    source: "selection",
    startLine: 0,
    endLine: 0,
  },
  targetSymbol: {
    name: "solve",
    kind: "function",
    line: 1,
    file: "solution.java",
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
  checkCount: 1,
  modelAssessmentCount: 0,
  lastInterventionCheck: null,
  struggleEpisode: 1,
  episodeHasIntervention: false,
  episodeSupportCount: 0,
  latestVerification: latest,
  eventHistory: [],
  lastCode: "",
  lastFailureFingerprint: latest?.fingerprint ?? null,
  observedFailureFingerprints: latest ? [latest.fingerprint] : [],
});

const model = (overrides: Partial<ModelDecision> = {}): ModelDecision => ({
  learnerState: "stalled",
  progressAssessment: "none",
  decision: "ask_invariant",
  confidence: 0.9,
  studentVisibleText: "Which invariant should still hold after this operation?",
  alternativeStrategyProbability: 0.1,
  solutionLeakageRisk: 0,
  reasonCodes: ["repeated_failure"],
  reevaluateAfter: "next_check",
  ...overrides,
});

describe("objective evidence collection", () => {
  it("asks GPT-5.6 to assess the first failed revision", () => {
    expect(
      reduceVerification(state(), result("a"), "class Solve {}"),
    ).toMatchObject({ shouldCallModel: true, equivalent: false });
  });

  it("asks GPT-5.6 to assess changed and equivalent failures", () => {
    expect(
      reduceVerification(state(result("a")), result("b"), "changed"),
    ).toMatchObject({ shouldCallModel: true, behaviorChanged: true });
    expect(
      reduceVerification(state(result("a")), result("a"), "changed"),
    ).toMatchObject({ shouldCallModel: true, equivalent: true });
  });

  it("never turns infrastructure failure or completion into model tutoring", () => {
    expect(
      reduceVerification(
        state(),
        { ...result("x"), infrastructureFailure: true },
        "x",
      ),
    ).toMatchObject({
      shouldCallModel: false,
      reason: "verification_infrastructure_failure",
    });
    expect(
      reduceVerification(
        state(),
        { ...result("ok", 0), passed: true, exitCode: 0 },
        "x",
      ),
    ).toMatchObject({ shouldCallModel: false, reason: "verified_completion" });
  });
});

describe("safety-only intervention gate", () => {
  const assessment = {
    candidate: "remain_silent",
    reason: "model_trajectory_assessment_required",
    shouldCallModel: true,
    progress: false,
    equivalent: true,
    behaviorChanged: false,
  } as const;

  it("permits a model-chosen concise question", () => {
    expect(
      gateModelDecision(state(result("a")), model(), assessment),
    ).toMatchObject({ permitted: true, action: "ask_invariant" });
  });

  it("enforces consistency with the model's own productive-struggle classification", () => {
    expect(
      gateModelDecision(
        state(result("a")),
        model({
          learnerState: "self_correcting",
          progressAssessment: "meaningful",
        }),
        assessment,
      ),
    ).toMatchObject({
      permitted: false,
      reason: "model_declared_productive_struggle",
    });
  });

  it.each([
    [model({ confidence: 0.3 }), "low_confidence"],
    [
      model({ alternativeStrategyProbability: 0.8 }),
      "plausible_alternative_strategy",
    ],
    [model({ solutionLeakageRisk: 0.5 }), "provider_reported_leakage_risk"],
    [
      model({ studentVisibleText: "Try this:\n```java\nreturn 1;\n```?" }),
      "local_solution_leakage_filter",
    ],
    [
      model({ studentVisibleText: "Inspect the invariant." }),
      "intervention_must_be_a_question",
    ],
  ])("blocks unsafe output", (decision, reason) => {
    expect(
      gateModelDecision(state(result("a")), decision, assessment),
    ).toMatchObject({ permitted: false, reason });
  });

  it("uses a short cooldown instead of a lifetime intervention budget", () => {
    const recent = state(result("a"));
    recent.checkCount = 3;
    recent.lastInterventionCheck = 2;
    expect(gateModelDecision(recent, model(), assessment).reason).toBe(
      "intervention_cooldown",
    );
    recent.checkCount = 4;
    expect(gateModelDecision(recent, model(), assessment).permitted).toBe(true);
  });

  it("permits at most one intervention until meaningful progress starts a new episode", () => {
    const supported = state(result("a"));
    supported.episodeHasIntervention = true;
    expect(gateModelDecision(supported, model(), assessment).reason).toBe(
      "struggle_episode_already_supported",
    );
  });

  it("permits explicitly requested follow-up support without weakening safety", () => {
    const supported = state(result("a"));
    supported.checkCount = 3;
    supported.lastInterventionCheck = 3;
    supported.episodeHasIntervention = true;
    supported.episodeSupportCount = 1;
    expect(
      gateModelDecision(supported, model(), assessment, {
        explicitHelpRequest: true,
      }),
    ).toMatchObject({ permitted: true, action: "ask_invariant" });
    expect(
      gateModelDecision(supported, model({ confidence: 0.2 }), assessment, {
        explicitHelpRequest: true,
      }).reason,
    ).toBe("low_confidence");
  });

  it("caps each struggle episode at three support steps", () => {
    const supported = state(result("a"));
    supported.episodeHasIntervention = true;
    supported.episodeSupportCount = 3;
    expect(
      gateModelDecision(supported, model(), assessment, {
        explicitHelpRequest: true,
      }).reason,
    ).toBe("support_ladder_exhausted");
  });

  it.each([
    "Can you use &#114;eturn x here?",
    "Can you use ret\u200Burn x here?",
    "[Open this hint](https://example.com)?",
    "First inspect the midpoint, then move low to mid plus one?",
    "What fails here? What should change?",
  ])("blocks encoded or mechanically prescriptive text: %s", (text) => {
    expect(
      gateModelDecision(
        state(result("a")),
        model({ studentVisibleText: text }),
        assessment,
      ),
    ).toMatchObject({ permitted: false });
  });
});
