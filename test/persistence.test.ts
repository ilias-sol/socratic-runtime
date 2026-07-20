import { describe, expect, it } from "vitest";
import {
  redactedSessionTrace,
  shouldDeleteRetainedSession,
} from "../src/persistence.js";
import type { SessionState } from "../src/types.js";

describe("redacted session persistence", () => {
  it("omits learner code, verifier output, paths, test identities, and question text", () => {
    const secret = "TOP_SECRET_LEARNER_VALUE";
    const state = {
      version: 1,
      sessionId: "session",
      mode: "verified",
      providerMode: "luna",
      task: {
        text: `private assignment ${secret}`,
        summary: `private assignment ${secret}`,
        source: "selection",
        startLine: 0,
        endLine: 0,
      },
      targetSymbol: {
        name: "private_symbol",
        kind: "function",
        line: 1,
        file: "C:\\private\\solution.py",
      },
      phase: "investigating",
      equivalentFailureCount: 1,
      semanticProgressScore: 1,
      experimentationEvidence: 1,
      alternativeStrategyProbability: 0.1,
      interventionsShown: 1,
      silentDecisions: 2,
      tutorFileEdits: 0,
      tutorCodeLinesSupplied: 0,
      checkCount: 3,
      modelAssessmentCount: 3,
      lastInterventionCheck: 2,
      struggleEpisode: 1,
      episodeHasIntervention: true,
      episodeSupportCount: 1,
      latestVerification: {
        passed: false,
        exitCode: 1,
        timedOut: false,
        cancelled: false,
        durationMs: 20,
        failedTests: [`test_hidden_${secret}`],
        passedCount: 4,
        failedCount: 1,
        summary: "1 failed",
        output: `traceback ${secret}`,
        fingerprint: "abcdef",
        syntaxError: false,
        infrastructureFailure: false,
        infrastructureReason: null,
        snapshotVerified: true,
      },
      eventHistory: [
        {
          id: "event",
          timestamp: 1,
          type: "intervention_shown",
          summary: `Question: expose ${secret}?`,
          file: "C:\\private\\solution.py",
          symbol: "private_symbol",
          details: {
            failedTests: `test_hidden_${secret}`,
            fingerprint: secret,
            reason: `Verifier executable missing at C:\\private\\${secret}`,
            provider: "codex-cli",
            confidence: 0.9,
          },
        },
      ],
      lastCode: `print('${secret}')`,
      lastFailureFingerprint: "abcdef",
      observedFailureFingerprints: ["abcdef"],
    } satisfies SessionState;

    const serialized = JSON.stringify(redactedSessionTrace(state));
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("C:\\\\private");
    expect(serialized).not.toContain("private_symbol");
    expect(serialized).not.toContain("failedTests");
    expect(serialized).not.toContain("output");
    expect(serialized).toContain('"provider":"codex-cli"');
    expect(serialized).toContain('"fingerprint":"abcdef"');
  });

  it("deletes retained state immediately when retention is disabled", () => {
    expect(shouldDeleteRetainedSession(true, false)).toBe(true);
    expect(shouldDeleteRetainedSession(true, true)).toBe(false);
    expect(shouldDeleteRetainedSession(false, false)).toBe(false);
  });
});
