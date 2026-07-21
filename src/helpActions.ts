export const helpActions = [
  "dismiss",
  "investigating",
  "moreHelp",
  "pauseHints",
  "resumeHints",
  "resumeWatching",
  "showReference",
  "configurePreset",
  "rerunSetupDoctor",
] as const;

export type HelpAction = (typeof helpActions)[number];

export function nudgeActionLabel(supportCount: number): string {
  return supportCount === 0 ? "Ask for a nudge" : "I need another nudge";
}

export interface NudgeAvailability {
  hintsPaused: boolean;
  hasFailedAssessment: boolean;
  verifiedComplete: boolean;
  supportCount: number;
  maximumSupports: number;
}

export function availableNudgeSupportCount({
  hintsPaused,
  hasFailedAssessment,
  verifiedComplete,
  supportCount,
  maximumSupports,
}: NudgeAvailability): number | null {
  return !hintsPaused &&
    hasFailedAssessment &&
    !verifiedComplete &&
    supportCount < maximumSupports
    ? supportCount
    : null;
}

export function isHelpAction(value: unknown): value is HelpAction {
  return (
    typeof value === "string" &&
    (helpActions as readonly string[]).includes(value)
  );
}
