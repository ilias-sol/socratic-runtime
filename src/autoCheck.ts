export interface AutoCheckState {
  active: boolean;
  verified: boolean;
  checking: boolean;
  pendingRevision: boolean;
  currentCode: string;
  lastCheckedCode: string | null;
  revision: number;
  scheduledRevision: number;
}

export function normalizeAutoCheckInterval(value: number): number {
  if (!Number.isFinite(value)) return 5_000;
  return Math.min(60_000, Math.max(2_000, Math.round(value)));
}

export function normalizeAutoCheckDebounce(value: number): number {
  if (!Number.isFinite(value)) return 4_000;
  return Math.min(10_000, Math.max(1_000, Math.round(value)));
}

export function normalizeAutoPauseAfter(value: number): number {
  if (!Number.isFinite(value)) return 600_000;
  if (value <= 0) return 0;
  return Math.min(7_200_000, Math.max(60_000, Math.round(value)));
}

export function autoCheckDelay(
  initial: boolean,
  intervalMs: number,
  debounceMs: number,
): number {
  return initial
    ? Math.min(500, normalizeAutoCheckDebounce(debounceMs))
    : Math.min(
        normalizeAutoCheckInterval(intervalMs),
        normalizeAutoCheckDebounce(debounceMs),
      );
}

export function shouldRunAutoCheck(state: AutoCheckState): boolean {
  return (
    state.active &&
    !state.verified &&
    !state.checking &&
    state.pendingRevision &&
    state.revision === state.scheduledRevision &&
    state.currentCode !== state.lastCheckedCode
  );
}

export function isCurrentRevision(
  checkedRevision: number,
  currentRevision: number,
): boolean {
  return checkedRevision === currentRevision;
}

export function isCurrentAnalysisContext(
  activeSessionId: string | null,
  analyzedSessionId: string,
  analyzedRevision: number,
  currentRevision: number,
): boolean {
  return (
    activeSessionId === analyzedSessionId &&
    isCurrentRevision(analyzedRevision, currentRevision)
  );
}

export function shouldReverifyAfterEdit(phase: string): boolean {
  return phase === "verified_complete";
}
