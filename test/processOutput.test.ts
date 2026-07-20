import { describe, expect, it } from "vitest";
import { appendBoundedTail } from "../src/processOutput.js";

describe("bounded child-process output", () => {
  it("retains only the useful tail once the limit is exceeded", () => {
    const output = appendBoundedTail("old-prefix", "new-diagnostic", 12);
    expect(output).toBe("w-diagnostic");
    expect(output).toHaveLength(12);
  });

  it("handles disabled and not-yet-full buffers", () => {
    expect(appendBoundedTail("a", "b", 8)).toBe("ab");
    expect(appendBoundedTail("a", "b", 0)).toBe("");
  });
});
