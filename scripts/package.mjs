import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { root, run } from "./lib.mjs";

await mkdir(path.join(root, "artifacts"), { recursive: true });
const packageJson = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
);
await run(process.execPath, [
  path.join(root, "node_modules", "@vscode", "vsce", "vsce"),
  "package",
  "--allow-missing-repository",
  "--no-dependencies",
  "--out",
  path.join(root, "artifacts", `socratic-runtime-${packageJson.version}.vsix`),
]);
