export const helpActions = [
  "askForNudge",
  "dismissQuestion",
  "pause",
  "resume",
  "endSession",
] as const;

export type HelpAction = (typeof helpActions)[number];

export function isHelpAction(value: unknown): value is HelpAction {
  return (
    typeof value === "string" &&
    (helpActions as readonly string[]).includes(value)
  );
}
