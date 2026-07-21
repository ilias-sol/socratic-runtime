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
await cp(
  path.join(root, "judge", "setup-demo.ps1"),
  path.join(bundle, "setup-demo.ps1"),
);
await cp(
  path.join(root, "sample-workspace", "binary-search"),
  path.join(bundle, "binary-search-demo"),
  {
    recursive: true,
    filter: (source) =>
      !/(?:^|[\\/])(?:\.venv|\.pytest_cache|\.hypothesis|__pycache__)(?:[\\/]|$)/.test(
        source,
      ),
  },
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
