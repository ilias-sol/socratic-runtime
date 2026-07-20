import { describe, expect, it } from "vitest";
import {
  classifyTaskBinding,
  chooseNearestTask,
  findTargetSymbol,
  parseTaskCandidates,
  selectedTask,
} from "../src/taskParser.js";

describe("task parser", () => {
  it("parses a triple-quoted task and associates the following function", () => {
    const source = `"""\n@socratic-task\nImplement search.\n"""\n\ndef binary_search(values, target):\n    pass\n`;
    const tasks = parseTaskCandidates(source);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.summary).toBe("Implement search.");
    expect(findTargetSymbol(source, tasks[0]!, "solution.py")).toMatchObject({
      name: "binary_search",
      kind: "function",
    });
  });

  it("parses line comments and classes", () => {
    const source = `# @socratic-task\n# Build a queue.\n\nclass Queue:\n    pass\n`;
    const task = parseTaskCandidates(source)[0]!;
    expect(task.source).toBe("line_comment");
    expect(findTargetSymbol(source, task, "queue.py")).toMatchObject({
      name: "Queue",
      kind: "class",
    });
  });

  it("parses Java block comments and associates a method", () => {
    const source = `/*\n * @socratic-task\n * Implement binary search.\n */\npublic static int binarySearch(int[] values, int target) {\n  return -1;\n}`;
    const task = parseTaskCandidates(source)[0]!;
    expect(task).toMatchObject({
      source: "block_comment",
      summary: "Implement binary search.",
    });
    expect(
      findTargetSymbol(source, task, "Solution.java", "java"),
    ).toMatchObject({
      name: "binarySearch",
      kind: "method",
    });
  });

  it("parses // task comments for JavaScript", () => {
    const source = `// @socratic-task\n// Merge the intervals.\nfunction mergeIntervals(values) { return values; }`;
    const task = parseTaskCandidates(source)[0]!;
    expect(
      findTargetSymbol(source, task, "solution.js", "javascript"),
    ).toMatchObject({
      name: "mergeIntervals",
      kind: "function",
    });
  });

  it("chooses the nearest of multiple task blocks", () => {
    const source = `"""@socratic-task\nFirst task\n"""\ndef first(): pass\n\n"""@socratic-task\nSecond task\n"""\ndef second(): pass`;
    const tasks = parseTaskCandidates(source);
    expect(chooseNearestTask(tasks, 7)?.summary).toBe("Second task");
  });

  it("rejects malformed and empty task markers", () => {
    expect(parseTaskCandidates('"""@socratic-task"""\ndef x(): pass')).toEqual(
      [],
    );
    expect(parseTaskCandidates("# ordinary comment\ndef x(): pass")).toEqual(
      [],
    );
  });

  it("supports selected-text fallback", () => {
    expect(selectedTask("Implement a stack", 4)).toMatchObject({
      source: "selection",
      startLine: 4,
    });
    expect(selectedTask("  ", 4)).toBeNull();
  });

  it("returns no symbol when intervening top-level code breaks association", () => {
    const source = `"""@socratic-task\nTask\n"""\nprint('unrelated')\ndef later(): pass`;
    const task = parseTaskCandidates(source)[0]!;
    expect(findTargetSymbol(source, task, "x.py")).toBeNull();
  });

  it("relocates an unchanged task and target after imports are inserted", () => {
    const original = `"""\n@socratic-task\nImplement search.\n"""\n\ndef binary_search():\n    pass\n`;
    const activeTask = parseTaskCandidates(original)[0]!;
    const target = findTargetSymbol(original, activeTask, "solution.py")!;
    const relocated = `from typing import Sequence\n\n${original}`;
    expect(classifyTaskBinding(relocated, activeTask, target)).toBe(
      "unchanged",
    );
  });

  it("detects changed, removed, and invalidated active task bindings", () => {
    const original = `"""\n@socratic-task\nImplement search.\n"""\n\ndef binary_search():\n    pass\n`;
    const activeTask = parseTaskCandidates(original)[0]!;
    const target = findTargetSymbol(original, activeTask, "solution.py")!;
    expect(
      classifyTaskBinding(
        original.replace("Implement search.", "Return a fixed answer."),
        activeTask,
        target,
      ),
    ).toBe("changed");
    expect(
      classifyTaskBinding(
        original.replace("@socratic-task", "ordinary"),
        activeTask,
        target,
      ),
    ).toBe("missing");
    expect(
      classifyTaskBinding(
        original.replace(
          "\n\ndef binary_search",
          "\n\nprint('break')\n\ndef binary_search",
        ),
        activeTask,
        target,
      ),
    ).toBe("missing");
  });
});
