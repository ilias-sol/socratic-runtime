import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";

const args = process.argv.slice(2);
const valueAfter = (flag) => args[args.indexOf(flag) + 1];
const retry = args.at(-1).includes("Your previous response classified");
readFileSync(valueAfter("--output-schema"), "utf8");
writeFileSync(
  valueAfter("--output-last-message"),
  JSON.stringify({
    learnerState: "stalled",
    progressAssessment: "none",
    decision: retry ? "direct_attention" : "remain_silent",
    confidence: 0.96,
    studentVisibleText: retry
      ? "Which part of the current error prevents any checks from running?"
      : null,
    alternativeStrategyProbability: 0.04,
    solutionLeakageRisk: 0,
    reasonCodes: [retry ? "consistency_retry" : "silence_by_default"],
    reevaluateAfter: "next_check",
  }),
);
