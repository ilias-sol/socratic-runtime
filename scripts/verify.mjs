import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { root, run } from "./lib.mjs";

const commands = [
  [
    process.execPath,
    [
      path.join(root, "node_modules", "prettier", "bin", "prettier.cjs"),
      "--check",
      "src",
      "test",
      "scripts",
      "docs",
      "README.md",
      "AGENTS.md",
      "package.json",
      "tsconfig.json",
      "eslint.config.mjs",
      "pnpm-workspace.yaml",
      "sample-workspace",
    ],
  ],
  [
    process.execPath,
    [
      path.join(root, "node_modules", "eslint", "bin", "eslint.js"),
      "src",
      "test",
      "--max-warnings",
      "0",
    ],
  ],
  [
    process.execPath,
    [path.join(root, "node_modules", "typescript", "bin", "tsc"), "--noEmit"],
  ],
  [
    process.execPath,
    [
      path.join(root, "node_modules", "vitest", "vitest.mjs"),
      "run",
      "--dir",
      "test",
    ],
  ],
  [process.execPath, ["scripts/build.mjs"]],
  [process.execPath, ["scripts/audit-submission.mjs"]],
  [process.execPath, ["scripts/test-extension.mjs"]],
  [process.execPath, ["scripts/package.mjs"]],
  [process.execPath, ["scripts/judge-bundle.mjs"]],
];
const results = [];
const portableArgument = (argument) => {
  if (!path.isAbsolute(argument)) return argument;
  const relative = path.relative(root, argument);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return path.basename(argument);
  }
  return relative.split(path.sep).join("/");
};
for (const [command, args] of commands) {
  const label = `${path.basename(command)} ${args.map(portableArgument).join(" ")}`;
  console.log(`\n[verify] ${label}`);
  const started = Date.now();
  await run(command, args);
  results.push({
    command: label,
    passed: true,
    durationMs: Date.now() - started,
  });
}
await mkdir(path.join(root, "artifacts", "test-results"), { recursive: true });
await writeFile(
  path.join(root, "artifacts", "test-results", "verify-latest.json"),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`,
);
console.log("\nAll mandatory automated verification passed.");
