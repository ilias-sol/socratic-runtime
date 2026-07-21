import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { prepareDisposableWorkspace } from "../src/workspaceCopy.js";

async function missing(candidate: string): Promise<boolean> {
  try {
    await access(candidate);
    return false;
  } catch {
    return true;
  }
}

describe("disposable workspace verification", () => {
  it("runs ordinary tests against the unsaved copied target", async () => {
    const source = await mkdtemp(path.join(tmpdir(), "socratic-source-"));
    const destinationParent = await mkdtemp(
      path.join(tmpdir(), "socratic-destination-"),
    );
    const destination = path.join(destinationParent, "workspace");
    try {
      await writeFile(
        path.join(source, "solution.mjs"),
        "export const answer = () => false;\n",
      );
      await writeFile(
        path.join(source, "solution.test.mjs"),
        'import assert from "node:assert/strict";\nimport test from "node:test";\nimport { answer } from "./solution.mjs";\ntest("answer", () => assert.equal(answer(), true));\n',
      );
      await prepareDisposableWorkspace(
        source,
        destination,
        "solution.mjs",
        "export const answer = () => true;\n",
      );
      const exitCode = await new Promise<number | null>((resolve, reject) => {
        const child = spawn(process.execPath, ["--test"], {
          cwd: destination,
          shell: false,
          windowsHide: true,
        });
        child.on("error", reject);
        child.on("close", resolve);
      });
      expect(exitCode).toBe(0);
      expect(
        await readFile(path.join(source, "solution.mjs"), "utf8"),
      ).toContain("false");
    } finally {
      await rm(source, { recursive: true, force: true });
      await rm(destinationParent, { recursive: true, force: true });
    }
  });

  it("replaces only the copied target and excludes repositories and secrets", async () => {
    const source = await mkdtemp(path.join(tmpdir(), "socratic-source-"));
    const destinationParent = await mkdtemp(
      path.join(tmpdir(), "socratic-destination-"),
    );
    const destination = path.join(destinationParent, "workspace");
    try {
      await mkdir(path.join(source, "src"));
      await mkdir(path.join(source, "tests"));
      await mkdir(path.join(source, ".git"));
      await writeFile(path.join(source, "src", "solution.py"), "original\n");
      await writeFile(
        path.join(source, "tests", "test_solution.py"),
        "tests\n",
      );
      await writeFile(path.join(source, ".env"), "TOKEN=secret\n");
      await writeFile(
        path.join(source, ".npmrc"),
        "//registry:_authToken=secret\n",
      );
      await writeFile(path.join(source, "id_ed25519"), "private key\n");
      await writeFile(path.join(source, ".git", "config"), "private\n");

      await prepareDisposableWorkspace(
        source,
        destination,
        "src/solution.py",
        "unsaved revision\n",
      );

      expect(
        await readFile(path.join(destination, "src", "solution.py"), "utf8"),
      ).toBe("unsaved revision\n");
      expect(
        await readFile(
          path.join(destination, "tests", "test_solution.py"),
          "utf8",
        ),
      ).toBe("tests\n");
      expect(
        await readFile(path.join(source, "src", "solution.py"), "utf8"),
      ).toBe("original\n");
      expect(await missing(path.join(destination, ".env"))).toBe(true);
      expect(await missing(path.join(destination, ".npmrc"))).toBe(true);
      expect(await missing(path.join(destination, "id_ed25519"))).toBe(true);
      expect(await missing(path.join(destination, ".git"))).toBe(true);
    } finally {
      await rm(source, { recursive: true, force: true });
      await rm(destinationParent, { recursive: true, force: true });
    }
  });

  it("rejects a target outside the disposable root", async () => {
    const source = await mkdtemp(path.join(tmpdir(), "socratic-source-"));
    const destinationParent = await mkdtemp(
      path.join(tmpdir(), "socratic-destination-"),
    );
    try {
      await expect(
        prepareDisposableWorkspace(
          source,
          path.join(destinationParent, "workspace"),
          "../escape.py",
          "escape",
        ),
      ).rejects.toThrow(/escaped/);
    } finally {
      await rm(source, { recursive: true, force: true });
      await rm(destinationParent, { recursive: true, force: true });
    }
  });
});
