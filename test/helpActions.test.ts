import { describe, expect, it } from "vitest";
import {
  availableNudgeSupportCount,
  isHelpAction,
  nudgeActionLabel,
} from "../src/helpActions.js";

describe("Learning Support message validation", () => {
  it("offers an initial nudge before any automatic question", () => {
    expect(nudgeActionLabel(0)).toBe("Ask for a nudge");
    expect(nudgeActionLabel(1)).toBe("I need another nudge");
  });

  it("keeps the first nudge reachable after a silent failed assessment", () => {
    expect(
      availableNudgeSupportCount({
        hintsPaused: false,
        hasFailedAssessment: true,
        verifiedComplete: false,
        supportCount: 0,
        maximumSupports: 3,
      }),
    ).toBe(0);
  });

  it("hides the nudge action when paused, complete, or exhausted", () => {
    const base = {
      hintsPaused: false,
      hasFailedAssessment: true,
      verifiedComplete: false,
      supportCount: 0,
      maximumSupports: 3,
    };
    expect(
      availableNudgeSupportCount({ ...base, hintsPaused: true }),
    ).toBeNull();
    expect(
      availableNudgeSupportCount({ ...base, verifiedComplete: true }),
    ).toBeNull();
    expect(availableNudgeSupportCount({ ...base, supportCount: 3 })).toBeNull();
  });

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
