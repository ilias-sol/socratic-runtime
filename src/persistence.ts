import type { LearningEvent, SessionState } from "./types.js";

const retainedDetailKeys = new Set([
  "decision",
  "reason",
  "trigger",
  "durationMs",
  "snapshot",
  "pedagogicalEvidence",
  "modelCall",
  "inactivityMs",
  "checkedRevision",
  "currentRevision",
  "executableAuthority",
  "passedChecks",
  "provider",
  "model",
  "confidence",
  "leakageRisk",
  "latencyMs",
  "localPolicy",
  "modelRecommendation",
  "fallback",
  "supportLevel",
]);

export interface PersistedSessionTrace {
  version: 1;
  sessionId: string;
  mode: SessionState["mode"];
  providerMode: SessionState["providerMode"];
  phase: SessionState["phase"];
  metrics: {
    equivalentFailureCount: number;
    semanticProgressScore: number;
    experimentationEvidence: number;
    interventionsShown: number;
    silentDecisions: number;
    checkCount: number;
  };
  latestVerification: {
    passed: boolean;
    timedOut: boolean;
    cancelled: boolean;
    durationMs: number;
    passedCount: number;
    failedCount: number;
    fingerprint: string;
    syntaxError: boolean;
    infrastructureFailure: boolean;
    snapshotVerified: boolean;
  } | null;
  events: Array<{
    timestamp: number;
    type: LearningEvent["type"];
    summary: string;
    details?: Record<string, unknown>;
  }>;
}

export function shouldDeleteRetainedSession(
  retentionSettingChanged: boolean,
  retainSessions: boolean,
): boolean {
  return retentionSettingChanged && !retainSessions;
}

function redactedSummary(item: LearningEvent): string {
  if (item.type === "intervention_shown") return "A gated question was shown";
  return item.summary;
}

function redactedDetails(
  details: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!details) return undefined;
  const retained = Object.fromEntries(
    Object.entries(details).filter(
      ([key, value]) =>
        retainedDetailKeys.has(key) &&
        (key !== "reason" ||
          (typeof value === "string" && /^[a-z0-9_]+$/.test(value))),
    ),
  );
  return Object.keys(retained).length > 0 ? retained : undefined;
}

export function redactedSessionTrace(
  state: SessionState,
): PersistedSessionTrace {
  const latest = state.latestVerification;
  return {
    version: 1,
    sessionId: state.sessionId,
    mode: state.mode,
    providerMode: state.providerMode,
    phase: state.phase,
    metrics: {
      equivalentFailureCount: state.equivalentFailureCount,
      semanticProgressScore: state.semanticProgressScore,
      experimentationEvidence: state.experimentationEvidence,
      interventionsShown: state.interventionsShown,
      silentDecisions: state.silentDecisions,
      checkCount: state.checkCount,
    },
    latestVerification: latest
      ? {
          passed: latest.passed,
          timedOut: latest.timedOut,
          cancelled: latest.cancelled,
          durationMs: latest.durationMs,
          passedCount: latest.passedCount,
          failedCount: latest.failedCount,
          fingerprint: latest.fingerprint,
          syntaxError: latest.syntaxError,
          infrastructureFailure: latest.infrastructureFailure,
          snapshotVerified: latest.snapshotVerified,
        }
      : null,
    events: state.eventHistory.map((item) => ({
      timestamp: item.timestamp,
      type: item.type,
      summary: redactedSummary(item),
      details: redactedDetails(item.details),
    })),
  };
}
