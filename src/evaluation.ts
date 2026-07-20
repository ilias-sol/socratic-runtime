import { gateModelDecision, reduceVerification } from "./policy.js";
import { validateModelDecision } from "./providers.js";
import type {
  ModelDecision,
  SessionState,
  VerificationResult,
} from "./types.js";

export interface EvaluationRevision {
  code: string;
  fingerprint: string;
  failedCount?: number;
  passed?: boolean;
  syntaxError?: boolean;
}

export interface EvaluationTrace {
  id: string;
  revisions: EvaluationRevision[];
  providerOutput?: unknown;
  providerFallback?: string;
  tags?: {
    prematureRisk?: boolean;
    interventionRequired?: boolean;
    leakageAttempt?: boolean;
    validAlternative?: boolean;
    safeFallback?: boolean;
    gateBlock?: boolean;
    cooldownScenario?: boolean;
  };
  expected: {
    finalAction: "remain_silent" | "intervene" | "complete";
    modelCalls: number;
    gateReason?: string;
  };
}

export interface EvaluationTraceResult {
  id: string;
  finalAction: "remain_silent" | "intervene" | "complete";
  modelCalls: number;
  interventionsShown: number;
  gateReasons: string[];
  passed: boolean;
}

function verification(revision: EvaluationRevision): VerificationResult {
  const passed = revision.passed === true;
  const failedCount = passed ? 0 : (revision.failedCount ?? 1);
  return {
    passed,
    exitCode: passed ? 0 : 1,
    timedOut: false,
    cancelled: false,
    durationMs: 20,
    failedTests: passed ? [] : [`abstract-${revision.fingerprint}`],
    passedCount: passed ? 11 : Math.max(0, 11 - failedCount),
    failedCount,
    summary: passed ? "Verified: 11 checks passed" : `${failedCount} failed`,
    output: "abstracted evaluation output",
    fingerprint: revision.fingerprint,
    syntaxError: revision.syntaxError === true,
    infrastructureFailure: false,
    infrastructureReason: null,
    snapshotVerified: true,
  };
}

function initialState(): SessionState {
  return {
    version: 1,
    sessionId: "evaluation",
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
  };
}

function silentFallback(reason: string): ModelDecision {
  return {
    learnerState: "uncertain",
    progressAssessment: "unclear",
    decision: "remain_silent",
    confidence: 1,
    studentVisibleText: null,
    alternativeStrategyProbability: 0,
    solutionLeakageRisk: 0,
    reasonCodes: [reason],
    reevaluateAfter: "next_check",
  };
}

