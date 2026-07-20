import { describe, expect, it } from "vitest";
import { compactRevisionDiff, extractTargetCode } from "../src/packet.js";

describe("minimal learner-state packets", () => {
  it("extracts only the selected Python target", () => {
    const source =
      "secret = 'unrelated'\n\ndef solve(x):\n    return x\n\ndef other():\n    return secret";
    const target = extractTargetCode(
      source,
      { name: "solve", kind: "function", line: 2, file: "solution.py" },
      "python",
    );
    expect(target).toContain("def solve");
    expect(target).not.toContain("secret");
    expect(target).not.toContain("def other");
  });

  it("stops a Python packet at unrelated top-level data", () => {
    const source =
      "def solve(x):\n    return x\n\nPRIVATE_CONFIGURATION = 'do not send'";
    const target = extractTargetCode(
      source,
      { name: "solve", kind: "function", line: 0, file: "solution.py" },
      "python",
    );
    expect(target).toBe("def solve(x):\n    return x");
  });

  it("extracts a balanced braced target and emits a bounded diff", () => {
    const source =
      "class Other {}\nint solve(int x) {\n  if (x > 0) { return x; }\n  return 0;\n}\nclass Secret {}";
    const target = extractTargetCode(
      source,
      { name: "solve", kind: "method", line: 1, file: "Solution.java" },
      "java",
    );
    expect(target).toContain("return 0");
    expect(target).not.toContain("Secret");
    expect(compactRevisionDiff("return 0", "return x")).toContain(
      "+ 1: return x",
    );
  });

  it("ignores braces in strings and comments while extracting braced code", () => {
    const source =
      'int solve(int x) {\n  String text = "}"; // }\n  /* { } */\n  return x;\n}\nclass Secret {}';
    const target = extractTargetCode(
      source,
      { name: "solve", kind: "method", line: 0, file: "Solution.java" },
      "java",
    );
    expect(target).toContain("return x");
    expect(target).not.toContain("Secret");
  });
});
