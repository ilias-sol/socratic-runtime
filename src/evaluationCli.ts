import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { evaluateSuite, type EvaluationTrace } from "./evaluation.js";

async function main(): Promise<void> {
  const [, , suitePath, outputPath] = process.argv;
  if (!suitePath || !outputPath)
    throw new Error("Usage: evaluationCli <suite.json> <report.json>");

  const traces = JSON.parse(
    await readFile(suitePath, "utf8"),
  ) as EvaluationTrace[];
  if (
    !Array.isArray(traces) ||
    traces.some((trace) => !trace.revisions?.length)
  )
    throw new Error("Evaluation suite must contain executable revision traces");

  const report = {
    generatedAt: new Date().toISOString(),
    ...(await evaluateSuite(traces)),
  };
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

void main();
