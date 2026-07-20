import * as path from "node:path";
import type { ExerciseConfig } from "./types.js";

const safeCommandArgument = /^[^\0\r\n]{1,512}$/;
const allowedExecutables = new Set([
  "${python}",
  "python",
  "python3",
  "pytest",
  "node",
  "npm",
  "java",
  "javac",
  "mvn",
  "mvnw",
  "mvnw.cmd",
  "gradle",
  "gradlew",
  "gradlew.bat",
  "dotnet",
  "cargo",
  "go",
]);
const allowedTopLevelKeys = new Set([
  "version",
  "id",
  "language",
  "targetFile",
  "targetSymbol",
  "verification",
  "demo",
  "completion",
]);
const allowedVerificationKeys = new Set([
  "type",
  "command",
  "timeoutMs",
  "snapshotExtension",
]);
const allowedDemoKeys = new Set(["starterFile"]);
const allowedCompletionKeys = new Set([
  "referenceSolution",
  "title",
  "explanation",
  "complexity",
]);

function assertOnlyKeys(
  value: Record<string, unknown>,
  allowed: Set<string>,
  field: string,
): void {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length > 0)
    throw new Error(`${field} contains unknown field: ${unknown.join(", ")}`);
}

function validateRelativeWorkspacePath(value: unknown, field: string): void {
  if (typeof value !== "string" || value.length === 0)
    throw new Error(`${field} is required`);
  if (
    value.includes("\0") ||
    path.posix.isAbsolute(value) ||
    path.win32.isAbsolute(value)
  ) {
    throw new Error(`${field} must be a relative workspace path`);
  }
  const segments = value.replaceAll("\\", "/").split("/");
  if (segments.some((segment) => segment === "" || segment === ".."))
    throw new Error(`${field} must stay inside the workspace`);
}

export function validateExerciseConfig(value: unknown): ExerciseConfig {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("exercise config must be an object");
  const raw = value as Record<string, unknown>;
  assertOnlyKeys(raw, allowedTopLevelKeys, "exercise config");
  const config = raw as unknown as Partial<ExerciseConfig>;
  if (config.version !== 1)
    throw new Error("exercise config version must be 1");
  if (
    typeof config.id !== "string" ||
    !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(config.id)
  ) {
    throw new Error("exercise id must be a short lowercase identifier");
  }
  if (
    typeof config.language !== "string" ||
    !/^[A-Za-z0-9_+.#-]{1,32}$/.test(config.language)
  )
    throw new Error("language must be a short language identifier");
  validateRelativeWorkspacePath(config.targetFile, "targetFile");
  if (
    typeof config.targetSymbol !== "string" ||
    !/^[A-Za-z_$][\w$]*$/.test(config.targetSymbol)
  ) {
    throw new Error("targetSymbol must be a source identifier");
  }

  const verification = config.verification;
  if (!verification || typeof verification !== "object")
    throw new Error("verification is required");
  assertOnlyKeys(
    verification as unknown as Record<string, unknown>,
    allowedVerificationKeys,
    "verification",
  );
  if (!verification || !["command", "pytest"].includes(verification.type))
    throw new Error("verification.type must be command");
  if (
    !Array.isArray(verification.command) ||
    verification.command.length < 1 ||
    verification.command.length > 32 ||
    verification.command.some(
      (part) => typeof part !== "string" || !safeCommandArgument.test(part),
    )
  ) {
    throw new Error("verification.command must be a bounded argument array");
  }
  const executable = verification.command[0]!;
  const normalizedExecutable = executable.replaceAll("\\", "/");
  const workspacePrefix = "${workspaceFolder}/";
  const workspaceExecutable = normalizedExecutable.startsWith(workspacePrefix);
  if (workspaceExecutable)
    validateRelativeWorkspacePath(
      normalizedExecutable.slice(workspacePrefix.length),
      "verification.command[0]",
    );
  if (!allowedExecutables.has(executable) && !workspaceExecutable)
    throw new Error(
      "verification executable must be a supported toolchain or a workspace-local wrapper",
    );
  if (
    ["${python}", "python", "python3", "node"].includes(executable) &&
    verification.command
      .slice(1)
      .some((part) => ["-c", "-e", "--eval"].includes(part))
  )
    throw new Error(
      "inline code execution is not permitted in verification.command",
    );
  if (
    verification.snapshotExtension !== undefined &&
    !/^\.[A-Za-z0-9]{1,10}$/.test(verification.snapshotExtension)
  )
    throw new Error(
      "verification.snapshotExtension must look like .py or .java",
    );
  if (
    !Number.isInteger(verification.timeoutMs) ||
    verification.timeoutMs < 1000 ||
    verification.timeoutMs > 60_000
  ) {
    throw new Error("verification.timeoutMs must be between 1000 and 60000");
  }

  if (config.demo !== undefined) {
    if (!config.demo || typeof config.demo !== "object")
      throw new Error("demo must be an object");
    assertOnlyKeys(
      config.demo as unknown as Record<string, unknown>,
      allowedDemoKeys,
      "demo",
    );
    validateRelativeWorkspacePath(config.demo.starterFile, "demo.starterFile");
  }
  if (config.completion !== undefined) {
    if (!config.completion || typeof config.completion !== "object")
      throw new Error("completion must be an object");
    assertOnlyKeys(
      config.completion as unknown as Record<string, unknown>,
      allowedCompletionKeys,
      "completion",
    );
    validateRelativeWorkspacePath(
      config.completion.referenceSolution,
      "completion.referenceSolution",
    );
    for (const [field, maximum] of [
      ["title", 100],
      ["explanation", 1_000],
      ["complexity", 300],
    ] as const) {
      const content = config.completion[field];
      if (
        typeof content !== "string" ||
        !content.trim() ||
        content.length > maximum ||
        /[\0\r]/.test(content)
      )
        throw new Error(
          `completion.${field} must be 1-${maximum} safe characters`,
        );
    }
  }
  return config as ExerciseConfig;
}
