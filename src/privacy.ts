import type { VerificationResult } from "./types.js";

export type AbstractVerificationResult = Omit<
  VerificationResult,
  "output" | "failedTests"
>;

export function abstractVerificationResult(
  result: VerificationResult,
): AbstractVerificationResult {
  const { output: _output, failedTests: _failedTests, ...abstracted } = result;
  void _output;
  void _failedTests;
  return abstracted;
}

/**
 * Preserve diagnostic shape for cross-language model reasoning while removing
 * paths, test identifiers, quoted values, and long source/traceback payloads.
 */
export function diagnosticExcerpt(result: VerificationResult): string {
  const safeLines = result.output
    .split(/\r?\n/)
    .filter((line) =>
      /error|fail|assert|exception|warning|expected|actual|timeout|compil/i.test(
        line,
      ),
    )
    .slice(-20)
    .map((line) =>
      line
        .replace(/(?:[A-Za-z]:)?[\\/][^\s:]+/g, "<path>")
        .replace(/(?:test|spec)[\w./\\:[\]-]*/gi, "<check>")
        .replace(/(['"])(?:(?!\1).){1,120}\1/g, "<value>")
        .replace(/\b-?\d+(?:\.\d+)?\b/g, "<number>")
        .slice(0, 240),
    );
  return safeLines.join("\n").slice(-2_000);
}

export function modelVerificationResult(result: VerificationResult) {
  return {
    ...abstractVerificationResult(result),
    diagnosticExcerpt: diagnosticExcerpt(result),
  };
}

export function verificationEventDetails(
  result: VerificationResult,
): Record<string, unknown> {
  return {
    durationMs: result.durationMs,
    passedChecks: result.passedCount,
    failedChecks: result.failedCount,
    snapshot: result.snapshotVerified,
  };
}
