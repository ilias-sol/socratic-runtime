import { describe, expect, it } from "vitest";
import path from "node:path";
import {
  CodexLunaProvider,
  codexEnvironment,
  LUNA_MODEL,
  LUNA_REASONING_EFFORT,
  validateAssessment,
  validateReference,
  validateTaskInference,
} from "../src/providers.js";
import type { AssessmentPacket } from "../src/types.js";

const packet = (currentCode: string): AssessmentPacket => ({
  task: {
    text: "Implement a search function",
    summary: "Implement a search function",
    source: "marker",
  },
  languageId: "python",
  fileName: "solution.py",
  previousCode: "pass",
  currentCode,
  revisionDiff: "+ revision",
  diagnostics: [],
  trajectorySummary: "The learner started the task.",
  recentEvents: [],
  explicitHelpRequested: false,
});

function provider(): CodexLunaProvider {
  return new CodexLunaProvider(
    process.execPath,
    path.resolve(".agents", "skills", "socratic-runtime"),
    [path.resolve("test", "fixtures", "fake-codex.mjs")],
  );
}

describe("GPT-5.6 Luna provider", () => {
  it("uses one pinned medium-reasoning model", () => {
    expect(LUNA_MODEL).toBe("gpt-5.6-luna");
    expect(LUNA_REASONING_EFFORT).toBe("medium");
  });

  it("passes only environment required for local Codex discovery", () => {
    expect(
      codexEnvironment({
        PATH: "tools",
        USERPROFILE: "profile",
        OPENAI_API_KEY: "secret",
        GITHUB_TOKEN: "secret",
      }),
    ).toEqual({ PATH: "tools", USERPROFILE: "profile" });
  });

  it("infers a task without requiring project configuration", async () => {
    const result = await provider().inferTask("python", "solution.py", "pass");
    expect(result).toMatchObject({
      model: "gpt-5.6-luna",
      error: null,
      value: "Implement a language-neutral search function.",
    });
  });

  it("loops through silence, a question, completion, and a reference", async () => {
    const luna = provider();
    const progress = await luna.assess(packet("PROGRESS_REVISION"));
    const stalled = await luna.assess(packet("STALLED_REVISION"));
    const laterStall = await luna.assess(packet("STALLED_REVISION"));
    const complete = await luna.assess(packet("COMPLETE_REVISION"));
    expect(progress.value?.action).toBe("remain_silent");
    expect(stalled.value).toMatchObject({
      learnerState: "stalled",
      action: "ask_question",
    });
    expect(laterStall.value?.action).toBe("ask_question");
    expect(complete.value?.action).toBe("complete");
    const reference = await luna.createReference(
      packet("COMPLETE_REVISION"),
      complete.value!.completionSummary!,
    );
    expect(reference.value).toMatchObject({
      title: "Reference approach",
      code: "REFERENCE_CODE",
    });
  });

  it("rejects expanded or internally inconsistent model output", () => {
    expect(() => validateTaskInference({ task: "x", extra: true })).toThrow();
    expect(() =>
      validateAssessment({
        learnerState: "complete",
        action: "remain_silent",
        question: null,
        assessment: "done",
        trajectorySummary: "done",
        completionSummary: "done",
      }),
    ).toThrow(/complete/i);
    expect(() =>
      validateReference({
        title: "Reference",
        code: "",
        explanation: "why",
        complexity: "O(1)",
      }),
    ).toThrow(/code/);
  });
});
