import { createHash } from "node:crypto";
import type { ExerciseConfig, VerificationResult } from "./types.js";

export function verifierApprovalKey(
  workspacePath: string,
  config: ExerciseConfig,
): string {
  const payload = JSON.stringify({
    workspacePath,
    id: config.id,
    language: config.language,
    targetFile: config.targetFile,
    targetSymbol: config.targetSymbol,
    verification: config.verification,
    completion: config.completion,
  });
  return `verifierApproval:${createHash("sha256").update(payload).digest("hex")}`;
}

export function formatVerifierCommand(config: ExerciseConfig): string {
  return config.verification.command
    .map((part) => (/\s/.test(part) ? JSON.stringify(part) : part))
    .join(" ");
}

export function assessmentRevisionKey(
  sessionId: string,
  source: string,
  result: VerificationResult,
): string {
  return createHash("sha256")
    .update(sessionId)
    .update("\0")
    .update(source)
    .update("\0")
    .update(result.fingerprint)
    .update("\0")
    .update(String(result.exitCode))
    .digest("hex");
}

export function verificationEnvironment(
  environment: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  const safe: NodeJS.ProcessEnv = {};
  const sensitive =
    /(?:^|_)(?:TOKEN|SECRET|PASSWORD|PASSWD|API_KEY|AUTH)(?:_|$)/i;
  for (const [key, value] of Object.entries(environment))
    if (!sensitive.test(key)) safe[key] = value;
  return safe;
}
