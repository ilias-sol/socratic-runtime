import { describe, expect, it } from "vitest";
import { DEFAULT_IDLE_DELAY_MS } from "../src/runtimeConfig.js";

describe("runtime configuration", () => {
  it("waits two seconds after the learner stops typing", () => {
    expect(DEFAULT_IDLE_DELAY_MS).toBe(2_000);
  });
});
