import { describe, expect, it } from "vitest";
import { assessmentStatusCopy, guidanceResult } from "../src/guidance.js";

describe("guidance-only evidence", () => {
  it("can never represent executable completion", () => {
    expect(
      guidanceResult([{ severity: "error", message: "Undefined name" }]),
    ).toMatchObject({
      passed: false,
      snapshotVerified: false,
      failedCount: 0,
      infrastructureFailure: false,
      summary: "Guidance-only revision; correctness was not verified",
    });
  });

  it("bounds editor diagnostic evidence", () => {
    const result = guidanceResult(
      Array.from({ length: 30 }, (_, index) => ({
        severity: "warning" as const,
        message: `${index} ${"x".repeat(400)}`,
      })),
    );
    expect(result.output.split("\n")).toHaveLength(20);
    expect(
      Math.max(...result.output.split("\n").map((line) => line.length)),
    ).toBeLessThanOrEqual(249);
  });

  it("never describes guidance-only assessment as an executable failure", () => {
    const copy = assessmentStatusCopy(true);
    expect(copy).toContain("No executable verifier is active");
    expect(copy).toContain("correctness and completion claims remain disabled");
    expect(copy).not.toContain("Executable checks found a failure");
  });
});
