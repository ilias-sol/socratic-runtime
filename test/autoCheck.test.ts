import { describe, expect, it } from "vitest";
import {
  autoCheckDelay,
  isCurrentAnalysisContext,
  isCurrentRevision,
  normalizeAutoCheckDebounce,
  normalizeAutoCheckInterval,
  normalizeAutoPauseAfter,
  shouldReverifyAfterEdit,
  shouldRunAutoCheck,
} from "../src/autoCheck.js";

const state = (overrides: Record<string, unknown> = {}) => ({
  active: true,
  verified: false,
  checking: false,
  pendingRevision: true,
  currentCode: "revision two",
  lastCheckedCode: "revision one",
  revision: 2,
  scheduledRevision: 2,
  ...overrides,
});

describe("automatic verification scheduling", () => {
  it("checks a new revision while an active session is watching", () => {
    expect(shouldRunAutoCheck(state())).toBe(true);
  });

  it.each([
    ["inactive session", { active: false }],
    ["verified session", { verified: true }],
    ["check in progress", { checking: true }],
    ["no pending edit", { pendingRevision: false }],
    ["unchanged code", { currentCode: "same", lastCheckedCode: "same" }],
    ["stale timer", { revision: 3, scheduledRevision: 2 }],
  ])("skips %s", (_name, overrides) => {
    expect(shouldRunAutoCheck(state(overrides))).toBe(false);
  });

  it("keeps the interval within safe UX limits", () => {
    expect(normalizeAutoCheckInterval(500)).toBe(2000);
    expect(normalizeAutoCheckInterval(5000)).toBe(5000);
    expect(normalizeAutoCheckInterval(100000)).toBe(60000);
    expect(normalizeAutoCheckInterval(Number.NaN)).toBe(5000);
  });

  it("debounces edits within safe responsiveness limits", () => {
    expect(normalizeAutoCheckDebounce(100)).toBe(1000);
    expect(normalizeAutoCheckDebounce(2000)).toBe(2000);
    expect(normalizeAutoCheckDebounce(12000)).toBe(10000);
    expect(normalizeAutoCheckDebounce(Number.NaN)).toBe(4000);
  });

  it("checks initial state quickly and edited state after the idle window", () => {
    expect(autoCheckDelay(true, 5000, 4000)).toBe(500);
    expect(autoCheckDelay(false, 5000, 4000)).toBe(4000);
    expect(autoCheckDelay(false, 2500, 4000)).toBe(2500);
  });

  it("normalizes inactivity auto-pause without turning it into a check", () => {
    expect(normalizeAutoPauseAfter(0)).toBe(0);
    expect(normalizeAutoPauseAfter(10_000)).toBe(60_000);
    expect(normalizeAutoPauseAfter(600_000)).toBe(600_000);
    expect(normalizeAutoPauseAfter(9_000_000)).toBe(7_200_000);
    expect(normalizeAutoPauseAfter(Number.NaN)).toBe(600_000);
  });

  it("rejects results from an older document revision", () => {
    expect(isCurrentRevision(4, 4)).toBe(true);
    expect(isCurrentRevision(4, 5)).toBe(false);
  });

  it("rejects provider results from a stale revision or replaced session", () => {
    expect(isCurrentAnalysisContext("session-a", "session-a", 4, 4)).toBe(true);
    expect(isCurrentAnalysisContext("session-a", "session-a", 4, 5)).toBe(
      false,
    );
    expect(isCurrentAnalysisContext("session-b", "session-a", 4, 4)).toBe(
      false,
    );
    expect(isCurrentAnalysisContext(null, "session-a", 4, 4)).toBe(false);
  });

  it("requires a fresh verification after an edit to completed code", () => {
    expect(shouldReverifyAfterEdit("verified_complete")).toBe(true);
    expect(shouldReverifyAfterEdit("observing")).toBe(false);
  });
});
