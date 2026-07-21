import * as assert from "node:assert/strict";
import * as vscode from "vscode";

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension(
    "socratic-runtime.socratic-runtime",
  );
  assert.ok(extension, "extension is installed in the development host");
  await extension.activate();
  const commands = await vscode.commands.getCommands(true);
  const expected = [
    "socraticRuntime.startSession",
    "socraticRuntime.askForNudge",
    "socraticRuntime.pause",
    "socraticRuntime.resume",
    "socraticRuntime.endSession",
    "socraticRuntime.openSupport",
    "socraticRuntime.openDecisionTrace",
  ];
  for (const command of expected)
    assert.ok(commands.includes(command), `${command} is registered`);
  console.log(
    `Socratic Runtime extension-host smoke test passed: extension activated and ${expected.length} commands registered.`,
  );
}
