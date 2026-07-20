import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { root, run } from "./lib.mjs";

const temporaryDirectory = await mkdtemp(path.join(root, ".tmp-evaluation-"));
const runner = path.join(temporaryDirectory, "evaluation.cjs");
try {
  await build({
    absWorkingDir: root,
    entryPoints: [path.join(root, "src", "evaluationCli.ts")],
    outfile: runner,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    logLevel: "silent",
  });
  await run(process.execPath, [
    runner,
    path.join(root, "evals", "traces", "suite.json"),
    path.join(root, "artifacts", "eval-reports", "latest.json"),
  ]);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
