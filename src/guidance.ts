import { createHash } from "node:crypto";
import type { VerificationResult } from "./types.js";

export interface GuidanceDiagnostic {
  severity: "error" | "warning";
  message: string;
}

export function assessmentStatusCopy(guidanceOnly: boolean): string {
  return guidanceOnly
    ? "GPT-5.6 is comparing this revision with the previous attempt. No executable verifier is active, so correctness and completion claims remain disabled. Editing again cancels this assessment."
    : "Executable checks found a failure. GPT-5.6 is comparing the target with the previous verified attempt. Editing again cancels this assessment.";
}

export function guidanceResult(
  diagnostics: GuidanceDiagnostic[],
): VerificationResult {
  const bounded = diagnostics
    .slice(0, 20)
    .map((item) => `${item.severity}: ${item.message.slice(0, 240)}`);
  const summary = "Guidance-only revision; correctness was not verified";
  return {
    passed: false,
    exitCode: null,
    timedOut: false,
    cancelled: false,
    durationMs: 0,
    failedTests: [],
    passedCount: 0,
    failedCount: 0,
    summary,
    output: bounded.join("\n"),
    fingerprint: createHash("sha256")
      .update(
        `guidance-only\0${bounded.map((line) => line.split(":", 1)[0]).join("|")}`,
      )
      .digest("hex")
      .slice(0, 16),
    syntaxError: diagnostics.some((item) => item.severity === "error"),
    infrastructureFailure: false,
    infrastructureReason: null,
    snapshotVerified: false,
  };
}
