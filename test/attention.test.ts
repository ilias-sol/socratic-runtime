import { describe, expect, it } from "vitest";
import { attentionLineRange, currentSymbolLine } from "../src/attention.js";

describe("attentionLineRange", () => {
  it("relocates a class after imports are inserted above it", () => {
    const lines = [
      "from collections import OrderedDict",
      "",
      "class LRUCache:",
      "    pass",
    ];
    expect(currentSymbolLine(lines, "LRUCache", 0)).toBe(2);
  });

  it("focuses the recently edited method inside a longer class", () => {
    const lines = [
      "class LRUCache:",
      "    def __init__(self, capacity):",
      "        self.capacity = capacity",
      "",
      "    def get(self, key):",
      "        return self.values.get(key, -1)",
      "",
      "    def put(self, key, value):",
      "        self.values[key] = value",
    ];
    expect(attentionLineRange(lines, 0, [0], [5])).toEqual({
      start: 5,
      end: 7,
    });
  });

  it("uses an in-target diagnostic when there is no recent edit", () => {
    const lines = ["def solve():", "    value = 1", "    return value"];
    expect(attentionLineRange(lines, 0, [1], [])).toEqual({
      start: 1,
      end: 2,
    });
  });

  it("falls back to nearby control flow", () => {
    const lines = [
      "def solve(values):",
      "    total = 0",
      "    for value in values:",
      "        total += value",
    ];
    expect(attentionLineRange(lines, 0, [], [])).toEqual({ start: 2, end: 3 });
  });
});
