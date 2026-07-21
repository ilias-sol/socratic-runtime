import { describe, expect, it } from "vitest";
import {
  boundedCode,
  compactDiff,
  taskFromMarker,
  taskFromSelection,
} from "../src/taskContext.js";

describe("language-agnostic task context", () => {
  it("reuses a Python task marker without asking again", () => {
    const task = taskFromMarker(
      '"""\n@socratic-task\nImplement binary search.\n- Return -1 when absent.\n"""\n\ndef search():\n    pass',
    );
    expect(task).toMatchObject({
      source: "marker",
      summary: "Implement binary search.",
    });
    expect(task?.text).toBe(
      "Implement binary search.\n- Return -1 when absent.",
    );
  });

  it("reads line-comment markers in non-Python languages", () => {
    expect(
      taskFromMarker(
        "// @socratic-task\n// Implement an LRU cache.\nclass Cache {}",
      ),
    ).toMatchObject({ source: "marker", summary: "Implement an LRU cache." });
  });

  it("reads a Java block-comment task without leaking its delimiter", () => {
    const task = taskFromMarker(
      "/*\n * @socratic-task\n * Implement binary search.\n */\nclass Search {}",
    );
    expect(task?.text).toBe("Implement binary search.");
    expect(task?.source).toBe("marker");
  });

  it("accepts a selected task in any language", () => {
    expect(taskFromSelection("Implement merge intervals.")).toMatchObject({
      source: "selection",
    });
  });

  it("bounds active-file context and emits a compact text diff", () => {
    expect(boundedCode("x".repeat(40), 20)).toContain("truncated");
    expect(compactDiff("return 0", "return -1")).toContain("+ 1: return -1");
  });
});
