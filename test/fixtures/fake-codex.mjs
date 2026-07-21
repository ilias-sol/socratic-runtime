import { existsSync, readFileSync, writeFileSync } from "node:fs";
import process from "node:process";

const args = process.argv.slice(2);
const valueAfter = (flag) => args[args.indexOf(flag) + 1];
const schema = JSON.parse(readFileSync(valueAfter("--output-schema"), "utf8"));
const prompt = args.at(-1);
if (
  args[0] !== "exec" ||
  valueAfter("--model") !== "gpt-5.6-luna" ||
  valueAfter("--config") !== 'model_reasoning_effort="medium"' ||
  valueAfter("--sandbox") !== "read-only" ||
  !args.includes("--ephemeral") ||
  schema.additionalProperties !== false ||
  !existsSync(".agents/skills/socratic-runtime/SKILL.md") ||
  process.env.OPENAI_API_KEY !== undefined
) {
  process.stderr.write("unexpected Luna contract");
  process.exit(2);
}

let value;
if (prompt.includes("Infer the programming exercise")) {
  value = { task: "Implement a language-neutral search function." };
} else if (prompt.includes("post-completion comparison material")) {
  value = {
    title: "Reference approach",
    code: "REFERENCE_CODE",
    explanation: "A clear alternative implementation.",
    complexity: "Linear time and constant auxiliary space.",
  };
} else if (prompt.includes("COMPLETE_REVISION")) {
  value = {
    learnerState: "complete",
    action: "complete",
    question: null,
    assessment:
      "The implementation appears to satisfy every stated requirement.",
    trajectorySummary:
      "The learner progressed from a stall to a complete implementation.",
    completionSummary: "Luna assessed every stated requirement as satisfied.",
  };
} else if (prompt.includes("STALLED_REVISION")) {
  value = {
    learnerState: "stalled",
    action: "ask_question",
    question: "Which invariant should still hold after this branch?",
    assessment: "The latest revision repeats the same boundary behavior.",
    trajectorySummary: "The learner is stalled on a boundary invariant.",
    completionSummary: null,
  };
} else {
  value = {
    learnerState: "progressing",
    action: "remain_silent",
    question: null,
    assessment: "The learner made a meaningful revision.",
    trajectorySummary: "The learner is making meaningful progress.",
    completionSummary: null,
  };
}
writeFileSync(valueAfter("--output-last-message"), JSON.stringify(value));
