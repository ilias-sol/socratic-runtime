import { describe, expect, it } from "vitest";
import { isHelpAction } from "../src/helpActions.js";

describe("Learning Support message validation", () => {
  it.each([
    "dismiss",
    "investigating",
    "moreHelp",
    "pauseHints",
    "resumeHints",
    "resumeWatching",
    "showReference",
    "configurePreset",
    "rerunSetupDoctor",
  ])("accepts the allowlisted action %s", (action) => {
    expect(isHelpAction(action)).toBe(true);
  });

  it.each(["unexpected", "", null, { action: "dismiss" }])(
    "rejects the untrusted action %s",
    (action) => {
      expect(isHelpAction(action)).toBe(false);
    },
  );
});
