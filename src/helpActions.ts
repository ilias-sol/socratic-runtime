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

export function isHelpAction(value: unknown): value is HelpAction {
  return (
    typeof value === "string" &&
    (helpActions as readonly string[]).includes(value)
  );
}
