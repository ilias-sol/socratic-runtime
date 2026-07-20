import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { root } from "./lib.mjs";

const packageJson = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
);
const configuredDelay =
  packageJson.contributes.configuration.properties[
    "socraticRuntime.autoCheckDebounceMs"
  ].default;
const previousDelay = 2_000;
const inactivityPauseAfterMs =
  packageJson.contributes.configuration.properties[
    "socraticRuntime.autoPauseAfterMs"
  ].default;

const profiles = [
  {
    id: "bursty-novice",
    description: "writes one statement at a time with ordinary thinking pauses",
    editTimesMs: [0, 800, 2000, 4400, 7000, 9600, 13200],
  },
  {
    id: "deliberate-debugger",
    description: "alternates edits with longer inspection periods",
    editTimesMs: [0, 8500, 17200, 26000],
  },
  {
    id: "fluent-burst",
    description: "types a complete block with short pauses",
    editTimesMs: [0, 180, 410, 760, 1200, 1750, 2400],
  },
  {
    id: "experimenting-student",
    description: "adds a trace, inspects it, then revises the algorithm",
    editTimesMs: [0, 700, 1500, 6200, 6900, 7600],
  },
];

function scheduledChecks(editTimesMs, delayMs) {
  return editTimesMs
    .map((time, index) => ({
      dueAtMs: time + delayMs,
      superseded:
        index + 1 < editTimesMs.length &&
        editTimesMs[index + 1] < time + delayMs,
    }))
    .filter((check) => !check.superseded)
    .map((check) => check.dueAtMs);
}

const results = profiles.map((profile) => {
  const previousChecks = scheduledChecks(profile.editTimesMs, previousDelay);
  const tunedChecks = scheduledChecks(profile.editTimesMs, configuredDelay);
  return {
    ...profile,
    previousChecks,
    tunedChecks,
    checksAvoided: previousChecks.length - tunedChecks.length,
    finalFeedbackDelayMs: configuredDelay,
  };
});

const beginnerJourneyAssumptions = {
  exercise: "Python binary search with a half-open/inclusive interval mismatch",
  typingWordsPerMinute: 18,
  charactersPerWord: 5,
  verifierLatencyMs: 450,
  representativeModelLatencyMs: 2_500,
  modelTimeoutMs: 30_000,
  note: "Typing speed affects when revisions exist, but never counts as pedagogical evidence.",
};

const typingDurationMs = (characters) =>
  Math.round(
    (characters /
      (beginnerJourneyAssumptions.typingWordsPerMinute *
        beginnerJourneyAssumptions.charactersPerWord)) *
      60_000,
  );

let journeyClockMs = 0;
const beginnerJourneyTimeline = [];
const journeyEvent = (kind, detail, extra = {}) => {
  beginnerJourneyTimeline.push({
    atMs: journeyClockMs,
    kind,
    detail,
    ...extra,
  });
};
const wait = (durationMs) => {
  journeyClockMs += durationMs;
};
const typeRevision = (label, characters, lineThinkingMs) => {
  const activeTypingMs = typingDurationMs(characters);
  journeyEvent("typing_started", label, {
    characters,
    activeTypingMs,
    lineThinkingMs,
  });
  wait(activeTypingMs + lineThinkingMs);
  journeyEvent("typing_stopped", label);
};
const assessRevision = (label, outcome, evidence) => {
  wait(configuredDelay);
  journeyEvent("automatic_check_started", label);
  wait(beginnerJourneyAssumptions.verifierLatencyMs);
  journeyEvent("verifier_failed", evidence);
  wait(beginnerJourneyAssumptions.representativeModelLatencyMs);
  journeyEvent("model_decision", outcome, { evidence });
};

wait(500);
journeyEvent("automatic_check_started", "Initial starter revision");
wait(beginnerJourneyAssumptions.verifierLatencyMs);
journeyEvent("verifier_failed", "Starter implementation is incomplete");
wait(beginnerJourneyAssumptions.representativeModelLatencyMs);
journeyEvent("model_decision", "Remain silent on the first failure", {
  evidence: "first_failure",
});

wait(25_000);
journeyEvent(
  "thinking",
  "Learner reads the task and sketches an interval strategy",
);
typeRevision("First complete attempt", 138, 12_000);
assessRevision(
  "First complete attempt",
  "Remain silent while self-correction remains plausible",
  "new learner-authored failure",
);
const firstCompleteFailureAtMs = journeyClockMs;

wait(35_000);
journeyEvent(
  "thinking",
  "Learner studies the failure but keeps the same interval representation",
);
typeRevision("Small boundary edit", 24, 5_000);
assessRevision(
  "Small boundary edit",
  "Show the first Socratic question and highlight the attention region",
  "equivalent repeated failure with no meaningful progress",
);
const firstNudgeAtMs = journeyClockMs;

