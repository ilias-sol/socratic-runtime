import { spawn } from "node:child_process";
import { access, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import type * as vscode from "vscode";
import { fingerprintFailures } from "./policy.js";
import { appendBoundedTail } from "./processOutput.js";
import { terminateProcessTree } from "./processControl.js";
import { verificationEnvironment } from "./security.js";
import type { ExerciseConfig, VerificationResult } from "./types.js";
import { prepareDisposableWorkspace } from "./workspaceCopy.js";
import {
  infrastructureReasonFor,
  verifierExecutableMissingReason,
} from "./verificationClassification.js";

function executableFor(
  folder: vscode.WorkspaceFolder,
  configured: string,
  executionRoot = folder.uri.fsPath,
  snapshotFile?: string,
): string {
  const workspace = folder.uri.fsPath;
  const replaced = configured.replace("${workspaceFolder}", executionRoot);
  if (replaced === "${python}") {
    return process.platform === "win32"
      ? path.join(workspace, ".venv", "Scripts", "python.exe")
      : path.join(workspace, ".venv", "bin", "python");
  }
  return snapshotFile
    ? replaced.replaceAll("${snapshot}", snapshotFile)
    : replaced;
}

export function pathStaysInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function lastCount(output: string, patterns: RegExp[]): number {
  for (const pattern of patterns) {
    const matches = Array.from(output.matchAll(pattern), (match) =>
      Number(match[1]),
    ).filter(Number.isFinite);
    if (matches.length > 0) return matches.at(-1) ?? 0;
  }
  return 0;
}

function normalizedOutput(
  raw: string,
  workspace: string,
  snapshotDirectory?: string,
): string {
  const redacted = snapshotDirectory
    ? raw.replaceAll(snapshotDirectory, "<snapshot>")
    : raw;
  return redacted
    .replaceAll(workspace, "<workspace>")
    .replace(
      new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, "g"),
      "",
    )
    .slice(-16_000);
}

export class VerificationRunner implements vscode.Disposable {
  private active: ReturnType<typeof spawn> | null = null;

  cancel(): void {
    if (!this.active) return;
    terminateProcessTree(this.active);
    this.active = null;
  }

  dispose(): void {
    this.cancel();
  }

  async preflight(
    folder: vscode.WorkspaceFolder,
    config: ExerciseConfig,
  ): Promise<{ ready: boolean; reason?: string }> {
    const command = executableFor(folder, config.verification.command[0]!);
    if (!path.isAbsolute(command)) return { ready: true };
    try {
      await access(command);
      const [workspaceRoot, executablePath] = await Promise.all([
        realpath(folder.uri.fsPath),
        realpath(command),
      ]);
      if (!pathStaysInside(workspaceRoot, executablePath))
        return {
          ready: false,
          reason:
            "The trusted verifier executable must stay inside the workspace.",
        };
      return { ready: true };
    } catch {
      return {
        ready: false,
        reason: verifierExecutableMissingReason(),
      };
    }
  }

