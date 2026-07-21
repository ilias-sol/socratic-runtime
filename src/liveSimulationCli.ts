import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { CodexLunaProvider, checkCodexStatus } from "./providers.js";
import { enforceAssessmentSafety } from "./safety.js";
import { boundedCode, compactDiff, taskFromMarker } from "./taskContext.js";
import type { AssessmentPacket, TrajectoryEvent } from "./types.js";

async function main(): Promise<void> {
  const root = path.resolve(process.argv[2] ?? ".");
  const codexPath = process.argv[3] ?? "codex";
  if ((await checkCodexStatus(codexPath)) !== "ready")
    throw new Error("Codex is not authenticated for the live simulation");

  const demo = path.join(root, "sample-workspace", "binary-search");
  const stateNames = [
    "first-failure.py",
    "progress.py",
    "repeated-stall.py",
    "persistent-stall.py",
    "correct-half-open.py",
  ];
  const codes = await Promise.all(
    stateNames.map(async (name) =>
      boundedCode(await readFile(path.join(demo, "demo-states", name), "utf8")),
    ),
  );
  const baselineCode = boundedCode(
    await readFile(path.join(demo, "demo-states", "beginner-stub.py"), "utf8"),
  );
  const task = taskFromMarker(baselineCode);
  if (!task) throw new Error("Live demo task marker was not found");
  const provider = new CodexLunaProvider(
    codexPath,
    path.join(root, ".agents", "skills", "socratic-runtime"),
  );
  const events: TrajectoryEvent[] = [];
  const observations: Array<Record<string, unknown>> = [];
  let previousCode: string | null = baselineCode;
  let trajectorySummary =
    "The session started on a beginner stub. No revision has been assessed yet.";
  let completedPacket: AssessmentPacket | null = null;
  let completionSummary: string | null = null;

  for (let index = 0; index < codes.length; index += 1) {
    const currentCode = codes[index]!;
    const packet: AssessmentPacket = {
      task,
      languageId: "python",
      fileName: "binary_search.py",
      previousCode,
      currentCode,
      revisionDiff: compactDiff(previousCode, currentCode),
      diagnostics: [],
      trajectorySummary,
      recentEvents: events.slice(-8),
      explicitHelpRequested: false,
    };
    const result = await provider.assess(packet);
    if (!result.value)
      throw new Error(`Live Luna assessment failed: ${result.error}`);
    const decision = enforceAssessmentSafety(result.value);
    events.push({
      revision: index + 1,
      learnerState: decision.learnerState,
      action: decision.action,
      summary: decision.assessment,
      question: decision.question,
    });
    observations.push({
      revision: stateNames[index],
      learnerState: decision.learnerState,
      action: decision.action,
      modelAction: result.value.action,
      question: decision.question,
      modelQuestion: result.value.question,
      safetyBlocked:
        result.value.action === "ask_question" &&
        decision.action !== "ask_question",
      assessment: decision.assessment,
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
      fallback: result.error ?? "none",
    });
    trajectorySummary = decision.trajectorySummary;
    previousCode = currentCode;
    if (decision.action === "complete") {
      completedPacket = packet;
      completionSummary =
        decision.completionSummary ?? "Luna assessed the task as complete.";
      break;
    }
  }

  let reference = null;
  if (completedPacket && completionSummary) {
    const result = await provider.createReference(
      completedPacket,
      completionSummary,
    );
    if (!result.value)
      throw new Error(`Live reference generation failed: ${result.error}`);
    reference = {
      title: result.value.title,
      language: "python",
      hasCode: result.value.code.trim().length > 0,
      complexity: result.value.complexity,
    };
  }

  const report = {
    generatedAt: new Date().toISOString(),
    methodology:
      "real GPT-5.6 Luna medium assessments over successive learner-authored revisions; no local tests or recorded tutoring output",
    observations,
    reference,
  };
  const output = path.join(
    root,
    "artifacts",
    "live-probes",
    "luna-student-journey.json",
  );
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));

  const actions = observations.map((item) => item.action);
  const modelActions = observations.map((item) => item.modelAction);
  if (
    !modelActions.includes("remain_silent") ||
    !actions.includes("ask_question") ||
    !actions.includes("complete") ||
    !reference?.hasCode
  )
    throw new Error(
      `Live journey contract failed: modelActions=${modelActions.join(",")}, deliveredActions=${actions.join(",")}, reference=${Boolean(reference?.hasCode)}`,
    );
}

void main();
