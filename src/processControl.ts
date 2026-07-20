import { spawn, type ChildProcess } from "node:child_process";

/** Terminate the owned process and, on Windows, any verifier/model descendants. */
export function terminateProcessTree(child: ChildProcess): void {
  if (child.exitCode !== null || child.killed) return;
  if (process.platform !== "win32" || !child.pid) {
    child.kill();
    return;
  }
  const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
    shell: false,
    windowsHide: true,
    stdio: "ignore",
  });
  killer.on("error", () => child.kill());
  killer.on("close", () => {
    if (child.exitCode === null) child.kill();
  });
  setTimeout(() => {
    if (child.exitCode === null) child.kill();
  }, 200).unref();
}
