import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { root, run } from "./lib.mjs";

const temporaryDirectory = await mkdtemp(
  path.join(root, ".tmp-live-simulation-"),
);
const runner = path.join(temporaryDirectory, "live-simulation.cjs");
try {
  await build({
    absWorkingDir: root,
    entryPoints: [path.join(root, "src", "liveSimulationCli.ts")],
    outfile: runner,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    logLevel: "silent",
  });
  await run(process.execPath, [
    runner,
    root,
    process.env.CODEX_PATH ?? "codex",
  ]);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
