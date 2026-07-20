import * as assert from "node:assert/strict";
import * as vscode from "vscode";

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension(
    "socratic-runtime.socratic-runtime",
  );
  assert.ok(extension, "extension is installed in the development host");
  await extension.activate();
  const commands = await vscode.commands.getCommands(true);
  for (const command of [
    "socraticRuntime.startSession",
    "socraticRuntime.runCheck",
    "socraticRuntime.useSelectionAsTask",
    "socraticRuntime.openDecisionTrace",
    "socraticRuntime.openPolicyComparison",
    "socraticRuntime.resetDemo",
    "socraticRuntime.endSession",
    "socraticRuntime.pauseWatching",
    "socraticRuntime.resumeWatching",
    "socraticRuntime.openHelp",
  ]) {
    assert.ok(commands.includes(command), `${command} is registered`);
  }
  console.log(
    "Socratic Runtime extension-host smoke test passed: extension activated and 10 commands registered.",
  );
}