  async run(
    folder: vscode.WorkspaceFolder,
    config: ExerciseConfig,
    sourceSnapshot: string,
    token?: vscode.CancellationToken,
  ): Promise<VerificationResult> {
    this.cancel();
    const [command, ...configuredArgs] = config.verification.command;
    const started = Date.now();
    const snapshotDirectory = await mkdtemp(
      path.join(tmpdir(), "socratic-runtime-"),
    );
    const copyWorkspace = config.verification.workspaceStrategy === "copy";
    const executionRoot = copyWorkspace
      ? path.join(snapshotDirectory, "workspace")
      : folder.uri.fsPath;
    const configuredExtension = config.verification.snapshotExtension;
    const targetExtension = path.extname(config.targetFile);
    const snapshotFile = copyWorkspace
      ? path.join(executionRoot, config.targetFile)
      : path.join(
          snapshotDirectory,
          `candidate${configuredExtension || targetExtension || ".txt"}`,
        );
    try {
      if (copyWorkspace)
        await prepareDisposableWorkspace(
          folder.uri.fsPath,
          executionRoot,
          config.targetFile,
          sourceSnapshot,
        );
      else await writeFile(snapshotFile, sourceSnapshot, "utf8");
      const executable = executableFor(
        folder,
        command!,
        executionRoot,
        snapshotFile,
      );
      const args = configuredArgs.map((argument) =>
        executableFor(folder, argument, executionRoot, snapshotFile),
      );

      return await new Promise<VerificationResult>((resolve) => {
        let stdout = "";
        let stderr = "";
        let settled = false;
        let timedOut = false;
        let cancelled = false;
        let spawnError: string | null = null;
        const child = spawn(executable, args, {
          cwd: executionRoot,
          shell: false,
          windowsHide: true,
          env: {
            ...verificationEnvironment(process.env),
            PYTHONDONTWRITEBYTECODE: "1",
            PYTHONUTF8: "1",
            SOCRATIC_CHECK: "1",
            SOCRATIC_SOLUTION: snapshotFile,
            SOCRATIC_SNAPSHOT: snapshotFile,
            SOCRATIC_LANGUAGE: config.language,
          },
        });
        this.active = child;

        const finish = (exitCode: number | null): void => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          cancellation.dispose();
          this.active = null;
          const output = normalizedOutput(
            `${stdout}\n${stderr}`.trim(),
            folder.uri.fsPath,
            copyWorkspace ? executionRoot : snapshotDirectory,
          );
          const failedTests = Array.from(
            output.matchAll(/^FAILED\s+([^\s]+?)(?:\s+-|$)/gm),
            (match) => match[1]!,
          ).sort();
          const passedCount = lastCount(output, [
            /(\d+) passed/g,
            /Tests:\s+(\d+) passed/gi,
            /Tests run:\s*(\d+),\s*Failures:\s*0,\s*Errors:\s*0/gi,
          ]);
          const failedCount =
            lastCount(output, [
              /(\d+) failed/g,
              /Tests:\s+(\d+) failed/gi,
              /Failures:\s*(\d+)/gi,
              /Errors:\s*(\d+)/gi,
            ]) || failedTests.length;
          const syntaxError =
            /SyntaxError|IndentationError|(?:compile|compilation) error|error\s+CS\d+|cannot find symbol|expected\s*['";)}\]]/i.test(
              output,
            );
          const infrastructureReason = infrastructureReasonFor({
            output,
            spawnError,
            exitCode,
            passedCount,
            cancelled,
            timedOut,
          });
          const infrastructureFailure = infrastructureReason !== null;
          const passed =
            exitCode === 0 && !timedOut && !cancelled && !infrastructureFailure;
          const summary = timedOut
            ? `Check timed out after ${config.verification.timeoutMs} ms`
            : cancelled
              ? "Check cancelled"
              : infrastructureFailure
                ? "Verification unavailable"
                : passed
                  ? passedCount > 0
                    ? `Verified: ${passedCount} checks passed`
                    : "Verified: verifier exited successfully"
                  : failedCount > 0
                    ? `${failedCount} check${failedCount === 1 ? "" : "s"} failed`
                    : "Verification failed";
          resolve({
            passed,
            exitCode,
            timedOut,
            cancelled,
            durationMs: Date.now() - started,
            failedTests,
            passedCount,
            failedCount,
            summary,
            output,
            fingerprint: fingerprintFailures(
              failedTests,
              summary + output.slice(-800),
            ),
            syntaxError,
            infrastructureFailure,
            infrastructureReason,
            snapshotVerified: true,
          });
        };

        child.stdout.on(
          "data",
          (chunk: Buffer) =>
            (stdout = appendBoundedTail(stdout, chunk.toString("utf8"))),
        );
        child.stderr.on(
          "data",
          (chunk: Buffer) =>
            (stderr = appendBoundedTail(stderr, chunk.toString("utf8"))),
        );
        child.on("error", (error) => {
          spawnError = error.message;
          stderr += `\nUnable to start trusted verifier: ${error.message}`;
          finish(null);
        });
        child.on("close", finish);
        const timer = setTimeout(() => {
          timedOut = true;
          terminateProcessTree(child);
          setTimeout(() => finish(null), 1_000).unref();
        }, config.verification.timeoutMs);
        const cancellation = token?.onCancellationRequested(() => {
          cancelled = true;
          terminateProcessTree(child);
        }) ?? { dispose: () => undefined };
      });
    } catch (error) {
      const reason =
        error instanceof Error
          ? `Disposable verification setup failed: ${error.message}`
          : "Disposable verification setup failed";
      return {
        passed: false,
        exitCode: null,
        timedOut: false,
        cancelled: false,
        durationMs: Date.now() - started,
        failedTests: [],
        passedCount: 0,
        failedCount: 0,
        summary: "Verification unavailable",
        output: reason.slice(-2_000),
        fingerprint: fingerprintFailures([], reason),
        syntaxError: false,
        infrastructureFailure: true,
        infrastructureReason: reason,
        snapshotVerified: false,
      };
    } finally {
      await rm(snapshotDirectory, { recursive: true, force: true });
    }
  }
}