wait(40_000);
journeyEvent(
  "thinking",
  "Learner considers the question, then makes another equivalent tweak",
);
typeRevision("Equivalent post-question tweak", 18, 3_000);
assessRevision(
  "Equivalent post-question tweak",
  "Remain silent because this struggle episode already received its automatic question",
  "episode intervention limit",
);

wait(20_000);
journeyEvent("learner_action", "Learner clicks I need another nudge");
wait(beginnerJourneyAssumptions.representativeModelLatencyMs);
journeyEvent(
  "model_decision",
  "Show a narrower second Socratic question; keep the editor highlight",
  { evidence: "explicit help request on the current failed revision" },
);
const secondNudgeAtMs = journeyClockMs;

wait(55_000);
journeyEvent(
  "learner_action",
  "Learner clicks I need another nudge a final time",
);
wait(beginnerJourneyAssumptions.representativeModelLatencyMs);
journeyEvent(
  "model_decision",
  "Show the third and final support question for this struggle episode",
  { evidence: "explicit help request within the three-step limit" },
);

wait(45_000);
typeRevision("Meaningful interval correction", 32, 4_000);
assessRevision(
  "Meaningful interval correction",
  "Remain silent because executable behavior changed meaningfully",
  "fewer or different failures",
);

wait(25_000);
typeRevision("Final candidate correction", 20, 2_000);
wait(configuredDelay);
journeyEvent("automatic_check_started", "Final candidate correction");
wait(beginnerJourneyAssumptions.verifierLatencyMs);
journeyEvent(
  "verifier_passed",
  "Mark verified complete and offer the optional reference comparison",
);

const beginnerJourney = {
  assumptions: beginnerJourneyAssumptions,
  timeline: beginnerJourneyTimeline,
  metrics: {
    simulatedSessionDurationMs: journeyClockMs,
    firstNudgeAtMs,
    firstNudgeAfterFirstCompleteFailureMs:
      firstNudgeAtMs - firstCompleteFailureAtMs,
    feedbackAfterTypingStopsMs:
      configuredDelay +
      beginnerJourneyAssumptions.verifierLatencyMs +
      beginnerJourneyAssumptions.representativeModelLatencyMs,
    secondNudgeAtMs,
    automaticQuestionsInFirstStruggleEpisode: 1,
    explicitFollowupQuestionsInFirstStruggleEpisode: 2,
    maximumQuestionsPerStruggleEpisode: 3,
  },
  interpretation: {
    firstNudge:
      "Conservative rather than premature: it follows two learner-authored complete failing revisions, not typing speed or inactivity alone.",
    perceivedResponsiveness: `With the representative latencies, a permitted automatic nudge appears about ${Math.round((configuredDelay + beginnerJourneyAssumptions.verifierLatencyMs + beginnerJourneyAssumptions.representativeModelLatencyMs) / 1_000)} seconds after typing stops.`,
    followups:
      "A second question does not pop up automatically in the same episode; the learner controls it with I need another nudge.",
    caveat: `A pause of at least ${configuredDelay / 1_000} seconds can launch a verifier check on a partial revision. Syntax, uncertainty, stale-analysis cancellation, and episode gates should keep that from becoming a misleading question, but the extra check is still background work.`,
  },
};

const report = {
  generatedAt: new Date().toISOString(),
  methodology:
    "deterministic virtual-time edit cadence simulation; not evidence of human learning outcomes",
  previousIdleDelayMs: previousDelay,
  tunedIdleDelayMs: configuredDelay,
  configuredIdleDelayCapMs: 5_000,
  inactivitySafeguard: {
    pauseAfterMs: inactivityPauseAfterMs,
    checksCausedByTimeout: 0,
    modelCallsCausedByTimeout: 0,
    pedagogicalEvidenceAdded: false,
    outcome: "watching_paused_until_explicit_resume",
  },
  profiles: results,
  totals: {
    previousChecks: results.reduce(
      (total, profile) => total + profile.previousChecks.length,
      0,
    ),
    tunedChecks: results.reduce(
      (total, profile) => total + profile.tunedChecks.length,
      0,
    ),
    checksAvoided: results.reduce(
      (total, profile) => total + profile.checksAvoided,
      0,
    ),
  },
  modelAssessmentScenarios: [
    { revision: "first executable failure", outcome: "gpt_assessment" },
    { revision: "comment-only follow-up", outcome: "gpt_assessment" },
    { revision: "format-only follow-up", outcome: "gpt_assessment" },
    {
      revision: "temporary print/assert experiment",
      outcome: "gpt_assessment",
    },
    {
      revision: "semantic edit with different or fewer failures",
      outcome: "gpt_assessment",
    },
    {
      revision: "semantic edit with equivalent repeated failure",
      outcome: "gpt_assessment",
    },
  ],
  beginnerJourney,
};

const outputDirectory = path.join(root, "artifacts", "eval-reports");
await mkdir(outputDirectory, { recursive: true });
await writeFile(
  path.join(outputDirectory, "student-timing-simulation.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));
