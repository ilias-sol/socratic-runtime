import { copyFile, rm } from "node:fs/promises";
import path from "node:path";
import { root } from "./lib.mjs";

const workspace = path.join(root, "sample-workspace", "binary-search");
await copyFile(
  path.join(workspace, "demo-states", "starter.py"),
  path.join(workspace, "binary_search.py"),
);
for (const directory of ["tests/__pycache__", "__pycache__"]) {
  await rm(path.join(workspace, directory), {
    recursive: true,
    force: true,
  }).catch(() => undefined);
}
console.log("Demo reset: sample-workspace/binary-search/binary_search.py");
