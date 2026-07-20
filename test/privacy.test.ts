import { describe, expect, it } from "vitest";
import {
  abstractVerificationResult,
  verificationEventDetails,
} from "../src/privacy.js";
import type { VerificationResult } from "../src/types.js";

const result = (): VerificationResult => ({
  passed: false,
  exitCode: 1,
  timedOut: false,
  cancelled: false,
  durationMs: 12,
  failedTests: ["test_private_case[secret-input]"],
  passedCount: 4,
  failedCount: 1,
  summary: "1 check failed",
  output: "private traceback",
  fingerprint: "abcdef",
  syntaxError: false,
  infrastructureFailure: false,
  infrastructureReason: null,
  snapshotVerified: true,
});

describe("active verification disclosure boundaries", () => {
  it("omits output and exact test identities from the model packet", () => {
    const serialized = JSON.stringify(abstractVerificationResult(result()));
    expect(serialized).not.toContain("secret-input");
    expect(serialized).not.toContain("private traceback");
    expect(serialized).not.toContain("failedTests");
    expect(serialized).toContain('"failedCount":1');
  });

  it("uses aggregate counts in visible trace details", () => {
    const serialized = JSON.stringify(verificationEventDetails(result()));
    expect(serialized).not.toContain("secret-input");
    expect(serialized).toContain('"failedChecks":1');
  });
});
