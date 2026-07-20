export interface VerificationExitEvidence {
  output: string;
  spawnError: string | null;
  exitCode: number | null;
  passedCount: number;
  cancelled: boolean;
  timedOut: boolean;
}

export function verifierExecutableMissingReason(): string {
  return "The trusted verifier executable is missing. Complete the workspace setup, then try again.";
}

const infrastructurePattern =
  /No module named ['"]?(?:pytest|hypothesis|pytest_timeout)|ImportError while loading conftest|pytest:\s*error:\s*unrecognized arguments|ERROR:\s*file or directory not found|collected 0 items|no tests ran/i;

export function infrastructureReasonFor(
  evidence: VerificationExitEvidence,
): string | null {
  if (evidence.spawnError)
    return "Unable to start the trusted verifier in this workspace.";
  if (
    !evidence.cancelled &&
    !evidence.timedOut &&
    evidence.exitCode !== 0 &&
    infrastructurePattern.test(evidence.output)
  )
    return "The trusted verifier environment or test configuration is unavailable.";
  return null;
}
