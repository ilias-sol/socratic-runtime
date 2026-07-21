import { describe, expect, it } from "vitest";
import { helpActions, isHelpAction } from "../src/helpActions.js";

describe("Learning Support actions", () => {
  it("accepts only the small language-neutral session surface", () => {
    expect(helpActions).toEqual([
      "askForNudge",
      "dismissQuestion",
      "pause",
      "resume",
      "endSession",
    ]);
    for (const action of helpActions) expect(isHelpAction(action)).toBe(true);
    expect(isHelpAction("runSetupDoctor")).toBe(false);
    expect(isHelpAction({ action: "askForNudge" })).toBe(false);
  });
});
