import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
  configForPreset,
  detectFrameworkPresets,
} from "../src/frameworkPresets.js";

describe("framework presets", () => {
  it("detects pytest and builds disposable verification config", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "socratic-preset-"));
    try {
      await mkdir(path.join(workspace, "tests"));
      await writeFile(path.join(workspace, "tests", "conftest.py"), "");
      const presets = await detectFrameworkPresets(workspace, "python");
      expect(presets.map((preset) => preset.id)).toContain("pytest");
      const config = configForPreset(
        workspace,
        "solution.py",
        { name: "solve", kind: "function", line: 4, file: "solution.py" },
        presets[0]!,
      );
      expect(config).toMatchObject({
        targetFile: "solution.py",
        targetSymbol: "solve",
        verification: { workspaceStrategy: "copy" },
      });
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it("ranks detected JavaScript runners without inventing a generic script", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "socratic-preset-"));
    try {
      await writeFile(
        path.join(workspace, "package.json"),
        JSON.stringify({
          scripts: { test: "vitest" },
          devDependencies: { vitest: "1.0.0" },
        }),
      );
      const presets = await detectFrameworkPresets(workspace, "typescript");
      expect(presets).toMatchObject([
        { id: "vitest", command: ["npm", "test", "--", "--run"] },
      ]);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it("does not offer a preset without framework evidence", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "socratic-preset-"));
    try {
      expect(await detectFrameworkPresets(workspace, "python")).toEqual([]);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
