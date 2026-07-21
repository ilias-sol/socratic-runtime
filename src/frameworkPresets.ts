import { access, readFile } from "node:fs/promises";
import * as path from "node:path";
import type { ExerciseConfig, TargetSymbol } from "./types.js";

export interface FrameworkPreset {
  id: "pytest" | "vitest" | "jest" | "node-test";
  label: string;
  detail: string;
  language: string;
  command: string[];
  timeoutMs: number;
  snapshotExtension: string;
}

async function exists(candidate: string): Promise<boolean> {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function contains(candidate: string, pattern: RegExp): Promise<boolean> {
  try {
    const value = await readFile(candidate, "utf8");
    return value.length <= 256_000 && pattern.test(value);
  } catch {
    return false;
  }
}

async function packageMetadata(
  workspace: string,
): Promise<Record<string, unknown> | null> {
  try {
    const raw = await readFile(path.join(workspace, "package.json"), "utf8");
    if (raw.length > 256_000) return null;
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function dependencyNames(pkg: Record<string, unknown>): Set<string> {
  const names = new Set<string>();
  for (const field of ["dependencies", "devDependencies"]) {
    const value = pkg[field];
    if (value && typeof value === "object" && !Array.isArray(value))
      Object.keys(value).forEach((name) => names.add(name));
  }
  return names;
}

function testScript(pkg: Record<string, unknown>): string {
  const scripts = pkg.scripts;
  if (!scripts || typeof scripts !== "object" || Array.isArray(scripts))
    return "";
  const test = (scripts as Record<string, unknown>).test;
  return typeof test === "string" ? test : "";
}

export async function detectFrameworkPresets(
  workspace: string,
  languageId: string,
): Promise<FrameworkPreset[]> {
  const language = languageId.toLowerCase();
  const presets: FrameworkPreset[] = [];
  if (language === "python") {
    const indicators = await Promise.all([
      exists(path.join(workspace, "pytest.ini")),
      exists(path.join(workspace, "conftest.py")),
      exists(path.join(workspace, "tests", "conftest.py")),
      contains(path.join(workspace, "pyproject.toml"), /\bpytest\b/i),
      contains(path.join(workspace, "setup.cfg"), /\bpytest\b/i),
      contains(path.join(workspace, "tox.ini"), /\bpytest\b/i),
      contains(path.join(workspace, "requirements.txt"), /^pytest(?:\W|$)/im),
      contains(
        path.join(workspace, "requirements-dev.txt"),
        /^pytest(?:\W|$)/im,
      ),
    ]);
    if (indicators.some(Boolean))
      presets.push({
        id: "pytest",
        label: "pytest",
        detail: "Run the repository's pytest suite in a disposable copy",
        language: "python",
        command: ["${python}", "-m", "pytest", "-q", "-p", "no:cacheprovider"],
        timeoutMs: 30_000,
        snapshotExtension: ".py",
      });
  }

  if (
    ["javascript", "typescript", "javascriptreact", "typescriptreact"].includes(
      language,
    )
  ) {
    const pkg = await packageMetadata(workspace);
    if (pkg) {
      const dependencies = dependencyNames(pkg);
      const script = testScript(pkg);
      if (dependencies.has("vitest") || /\bvitest\b/i.test(script))
        presets.push({
          id: "vitest",
          label: "Vitest",
          detail:
            "Run npm test with Vitest's non-watch flag in a disposable copy",
          language: language.includes("typescript")
            ? "typescript"
            : "javascript",
          command: ["npm", "test", "--", "--run"],
          timeoutMs: 30_000,
          snapshotExtension: language.includes("typescript") ? ".ts" : ".js",
        });
      if (dependencies.has("jest") || /\bjest\b/i.test(script))
        presets.push({
          id: "jest",
          label: "Jest",
          detail: "Run npm test serially in a disposable copy",
          language: language.includes("typescript")
            ? "typescript"
            : "javascript",
          command: ["npm", "test", "--", "--runInBand"],
          timeoutMs: 30_000,
          snapshotExtension: language.includes("typescript") ? ".ts" : ".js",
        });
      if (/\bnode\s+--test\b/i.test(script))
        presets.push({
          id: "node-test",
          label: "Node test runner",
          detail: "Run the existing npm test script in a disposable copy",
          language: language.includes("typescript")
            ? "typescript"
            : "javascript",
          command: ["npm", "test"],
          timeoutMs: 30_000,
          snapshotExtension: language.includes("typescript") ? ".ts" : ".js",
        });
    }
  }
  return presets;
}

function safeExerciseId(workspace: string, symbol: string): string {
  const candidate = `${path.basename(workspace)}-${symbol}`
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return candidate || "socratic-exercise";
}

export function configForPreset(
  workspace: string,
  targetFile: string,
  target: TargetSymbol,
  preset: FrameworkPreset,
): ExerciseConfig {
  return {
    version: 1,
    id: safeExerciseId(workspace, target.name),
    language: preset.language,
    targetFile: targetFile.replaceAll("\\", "/"),
    targetSymbol: target.name,
    verification: {
      type: preset.id === "pytest" ? "pytest" : "command",
      command: preset.command,
      timeoutMs: preset.timeoutMs,
      snapshotExtension: preset.snapshotExtension,
      workspaceStrategy: "copy",
    },
  };
}
