import { mkdir } from "node:fs/promises";
import path from "node:path";
import { root, run } from "./lib.mjs";

await mkdir(path.join(root, "artifacts"), { recursive: true });
await run(process.execPath, [
  path.join(root, "node_modules", "@vscode", "vsce", "vsce"),
  "package",
  "--allow-missing-repository",
  "--no-dependencies",
  "--out",
  path.join(root, "artifacts", "socratic-runtime-0.1.0.vsix"),
]);
