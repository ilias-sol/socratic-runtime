import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { gateModelDecision, reduceVerification } from "./policy.js";
import {
  abstractVerificationResult,
  modelVerificationResult,
} from "./privacy.js";
import { CodexCliProvider } from "./providers.js";
import type {
  LearningStatePacket,
  SessionState,
  VerificationResult,
} from "./types.js";

async function runProcess(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ code: number | null; output: string }> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      shell: false,
      windowsHide: true,
    });
    let output = "";
    const append = (chunk: Buffer) => {
      output = (output + chunk.toString("utf8")).slice(-32_000);
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, output }));
  });
}

function verificationFrom(
  output: string,
  code: number | null,
): VerificationResult {
  const passed = code === 0;
  const passedCount = Number(
    output
      .match(/(\d+) passed/g)
      ?.at(-1)
      ?.match(/\d+/)?.[0] ?? 0,
  );
  const failedCount = Number(
    output
      .match(/(\d+) failed/g)
      ?.at(-1)
      ?.match(/\d+/)?.[0] ?? 0,
  );
  return {
    passed,
    exitCode: code,
    timedOut: false,
    cancelled: false,
    durationMs: 0,
    failedTests: [],
    passedCount,
    failedCount,
    summary: passed
      ? `Verified: ${passedCount} checks passed`
      : `${failedCount || 1} checks failed`,
    output,
    fingerprint: createHash("sha256")
      .update(output.replace(/\d+\.\d+s/g, "<time>"))
      .digest("hex")
      .slice(0, 16),
    syntaxError: /SyntaxError|IndentationError/i.test(output),
    infrastructureFailure: false,
    infrastructureReason: null,
    snapshotVerified: true,
  };
}

function initialState(targetFile: string): SessionState {
  return {
    version: 1,
    sessionId: "live-student-simulation",
    mode: "verified",
    providerMode: "luna",
    task: {
      text: "Implement binary search over a sorted list. Return a matching index or -1, handle empty and one-element lists, and aim for logarithmic time.",
      summary: "Implement binary search over a sorted list.",
      source: "selection",
      startLine: 0,
      endLine: 0,
    },
    targetSymbol: {
      name: "binary_search",
      kind: "function",
      line: 0,
      file: targetFile,
    },
    phase: "observing",
    equivalentFailureCount: 0,
    semanticProgressScore: 0,
    experimentationEvidence: 0,
    alternativeStrategyProbability: 0,
    interventionsShown: 0,
    silentDecisions: 0,
    tutorFileEdits: 0,
    tutorCodeLinesSupplied: 0,
    checkCount: 0,
    modelAssessmentCount: 0,
    lastInterventionCheck: null,
    struggleEpisode: 1,
    episodeHasIntervention: false,
    episodeSupportCount: 0,
    latestVerification: null,
    eventHistory: [],
    lastCode: "",
    lastFailureFingerprint: null,
    observedFailureFingerprints: [],
  };
}

async function main(): Promise<void> {
  const root = path.resolve(process.argv[2] ?? ".");
  const codexPath = process.argv[3] ?? "codex";
  const workspace = path.join(root, "sample-workspace", "binary-search");
  const python = path.join(workspace, ".venv", "Scripts", "python.exe");
  const revisions = [
    "first-failure.py",
    "progress.py",
    "repeated-stall.py",
    "persistent-stall.py",
    "correct-half-open.py",
  ];
  const provider = new CodexCliProvider(
    workspace,
    codexPath,
    [],
    path.join(root, ".agents", "skills", "socratic-runtime"),
  );
  const state = initialState(path.join(workspace, "binary_search.py"));
  const observations: Array<Record<string, unknown>> = [];

  for (const name of revisions) {
    const revisionPath = path.join(workspace, "demo-states", name);
    const code = await readFile(revisionPath, "utf8");
    const run = await runProcess(
      python,
      ["-m", "pytest", "-q", "-p", "no:cacheprovider"],
      workspace,
      {
        ...process.env,
        PYTHONDONTWRITEBYTECODE: "1",
        SOCRATIC_CHECK: "1",
        SOCRATIC_SOLUTION: revisionPath,
      },
    );
    const result = verificationFrom(run.output, run.code);
    state.checkCount += 1;
    if (result.passed) {
      observations.push({
        revision: name,
        verification: result.summary,
        finalAction: "complete",
        modelCalled: false,
      });
      state.latestVerification = result;
      state.lastCode = code;
      break;
    }

    const previousVerification = state.latestVerification;
    const previousCode = state.lastCode;
    const evidence = reduceVerification(state, result, code);
    const packet: LearningStatePacket = {
      language: "python",
      task: { summary: state.task.summary, text: state.task.text },
      target: { name: state.targetSymbol.name, kind: state.targetSymbol.kind },
      currentCode: code,
      previousCode: previousVerification ? previousCode : null,
      revisionDiff: previousVerification ? "revision changed" : null,
      recentEvents: state.eventHistory.slice(-8),
      verification: modelVerificationResult(result),
      previousVerification: previousVerification
        ? abstractVerificationResult(previousVerification)
        : null,
      state: {
        phase: state.phase,
        equivalentFailureCount: state.equivalentFailureCount,
        semanticProgressScore: state.semanticProgressScore,
        experimentationEvidence: state.experimentationEvidence,
        interventionsShown: state.interventionsShown,
        checksSinceIntervention:
          state.lastInterventionCheck === null
            ? null
            : state.checkCount - state.lastInterventionCheck,
        struggleEpisode: state.struggleEpisode,
        episodeHasIntervention: state.episodeHasIntervention,
        episodeSupportCount: state.episodeSupportCount,
        explicitHelpRequested: false,
      },
      permittedActions: [
        "remain_silent",
        "ask_prediction",
        "suggest_experiment",
        "direct_attention",
        "ask_invariant",
      ],
      policyConstraints: [
        "no code",
        "no hidden-test disclosure",
        "one concise question",
        "executable verification is authoritative",
      ],
    };
    const providerResult = await provider.analyze(packet, {
      mode: "luna",
      timeoutMs: 60_000,
    });
    const gate = gateModelDecision(state, providerResult.decision, evidence);
    state.modelAssessmentCount += 1;
    state.latestVerification = result;
    state.lastCode = code;
    state.alternativeStrategyProbability =
      providerResult.decision.alternativeStrategyProbability;
    if (providerResult.decision.progressAssessment === "meaningful")
      state.semanticProgressScore += 1;
    if (providerResult.decision.progressAssessment === "meaningful") {
      state.struggleEpisode += 1;
      state.episodeHasIntervention = false;
      state.episodeSupportCount = 0;
    }
    if (gate.permitted && gate.action !== "remain_silent") {
      state.interventionsShown += 1;
      state.lastInterventionCheck = state.checkCount;
      state.episodeHasIntervention = true;
      state.episodeSupportCount += 1;
    } else state.silentDecisions += 1;
    observations.push({
      revision: name,
      verification: result.summary,
      provider: providerResult.provider,
      model: providerResult.model,
      fallback: providerResult.fallbackReason ?? "none",
      learnerState: providerResult.decision.learnerState,
      progressAssessment: providerResult.decision.progressAssessment,
      modelAction: providerResult.decision.decision,
      studentVisibleText: gate.visibleText,
      safetyDecision: gate.reason,
      finalAction: gate.visibleText ? "intervene" : "remain_silent",
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    codexLogin: "checked_before_run",
    observations,
  };
  const outputPath = path.join(
    root,
    "artifacts",
    "live-probes",
    "model-led-student-simulation.json",
  );
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

void main();
