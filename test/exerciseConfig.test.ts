import { describe, expect, it } from "vitest";
import { validateExerciseConfig } from "../src/exerciseConfig.js";

const valid = () => ({
  version: 1,
  id: "binary-search",
  language: "python",
  targetFile: "solution.py",
  targetSymbol: "binary_search",
  verification: {
    type: "pytest",
    command: ["${python}", "-m", "pytest", "-q", "-p", "no:cacheprovider"],
    timeoutMs: 10_000,
  },
  demo: { starterFile: "demo-states/starter.py" },
});

describe("trusted exercise config", () => {
  it("accepts the existing Python verifier configuration", () => {
    expect(validateExerciseConfig(valid())).toMatchObject({
      id: "binary-search",
      targetSymbol: "binary_search",
    });
  });

  it("accepts a language-neutral workspace-local verifier", () => {
    expect(
      validateExerciseConfig({
        ...valid(),
        language: "java",
        targetFile: "src/Solution.java",
        targetSymbol: "solve",
        verification: {
          type: "command",
          command: ["${workspaceFolder}/gradlew.bat", "test"],
          timeoutMs: 30_000,
          snapshotExtension: ".java",
          workspaceStrategy: "copy",
        },
      }),
    ).toMatchObject({ language: "java", verification: { type: "command" } });
  });

  it("accepts an author-provided post-completion reference", () => {
    expect(
      validateExerciseConfig({
        ...valid(),
        completion: {
          referenceSolution: "reference/solution.py",
          title: "Reference approach",
          explanation: "A compact explanation.",
          complexity: "O(log n) time.",
        },
      }),
    ).toMatchObject({ completion: { title: "Reference approach" } });
  });

  it.each([
    [
      "arbitrary executable",
      { verification: { command: ["powershell", "-m", "pytest"] } },
    ],
    [
      "python code execution",
      { verification: { command: ["${python}", "-c", "pytest"] } },
    ],
    ["npx auto-download", { verification: { command: ["npx", "vitest"] } }],
    ["target traversal", { targetFile: "../solution.py" }],
    ["absolute target", { targetFile: "C:\\outside\\solution.py" }],
    ["demo traversal", { demo: { starterFile: "../../starter.py" } }],
    [
      "workspace verifier traversal",
      {
        verification: {
          command: ["${workspaceFolder}/../outside.exe", "test"],
        },
      },
    ],
    [
      "nested workspace verifier traversal",
      {
        verification: {
          command: ["${workspaceFolder}/tools/../../outside.exe", "test"],
        },
      },
    ],
    [
      "reference traversal",
      {
        completion: {
          referenceSolution: "../solution.py",
          title: "Reference",
          explanation: "Explanation",
          complexity: "O(1)",
        },
      },
    ],
    ["unknown field", { unexpected: true }],
    [
      "unknown workspace strategy",
      { verification: { workspaceStrategy: "in-place" } },
    ],
  ])("rejects %s", (_name, override) => {
    const candidate = valid();
    const merged = {
      ...candidate,
      ...override,
      verification: {
        ...candidate.verification,
        ...(override as { verification?: object }).verification,
      },
    };
    expect(() => validateExerciseConfig(merged)).toThrow();
  });
});
