import type { GateResult, ReducerDecision } from "./policy.js";
import type {
  LearningEvent,
  ModelDecision,
  SessionState,
  VerificationResult,
} from "./types.js";

export interface AssessmentTransition {
  assessmentEventType: LearningEvent["type"];
  finalAction: "remain_silent" | "intervene";
}

/** Apply the production state transition after GPT assessment and local gating. */
export function applyAssessmentTransition(
  state: SessionState,
  result: VerificationResult,
  currentCode: string,
  assessment: ModelDecision,
  reducer: ReducerDecision,
  gate: GateResult,
): AssessmentTransition {
  const hadPriorVerification = state.latestVerification !== null;
  state.alternativeStrategyProbability =
    assessment.alternativeStrategyProbability;
  state.modelAssessmentCount += 1;
  state.latestVerification = result;
  state.lastFailureFingerprint = result.fingerprint;
  state.observedFailureFingerprints.push(result.fingerprint);
  state.lastCode = currentCode;

  if (assessment.progressAssessment === "meaningful") {
    state.semanticProgressScore += 1;
    state.struggleEpisode += 1;
    state.episodeHasIntervention = false;
    state.episodeSupportCount = 0;
  }
  if (assessment.learnerState === "experimenting")
    state.experimentationEvidence += 1;
  if (assessment.learnerState === "stalled" && reducer.equivalent)
    state.equivalentFailureCount += 1;
  else if (assessment.progressAssessment === "meaningful")
    state.equivalentFailureCount = 0;

  state.phase =
    assessment.learnerState === "stalled"
      ? "possibly_stalled"
      : assessment.learnerState === "experimenting"
        ? "investigating"
        : assessment.progressAssessment === "meaningful"
          ? "progressing"
          : "observing";

  const assessmentEventType: LearningEvent["type"] =
    assessment.learnerState === "experimenting"
      ? "active_experiment"
      : assessment.progressAssessment === "meaningful"
        ? "meaningful_progress"
        : assessment.learnerState === "stalled"
          ? "equivalent_failure"
          : !hadPriorVerification
            ? "first_failure"
            : "behavior_changed";

  if (!gate.permitted || gate.action === "remain_silent" || !gate.visibleText) {
    state.silentDecisions += 1;
    return { assessmentEventType, finalAction: "remain_silent" };
  }

  state.interventionsShown += 1;
  state.lastInterventionCheck = state.checkCount;
  state.episodeHasIntervention = true;
  state.episodeSupportCount += 1;
  state.phase = "investigating";
  return { assessmentEventType, finalAction: "intervene" };
}
