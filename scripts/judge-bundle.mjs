import { cp, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { root, run } from "./lib.mjs";

const artifacts = path.join(root, "artifacts");
const bundle = path.join(artifacts, "judge-bundle");
const archive = path.join(artifacts, "socratic-runtime-judge-bundle.zip");
const packageJson = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
);
const vsixName = `socratic-runtime-${packageJson.version}.vsix`;
await rm(bundle, { recursive: true, force: true });
await rm(archive, { force: true });
await mkdir(bundle, { recursive: true });
await cp(path.join(artifacts, vsixName), path.join(bundle, vsixName));
await cp(
  path.join(root, "judge", "START-HERE.md"),
  path.join(bundle, "START-HERE.md"),
);
const demoSource = path.join(root, "sample-workspace", "binary-search");
const demoTarget = path.join(bundle, "binary-search-demo");
await mkdir(demoTarget, { recursive: true });
await cp(
  path.join(demoSource, "binary_search.py"),
  path.join(demoTarget, "binary_search.py"),
);
await cp(
  path.join(demoSource, "demo-states"),
  path.join(demoTarget, "demo-states"),
  { recursive: true },
);

if (process.platform === "win32")
  await run("powershell.exe", [
    "-NoProfile",
    "-Command",
    `Compress-Archive -LiteralPath '${bundle.replaceAll("'", "''")}' -DestinationPath '${archive.replaceAll("'", "''")}' -Force`,
  ]);
else
  await run("zip", ["-qr", archive, path.basename(bundle)], { cwd: artifacts });

console.log(`Judge bundle created: ${archive}`);
