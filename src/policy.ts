import { createHash, randomUUID } from "node:crypto";
import type {
  Action,
  LearningEvent,
  ModelDecision,
  SessionState,
  VerificationResult,
} from "./types.js";

/** Objective evidence collected locally. It never makes a pedagogical judgment. */
export interface ReducerDecision {
  candidate: Action;
  reason: string;
  shouldCallModel: boolean;
  progress: false;
  equivalent: boolean;
  behaviorChanged: boolean;
}

export function fingerprintFailures(
  failedTests: string[],
  summary: string,
): string {
  const normalized =
    failedTests.length > 0
      ? [...failedTests].sort().join("|")
      : summary.replace(/\d+(?:\.\d+)?s/g, "<time>");
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

/**
 * Decide only whether model assessment is possible. GPT-5.6, not this
 * function, determines progress, experimentation, stall, and intervention.
 */
export function reduceVerification(
  state: SessionState,
  result: VerificationResult,
  _currentCode: string,
): ReducerDecision {
  void _currentCode;
  if (result.infrastructureFailure)
    return {
      candidate: "remain_silent",
      reason: "verification_infrastructure_failure",
      shouldCallModel: false,
      progress: false,
      equivalent: false,
      behaviorChanged: false,
    };
  if (result.passed)
    return {
      candidate: "remain_silent",
      reason: "verified_completion",
      shouldCallModel: false,
      progress: false,
      equivalent: false,
      behaviorChanged: true,
    };

  const previous = state.latestVerification;
  const equivalent = previous?.fingerprint === result.fingerprint;
  return {
    candidate: "remain_silent",
    reason: previous
      ? "model_trajectory_assessment_required"
      : "model_initial_assessment_required",
    shouldCallModel: true,
    progress: false,
    equivalent,
    behaviorChanged: Boolean(previous && !equivalent),
  };
}

const codeLike =
  /```|`[^`]*(?:=|\(|\)|\{|\}|;)[^`]*`|(?:^|\n)\s*(?:def|class|function|public|private|protected|return|if|else|while|for|switch|case|let|const|var)\b|(?:^|\n)\s*[A-Za-z_$][\w$]*\s*=\s*[^?\n]+/i;
const hiddenDisclosure =
  /hidden test|private test|secret case|expected output is|undisclosed input/i;
const markdownOrLink =
  /!?(?:\[[^\]]*\]\([^)]*\)|https?:\/\/|www\.)|(?:^|\n)\s*(?:#{1,6}|>)/i;
const mechanicalRecipe =
  /\b(?:set|assign|update|change|move|increment|decrement)\s+(?:the\s+)?[A-Za-z_$][\w$]*\s+(?:to|by)\b|\b(?:use|write|add|insert)\s+(?:a\s+)?return\b|\b(?:first|then|next)\b[^?]{0,80}\b(?:then|next|finally)\b|\b(?:add|subtract)\s+(?:one|1)\s+(?:to|from)\b|\b(?:one|1)\s+(?:past|beyond|before)\s+(?:the\s+)?(?:middle|midpoint|index)\b/i;

export function normalizeStudentVisibleText(value: string): string {
  const decoded = value.replace(
    /&(?:lt|gt|amp|quot|#39|#x[0-9a-f]+|#\d+);/gi,
    (entity) => {
      const named: Record<string, string> = {
        "&lt;": "<",
        "&gt;": ">",
        "&amp;": "&",
        "&quot;": '"',
        "&#39;": "'",
      };
      const lower = entity.toLowerCase();
      if (named[lower]) return named[lower];
      const radix = lower.startsWith("&#x") ? 16 : 10;
      const digits = lower.slice(radix === 16 ? 3 : 2, -1);
      const point = Number.parseInt(digits, radix);
      return Number.isFinite(point) && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : entity;
    },
  );
  return decoded
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export interface GateResult {
  action: Action;
  visibleText: string | null;
  permitted: boolean;
  reason: string;
}

export interface GateContext {
  explicitHelpRequest?: boolean;
}

export const MAX_SUPPORTS_PER_EPISODE = 3;

/** Enforce hard safety constraints without re-deciding learner state. */
export function gateModelDecision(
  state: SessionState,
  decision: ModelDecision,
  reducer: ReducerDecision,
  context: GateContext = {},
): GateResult {
  if (!reducer.shouldCallModel)
    return {
      action: "remain_silent",
      visibleText: null,
      permitted: false,
      reason: reducer.reason,
    };
  if (
    context.explicitHelpRequest &&
    state.episodeSupportCount >= MAX_SUPPORTS_PER_EPISODE &&
    decision.decision !== "remain_silent"
  )
    return {
      action: "remain_silent",
      visibleText: null,
      permitted: false,
      reason: "support_ladder_exhausted",
    };
  if (
    !context.explicitHelpRequest &&
    state.lastInterventionCheck !== null &&
    state.checkCount - state.lastInterventionCheck < 2 &&
    decision.decision !== "remain_silent"
  )
    return {
      action: "remain_silent",
      visibleText: null,
      permitted: false,
      reason: "intervention_cooldown",
    };
  if (
    !context.explicitHelpRequest &&
    state.episodeHasIntervention &&
    decision.decision !== "remain_silent"
  )
    return {
      action: "remain_silent",
      visibleText: null,
      permitted: false,
      reason: "struggle_episode_already_supported",
    };
  if (decision.decision === "remain_silent")
    return {
      action: "remain_silent",
      visibleText: null,
      permitted: true,
      reason: "model_abstained",
    };
  if (
    decision.learnerState !== "stalled" ||
    decision.progressAssessment === "meaningful"
  )
    return {
      action: "remain_silent",
      visibleText: null,
      permitted: false,
      reason: "model_declared_productive_struggle",
    };
  if (decision.confidence < 0.7)
    return {
      action: "remain_silent",
      visibleText: null,
      permitted: false,
      reason: "low_confidence",
    };
  if (decision.alternativeStrategyProbability >= 0.65)
    return {
      action: "remain_silent",
      visibleText: null,
      permitted: false,
      reason: "plausible_alternative_strategy",
    };
  if (decision.solutionLeakageRisk > 0.15)
    return {
      action: "remain_silent",
      visibleText: null,
      permitted: false,
      reason: "provider_reported_leakage_risk",
    };
  const text = normalizeStudentVisibleText(decision.studentVisibleText ?? "");
  if (
    !text ||
    text.length > 180 ||
    codeLike.test(text) ||
    hiddenDisclosure.test(text) ||
    markdownOrLink.test(text) ||
    mechanicalRecipe.test(text)
  )
    return {
      action: "remain_silent",
      visibleText: null,
      permitted: false,
      reason: "local_solution_leakage_filter",
    };
  if (!text.endsWith("?") || (text.match(/\?/g)?.length ?? 0) !== 1)
    return {
      action: "remain_silent",
      visibleText: null,
      permitted: false,
      reason: "intervention_must_be_a_question",
    };
  return {
    action: decision.decision,
    visibleText: text,
    permitted: true,
    reason: "safety_gate_permitted",
  };
}

export function event(
  type: LearningEvent["type"],
  summary: string,
  details?: Record<string, unknown>,
): LearningEvent {
  return { id: randomUUID(), timestamp: Date.now(), type, summary, details };
}
