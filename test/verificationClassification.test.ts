import { describe, expect, it } from "vitest";
import {
  infrastructureReasonFor,
  verifierExecutableMissingReason,
} from "../src/verificationClassification.js";

const evidence = (output: string) => ({
  output,
  spawnError: null,
  exitCode: 1,
  passedCount: 0,
  cancelled: false,
  timedOut: false,
});

describe("verification exit classification", () => {
  it("treats a verifier spawn error as infrastructure", () => {
    const reason = infrastructureReasonFor({
      ...evidence(""),
      spawnError: "spawn C:\\Users\\student\\.venv\\python.exe ENOENT",
      exitCode: null,
    });
    expect(reason).toBe(
      "Unable to start the trusted verifier in this workspace.",
    );
    expect(reason).not.toContain("student");
  });

  it("does not disclose a local path when the verifier executable is missing", () => {
    const reason = verifierExecutableMissingReason();
    expect(reason).toContain("Complete the workspace setup");
    expect(reason).not.toContain("C:\\");
  });

  it.each([
    "No module named 'pytest'",
    "ImportError while loading conftest",
    "pytest: error: unrecognized arguments: --bad",
    "ERROR: file or directory not found: tests",
    "collected 0 items",
  ])("recognizes explicit environment evidence: %s", (output) => {
    expect(infrastructureReasonFor(evidence(output))).not.toBeNull();
  });

  it("keeps a timeout-plugin exit without a pytest summary as student behavior", () => {
    expect(
      infrastructureReasonFor(
        evidence("test_public.py::test_public_cases Timeout (>1.0s)"),
      ),
    ).toBeNull();
  });

  it("does not classify host cancellation or timeout as infrastructure", () => {
    expect(
      infrastructureReasonFor({ ...evidence(""), cancelled: true }),
    ).toBeNull();
    expect(
      infrastructureReasonFor({ ...evidence(""), timedOut: true }),
    ).toBeNull();
  });

  it("accepts successful language-neutral verifiers without parseable counts", () => {
    expect(
      infrastructureReasonFor({
        ...evidence("11 skipped"),
        exitCode: 0,
        passedCount: 0,
      }),
    ).toBeNull();
    expect(
      infrastructureReasonFor({
        ...evidence("11 passed"),
        exitCode: 0,
        passedCount: 11,
      }),
    ).toBeNull();
  });
});
