import path from "node:path";
import process from "node:process";
import { runTests } from "@vscode/test-electron";
import { exists, root } from "./lib.mjs";

const candidates = [
  process.env.VSCODE_EXECUTABLE_PATH,
  process.platform === "win32"
    ? path.join(
        process.env.LOCALAPPDATA ?? "",
        "Programs",
        "Microsoft VS Code",
        "Code.exe",
      )
    : undefined,
  process.platform === "darwin"
    ? "/Applications/Visual Studio Code.app/Contents/MacOS/Electron"
    : undefined,
  process.platform === "linux" ? "/usr/bin/code" : undefined,
].filter(Boolean);
const executable = (
  await Promise.all(
    candidates.map(async (candidate) =>
      (await exists(candidate)) ? candidate : null,
    ),
  )
).find(Boolean);
if (!executable)
  throw new Error("VS Code executable not found. Set VSCODE_EXECUTABLE_PATH.");
await runTests({
  vscodeExecutablePath: executable,
  extensionDevelopmentPath: root,
  extensionTestsPath: path.join(root, "dist", "extension-test.js"),
  launchArgs: [
    path.join(root, "sample-workspace", "binary-search"),
    "--disable-extensions",
    "--skip-welcome",
    "--skip-release-notes",
  ],
});
