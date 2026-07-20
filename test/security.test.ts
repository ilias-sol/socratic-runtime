import { describe, expect, it } from "vitest";
import {
  assessmentRevisionKey,
  formatVerifierCommand,
  verificationEnvironment,
  verifierApprovalKey,
} from "../src/security.js";
import type { ExerciseConfig, VerificationResult } from "../src/types.js";

const config: ExerciseConfig = {
  version: 1,
  id: "exercise",
  language: "python",
  targetFile: "solution.py",
  targetSymbol: "solve",
  verification: {
    type: "command",
    command: ["python", "-m", "pytest", "tests with spaces"],
    timeoutMs: 10_000,
  },
};

const result = { fingerprint: "failure", exitCode: 1 } as VerificationResult;

describe("runtime security helpers", () => {
  it("requires fresh verifier approval after a command change", () => {
    const first = verifierApprovalKey("C:/workspace", config);
    const changed = verifierApprovalKey("C:/workspace", {
      ...config,
      verification: { ...config.verification, command: ["python", "check.py"] },
    });
    expect(changed).not.toBe(first);
    expect(formatVerifierCommand(config)).toContain('"tests with spaces"');
    const withReference = verifierApprovalKey("C:/workspace", {
      ...config,
      completion: {
        referenceSolution: "reference/solution.py",
        title: "Reference",
        explanation: "Explanation",
        complexity: "O(1)",
      },
    });
    expect(withReference).not.toBe(first);
  });

  it("deduplicates only the same session, source, and verification", () => {
    const first = assessmentRevisionKey("a", "source", result);
    expect(assessmentRevisionKey("a", "source", result)).toBe(first);
    expect(assessmentRevisionKey("a", "changed", result)).not.toBe(first);
    expect(assessmentRevisionKey("b", "source", result)).not.toBe(first);
  });

  it("does not expose ambient credentials to verifier processes", () => {
    const safe = verificationEnvironment({
      PATH: "tools",
      SYSTEMROOT: "windows",
      OPENAI_API_KEY: "secret",
      ACCESS_TOKEN: "secret",
      DB_PASSWORD: "secret",
    });
    expect(safe).toEqual({ PATH: "tools", SYSTEMROOT: "windows" });
  });
});
