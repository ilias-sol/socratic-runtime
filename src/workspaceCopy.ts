import {
  cp,
  lstat,
  mkdir,
  readFile,
  symlink,
  writeFile,
} from "node:fs/promises";
import * as path from "node:path";

const excludedDirectories = new Set([
  ".git",
  ".venv",
  "venv",
  "node_modules",
  ".pytest_cache",
  ".hypothesis",
  "__pycache__",
  ".vscode-test",
  ".pnpm-store",
  "artifacts",
]);
const sensitiveFile =
  /^(?:\.env(?:\..*)?|\.npmrc|\.pypirc|auth\.json|credentials(?:\.json)?|id_(?:rsa|dsa|ecdsa|ed25519)|.*\.(?:pem|key|p12))$/i;

export const MAX_DISPOSABLE_FILES = 50_000;
export const MAX_DISPOSABLE_BYTES = 256 * 1024 * 1024;

/** Copy project inputs without repositories, dependencies, caches, or common secrets. */
export async function prepareDisposableWorkspace(
  sourceRoot: string,
  destinationRoot: string,
  targetFile: string,
  sourceSnapshot: string,
): Promise<void> {
  let files = 0;
  let bytes = 0;
  await cp(sourceRoot, destinationRoot, {
    recursive: true,
    filter: async (source) => {
      if (path.resolve(source) === path.resolve(sourceRoot)) return true;
      const name = path.basename(source);
      const stat = await lstat(source);
      if (stat.isSymbolicLink()) return false;
      if (stat.isDirectory()) return !excludedDirectories.has(name);
      if (sensitiveFile.test(name)) return false;
      files += 1;
      bytes += stat.size;
      if (files > MAX_DISPOSABLE_FILES || bytes > MAX_DISPOSABLE_BYTES)
        throw new Error(
          "Workspace is too large for disposable verification (limit: 50000 files or 256 MB).",
        );
      return true;
    },
  });

  const destinationTarget = path.resolve(destinationRoot, targetFile);
  const relative = path.relative(destinationRoot, destinationTarget);
  if (
    relative === "" ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw new Error("Disposable verification target escaped the workspace.");
  await mkdir(path.dirname(destinationTarget), { recursive: true });
  await writeFile(destinationTarget, sourceSnapshot, "utf8");

  const sourceModules = path.join(sourceRoot, "node_modules");
  try {
    if ((await lstat(sourceModules)).isDirectory())
      await symlink(
        sourceModules,
        path.join(destinationRoot, "node_modules"),
        process.platform === "win32" ? "junction" : "dir",
      );
  } catch {
    // JavaScript presets surface missing dependencies through verifier output.
  }
}

export async function readDisposableTarget(
  destinationRoot: string,
  targetFile: string,
): Promise<string> {
  return await readFile(path.join(destinationRoot, targetFile), "utf8");
}
