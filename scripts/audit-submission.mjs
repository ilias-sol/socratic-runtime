import { readFile } from "node:fs/promises";
import path from "node:path";
import { root, run } from "./lib.mjs";

const read = async (relative) =>
  await readFile(path.join(root, relative), "utf8");
const packageJson = JSON.parse(await read("package.json"));
const traces = JSON.parse(await read("evals/traces/suite.json"));
const evaluationReport = JSON.parse(
  await read("artifacts/eval-reports/latest.json"),
);
const readme = await read("README.md");
const judgeGuide = await read("docs/JUDGE_GUIDE.md");
const evaluationGuide = await read("docs/EVALUATION.md");
const gitignore = await read(".gitignore");
const demoSettings = JSON.parse(
  await read("sample-workspace/binary-search/.vscode/settings.json"),
);

const commandCount = packageJson.contributes?.commands?.length ?? 0;
const traceCount = traces.length;
const failures = [];
const requireClaim = (text, claim, source) => {
  if (!text.includes(claim)) failures.push(`${source} is missing “${claim}”`);
};

requireClaim(judgeGuide, `${commandCount} registered commands`, "judge guide");
requireClaim(readme, `${traceCount} synthetic traces`, "README");
requireClaim(
  evaluationGuide,
  `${traceCount} deterministic synthetic revision traces`,
  "evaluation guide",
);
for (const ignored of [
  ".tmp-*/",
  ".vscode-test/",
  ".pnpm-store/",
  "**/.pytest_cache/",
  "**/.hypothesis/",
  "**/__pycache__/",
])
  requireClaim(gitignore, ignored, ".gitignore");
requireClaim(
  judgeGuide,
  `${traceCount} replay cases`,
  "judge guide trace inventory",
);
const configuredAnalysisMode = demoSettings["socraticRuntime.analysisMode"];
const supportedAnalysisModes =
  packageJson.contributes?.configuration?.properties?.[
    "socraticRuntime.analysisMode"
  ]?.enum ?? [];
if (
  configuredAnalysisMode !== undefined &&
  !supportedAnalysisModes.includes(configuredAnalysisMode)
) {
  failures.push(
    `demo workspace configures unsupported analysis mode: ${configuredAnalysisMode}`,
  );
}
if (evaluationReport.socraticRuntime?.traces !== traceCount) {
  failures.push(
    `latest evaluation report has ${evaluationReport.socraticRuntime?.traces ?? "no"} traces; expected ${traceCount}`,
  );
}
const expectedGateBlocks = Object.fromEntries(
  traces
    .filter((trace) => trace.tags?.gateBlock)
    .map((trace) => trace.expected?.gateReason)
    .filter(Boolean)
    .sort()
    .map((reason) => [
      reason,
      traces.filter(
        (trace) =>
          trace.tags?.gateBlock && trace.expected?.gateReason === reason,
      ).length,
    ]),
);
if (
  JSON.stringify(evaluationReport.socraticRuntime?.gateBlocksByReason) !==
  JSON.stringify(expectedGateBlocks)
) {
  failures.push("latest evaluation gate-reason counts are stale or invalid");
}
if (
  evaluationReport.socraticRuntime?.adversarialGateOutputsBlocked !==
  traces.filter((trace) => trace.tags?.gateBlock).length
) {
  failures.push(
    "latest evaluation adversarial-block total is stale or invalid",
  );
}

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
  .filter(Boolean)
  .sort();
const expectedFiles = [
  "LICENSE",
  "README.md",
  "dist/extension.js",
  "media/socratic.svg",
  "media/socratic-runtime-logo.png",
  "package.json",
].sort();
if (JSON.stringify(packagedFiles) !== JSON.stringify(expectedFiles)) {
  failures.push(`VSIX content drifted: ${packagedFiles.join(", ")}`);
}
if (
  packagedFiles.some((file) =>
    /(?:^|\/)(?:\.env|auth\.json|src|test|evals|artifacts|\.agents)(?:\/|$)/i.test(
      file,
    ),
  )
) {
  failures.push("VSIX contains a private, source, test, or evidence path");
}

if (failures.length > 0)
  throw new Error(`Submission audit failed:\n- ${failures.join("\n- ")}`);

console.log(
  `Submission audit passed: ${commandCount} commands, ${traceCount} traces, ${packagedFiles.length} allowlisted VSIX files.`,
);
