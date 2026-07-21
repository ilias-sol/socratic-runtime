import { readFile } from "node:fs/promises";
import path from "node:path";
import { root, run } from "./lib.mjs";

const packageJson = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
);
const failures = [];
const commands = packageJson.contributes?.commands ?? [];
const settings = packageJson.contributes?.configuration?.properties ?? {};

if (packageJson.version !== "0.1.0")
  failures.push("release version must be 0.1.0");
if (commands.length !== 7)
  failures.push(`expected 7 commands, found ${commands.length}`);
if (settings["socraticRuntime.idleDelayMs"]?.default !== 2_000)
  failures.push("idle delay must default to 2000 ms");
if (
  Object.keys(settings).some((key) => /verif|analysisMode|autoCheck/i.test(key))
)
  failures.push("legacy verifier or policy settings are still exposed");

const provider = await readFile(path.join(root, "src", "providers.ts"), "utf8");
if (!provider.includes('"gpt-5.6-luna"'))
  failures.push("Luna model is not pinned");
if (!provider.includes('"medium"'))
  failures.push("medium reasoning is not pinned");
if (/confidenceThreshold|alternativeThreshold|runVerifier/i.test(provider))
  failures.push("legacy host-side pedagogical gates remain in the provider");

const vsce = await run(
  process.execPath,
  [
    path.join(root, "node_modules", "@vscode", "vsce", "vsce"),
    "ls",
    "--no-dependencies",
  ],
  { capture: true },
);
const packagedFiles = vsce.stdout
  .split(/\r?\n/)
  .map((line) => line.trim().replaceAll("\\", "/"))
  .filter(Boolean);
const required = [
  ".agents/skills/socratic-runtime/SKILL.md",
  ".agents/skills/socratic-runtime/references/output-schema.json",
  "LICENSE",
  "README.md",
  "dist/extension.js",
  "media/socratic.svg",
  "package.json",
];
for (const file of required)
  if (!packagedFiles.includes(file)) failures.push(`VSIX is missing ${file}`);
if (
  packagedFiles.some((file) =>
    /(?:^|\/)(?:\.env|auth\.json|src|test|evals|artifacts|sample-workspace)(?:\/|$)/i.test(
      file,
    ),
  )
)
  failures.push("VSIX contains private, source, test, or demo files");

if (failures.length)
  throw new Error(`Submission audit failed:\n- ${failures.join("\n- ")}`);
console.log(
  `Submission audit passed: one Luna configuration, ${commands.length} commands, ${packagedFiles.length} packaged files.`,
);