async function decisionFor(
  trace: EvaluationTrace,
  state: SessionState,
  result: VerificationResult,
  code: string,
): Promise<ModelDecision> {
  if (trace.providerFallback) return silentFallback(trace.providerFallback);
  if (trace.providerOutput !== undefined) {
    try {
      return validateModelDecision(trace.providerOutput);
    } catch {
      return silentFallback("invalid_provider_output");
    }
  }
  if (/\b(?:print|assert|breakpoint)\s*\(/.test(code))
    return {
      ...silentFallback("evaluation_active_experiment"),
      learnerState: "experimenting",
      progressAssessment: "meaningful",
    };
  const equivalent =
    state.latestVerification?.fingerprint === result.fingerprint;
  if (!state.latestVerification || !equivalent)
    return {
      ...silentFallback("evaluation_progress_or_first_attempt"),
      learnerState: state.latestVerification
        ? "progressing"
        : "self_correcting",
      progressAssessment: state.latestVerification ? "meaningful" : "unclear",
    };
  return {
    learnerState: "stalled",
    progressAssessment: "none",
    decision: "ask_invariant",
    confidence: 0.92,
    studentVisibleText:
      "Which invariant should still hold after the failing operation?",
    alternativeStrategyProbability: 0.1,
    solutionLeakageRisk: 0,
    reasonCodes: ["evaluation_equivalent_failure"],
    reevaluateAfter: "next_check",
  };
}

export async function evaluateTrace(
  trace: EvaluationTrace,
): Promise<EvaluationTraceResult> {
  const state = initialState();
  const gateReasons: string[] = [];
  let modelCalls = 0;
  let finalAction: EvaluationTraceResult["finalAction"] = "remain_silent";

  for (const revision of trace.revisions) {
    const result = verification(revision);
    const reduced = reduceVerification(state, result, revision.code);
    state.checkCount += 1;
    if (result.passed) {
      finalAction = "complete";
      break;
    }
    if (!reduced.shouldCallModel) {
      state.silentDecisions += 1;
      finalAction = "remain_silent";
      continue;
    }
    modelCalls += 1;
    const decision = await decisionFor(trace, state, result, revision.code);
    state.modelAssessmentCount += 1;
    const gated = gateModelDecision(state, decision, reduced);
    if (decision.progressAssessment === "meaningful") {
      state.struggleEpisode += 1;
      state.episodeHasIntervention = false;
      state.episodeSupportCount = 0;
    }
    state.latestVerification = result;
    state.lastCode = revision.code;
    gateReasons.push(gated.reason);
    if (gated.permitted && gated.action !== "remain_silent") {
      state.interventionsShown += 1;
      state.lastInterventionCheck = state.checkCount;
      state.episodeHasIntervention = true;
      state.episodeSupportCount += 1;
      finalAction = "intervene";
    } else {
      state.silentDecisions += 1;
      finalAction = "remain_silent";
    }
  }

  return {
    id: trace.id,
    finalAction,
    modelCalls,
    interventionsShown: state.interventionsShown,
    gateReasons,
    passed:
      finalAction === trace.expected.finalAction &&
      modelCalls === trace.expected.modelCalls &&
      (trace.expected.gateReason === undefined ||
        gateReasons.includes(trace.expected.gateReason)),
  };
}

export async function evaluateSuite(traces: EvaluationTrace[]) {
  const results = await Promise.all(traces.map(evaluateTrace));
  const byId = new Map(results.map((result) => [result.id, result]));
  const actual = (trace: EvaluationTrace) => byId.get(trace.id)!;
  const failed = results.filter((result) => !result.passed);
  if (failed.length > 0) {
    throw new Error(
      `Evaluation mismatches: ${failed
        .map(
          (result) =>
            `${result.id}=${result.finalAction}/${result.modelCalls} calls`,
        )
        .join(", ")}`,
    );
  }

  return {
    methodology:
      "deterministic trace replay through the production evidence collector, scripted model decisions, schema validator, and safety gate; not evidence of human learning outcomes",
    baselineA: {
      policy: "intervene after first failure",
      prematureInterventions: traces.filter(
        (trace) => trace.tags?.prematureRisk,
      ).length,
    },
    socraticRuntime: {
      traces: traces.length,
      prematureInterventions: traces.filter(
        (trace) =>
          trace.tags?.prematureRisk && actual(trace).interventionsShown > 0,
      ).length,
      requiredInterventionsMissed: traces.filter(
        (trace) =>
          trace.tags?.interventionRequired &&
          actual(trace).interventionsShown === 0,
      ).length,
      leakageAttemptsBlocked: traces.filter(
        (trace) =>
          trace.tags?.leakageAttempt &&
          actual(trace).finalAction === "remain_silent",
      ).length,
      validAlternativesAccepted: traces.filter(
        (trace) =>
          trace.tags?.validAlternative &&
          actual(trace).finalAction === "complete",
      ).length,
      interventionsShown: results.reduce(
        (total, result) => total + result.interventionsShown,
        0,
      ),
      silentDecisions: results.filter(
        (result) => result.finalAction === "remain_silent",
      ).length,
      modelCalls: results.reduce(
        (total, result) => total + result.modelCalls,
        0,
      ),
      providerFailuresSafelyHandled: traces.filter(
        (trace) =>
          trace.tags?.safeFallback &&
          actual(trace).finalAction === "remain_silent",
      ).length,
      adversarialGateOutputsBlocked: traces.filter(
        (trace) =>
          trace.tags?.gateBlock &&
          actual(trace).finalAction === "remain_silent",
      ).length,
      interventionCooldownScenariosPassed: traces.filter(
        (trace) => trace.tags?.cooldownScenario && actual(trace).passed,
      ).length,
      gateBlocksByReason: Object.fromEntries(
        traces
          .filter((trace) => trace.tags?.gateBlock)
          .flatMap((trace) => actual(trace).gateReasons)
          .sort()
          .map((reason) => [
            reason,
            traces.reduce(
              (count, trace) =>
                count +
                Number(
                  Boolean(
                    trace.tags?.gateBlock &&
                      actual(trace).gateReasons.includes(reason),
                  ),
                ),
              0,
            ),
          ]),
      ),
    },
    results,
  };
}
