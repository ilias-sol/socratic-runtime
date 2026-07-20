import esbuild from "esbuild";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { root } from "./lib.mjs";

await mkdir(path.join(root, "dist"), { recursive: true });
await Promise.all([
  esbuild.build({
    absWorkingDir: root,
    entryPoints: [path.join(root, "src", "extension.ts")],
    outfile: path.join(root, "dist", "extension.js"),
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    external: ["vscode"],
    sourcemap: true,
    logLevel: "info",
  }),
  esbuild.build({
    absWorkingDir: root,
    entryPoints: [path.join(root, "test", "extension", "suite.ts")],
    outfile: path.join(root, "dist", "extension-test.js"),
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    external: ["vscode"],
    sourcemap: true,
    logLevel: "info",
  }),
]);
