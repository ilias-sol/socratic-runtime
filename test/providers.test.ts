import { describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  CodexCliProvider,
  LIVE_MODEL_REASONING_EFFORT,
  validateModelDecision,
} from "../src/providers.js";
import type { LearningStatePacket } from "../src/types.js";

const packet = {
  language: "java",
  task: { summary: "Binary search", text: "Implement binary search" },
  target: { name: "binarySearch", kind: "method" },
  currentCode: "static int binarySearch() { return -1; }",
  previousCode: "static int binarySearch() { return 0; }",
  revisionDiff: "- return 0\n+ return -1",
  recentEvents: [],
  verification: {
    passed: false,
    exitCode: 1,
    timedOut: false,
    cancelled: false,
    durationMs: 10,
    passedCount: 6,
    failedCount: 1,
    summary: "1 failed",
    fingerprint: "x",
    syntaxError: false,
    infrastructureFailure: false,
    infrastructureReason: null,
    snapshotVerified: true,
    diagnosticExcerpt: "AssertionError: expected <value>",
  },
  previousVerification: null,
  state: {
    phase: "possibly_stalled",
    equivalentFailureCount: 1,
    semanticProgressScore: 1,
    experimentationEvidence: 0,
    interventionsShown: 0,
    checksSinceIntervention: null,
    struggleEpisode: 1,
    episodeHasIntervention: false,
    episodeSupportCount: 0,
    explicitHelpRequested: false,
  },
  permittedActions: ["remain_silent", "ask_invariant"],
  policyConstraints: ["no code"],
} satisfies LearningStatePacket;

const validDecision = {
  learnerState: "stalled",
  progressAssessment: "none",
  decision: "remain_silent",
  confidence: 1,
  studentVisibleText: null,
  alternativeStrategyProbability: 0,
  solutionLeakageRisk: 0,
  reasonCodes: ["safe"],
  reevaluateAfter: "next_check",
} as const;

describe("live Codex provider", () => {
  it("pins medium reasoning for every invocation", () => {
    expect(LIVE_MODEL_REASONING_EFFORT).toBe("medium");
  });

  it("requires explicit learner-state and progress classification", () => {
    expect(validateModelDecision(validDecision)).toMatchObject({
      learnerState: "stalled",
    });
    expect(() =>
      validateModelDecision({ ...validDecision, learnerState: undefined }),
    ).toThrow(/learner state/);
  });

  it("rejects malformed or expanded model output", () => {
    expect(() =>
      validateModelDecision({ decision: "write_solution" }),
    ).toThrow();
    expect(() =>
      validateModelDecision({ ...validDecision, extra: true }),
    ).toThrow(/unknown field/);
    expect(() =>
      validateModelDecision({ ...validDecision, confidence: Infinity }),
    ).toThrow(/confidence/);
  });

  it("honors the live Codex exec schema-file contract", async () => {
    const workspace = await mkdtemp(
      path.join(tmpdir(), "socratic-provider-test-"),
    );
    const fixture = path.resolve("test", "fixtures", "fake-codex.mjs");
    try {
      const result = await new CodexCliProvider(workspace, process.execPath, [
        fixture,
      ]).analyze(packet, { mode: "luna", timeoutMs: 2_000 });
      expect(result).toMatchObject({
        provider: "codex-cli",
        model: "gpt-5.6-luna",
        decision: { learnerState: "stalled", decision: "ask_invariant" },
      });
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it("cancels a stale Codex process immediately", async () => {
    const workspace = await mkdtemp(
      path.join(tmpdir(), "socratic-cancel-test-"),
    );
    const fixture = path.resolve("test", "fixtures", "slow-codex.mjs");
    const controller = new AbortController();
    const started = Date.now();
    try {
      const pending = new CodexCliProvider(workspace, process.execPath, [
        fixture,
      ]).analyze(packet, {
        mode: "luna",
        timeoutMs: 10_000,
        signal: controller.signal,
      });
      setTimeout(() => controller.abort(), 30);
      const result = await pending;
      expect(result.fallbackReason).toBe("assessment_cancelled");
      expect(Date.now() - started).toBeLessThan(2_000);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
