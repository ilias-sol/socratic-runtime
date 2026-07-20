import path from "node:path";
import process from "node:process";
import { exists, root, run } from "./lib.mjs";

const workspace = path.join(root, "sample-workspace", "binary-search");
const venvPython =
  process.platform === "win32"
    ? path.join(workspace, ".venv", "Scripts", "python.exe")
    : path.join(workspace, ".venv", "bin", "python");
if (!(await exists(venvPython))) {
  const bootstrap =
    process.env.PYTHON_BOOTSTRAP ??
    (process.platform === "win32" ? "python" : "python3");
  await run(bootstrap, ["-m", "venv", path.join(workspace, ".venv")]);
}
await run(venvPython, [
  "-m",
  "pip",
  "install",
  "--disable-pip-version-check",
  "-r",
  path.join(workspace, "requirements.txt"),
]);
console.log(`Python environment ready: ${venvPython}`);
