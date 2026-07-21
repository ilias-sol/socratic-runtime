export type AnalysisMode = "luna" | "sol";
export type VerificationMode = "verified" | "guidance";
export type WorkspaceStrategy = "snapshot" | "copy";
export type SessionPhase =
  | "observing"
  | "progressing"
  | "investigating"
  | "possibly_stalled"
  | "verified_complete";

export type Action =
  | "remain_silent"
  | "ask_prediction"
  | "suggest_experiment"
  | "direct_attention"
  | "ask_invariant"
  | "offer_reflection";

export interface ParsedTask {
  text: string;
  summary: string;
  source: "triple_quote" | "line_comment" | "block_comment" | "selection";
  startLine: number;
  endLine: number;
}

export interface TargetSymbol {
  name: string;
  kind: "function" | "class" | "method";
  line: number;
  file: string;
}

export interface LearningEvent {
  id: string;
  timestamp: number;
  type:
    | "session_started"
    | "session_ended"
    | "task_changed"
    | "semantic_edit"
    | "diagnostic_change"
    | "check_started"
    | "check_completed"
    | "first_failure"
    | "equivalent_failure"
    | "behavior_changed"
    | "meaningful_progress"
    | "active_experiment"
    | "guidance_review"
    | "intervention_shown"
    | "hint_dismissed"
    | "hint_acknowledged"
    | "support_requested"
    | "hints_paused"
    | "watcher_paused"
    | "watcher_resumed"
    | "setup_check"
    | "verified_completion"
    | "reference_opened"
    | "session_reset";
  file?: string;
  symbol?: string;
  summary: string;
  details?: Record<string, unknown>;
}

export interface VerificationResult {
  passed: boolean;
  exitCode: number | null;
  timedOut: boolean;
  cancelled: boolean;
  durationMs: number;
  failedTests: string[];
  passedCount: number;
  failedCount: number;
  summary: string;
  output: string;
  fingerprint: string;
  syntaxError: boolean;
  infrastructureFailure: boolean;
  infrastructureReason: string | null;
  snapshotVerified: boolean;
}

export interface SessionState {
  version: 1;
  sessionId: string;
  mode: VerificationMode;
  providerMode: AnalysisMode;
  task: ParsedTask;
  targetSymbol: TargetSymbol;
  phase: SessionPhase;
  equivalentFailureCount: number;
  semanticProgressScore: number;
  experimentationEvidence: number;
  alternativeStrategyProbability: number;
  interventionsShown: number;
  silentDecisions: number;
  tutorFileEdits: number;
  tutorCodeLinesSupplied: number;
  checkCount: number;
  modelAssessmentCount: number;
  lastInterventionCheck: number | null;
  struggleEpisode: number;
  episodeHasIntervention: boolean;
  episodeSupportCount: number;
  latestVerification: VerificationResult | null;
  eventHistory: LearningEvent[];
  lastCode: string;
  lastFailureFingerprint: string | null;
  observedFailureFingerprints: string[];
}

export interface ExerciseConfig {
  version: 1;
  id: string;
  language: string;
  targetFile: string;
  targetSymbol: string;
  verification: {
    type: "command" | "pytest";
    command: string[];
    timeoutMs: number;
    snapshotExtension?: string;
    workspaceStrategy?: WorkspaceStrategy;
  };
  demo?: {
    starterFile: string;
  };
  completion?: {
    referenceSolution: string;
    title: string;
    explanation: string;
    complexity: string;
  };
}

export interface LearningStatePacket {
  language: string;
  task: Pick<ParsedTask, "summary" | "text">;
  target: Pick<TargetSymbol, "name" | "kind">;
  currentCode: string;
  previousCode: string | null;
  revisionDiff: string | null;
  recentEvents: LearningEvent[];
  verification: Omit<VerificationResult, "output" | "failedTests"> & {
    diagnosticExcerpt: string;
  };
  previousVerification: Omit<
    VerificationResult,
    "output" | "failedTests"
  > | null;
  state: {
    phase: SessionPhase;
    equivalentFailureCount: number;
    semanticProgressScore: number;
    experimentationEvidence: number;
    interventionsShown: number;
    checksSinceIntervention: number | null;
    struggleEpisode: number;
    episodeHasIntervention: boolean;
    episodeSupportCount: number;
    explicitHelpRequested: boolean;
  };
  permittedActions: Action[];
  policyConstraints: string[];
}

export interface ModelDecision {
  learnerState:
    | "self_correcting"
    | "progressing"
    | "experimenting"
    | "stalled"
    | "uncertain";
  progressAssessment: "meaningful" | "unclear" | "none";
  decision: Action;
  confidence: number;
  studentVisibleText: string | null;
  alternativeStrategyProbability: number;
  solutionLeakageRisk: number;
  reasonCodes: string[];
  reevaluateAfter: "next_check" | "next_semantic_edit" | "completion";
}

export interface ModelInvocationOptions {
  mode: AnalysisMode;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface ProviderResult {
  decision: ModelDecision;
  provider: string;
  model?: string;
  latencyMs: number;
  fallbackReason?: string;
}

export interface PedagogicalModelProvider {
  analyze(
    packet: LearningStatePacket,
    options: ModelInvocationOptions,
  ): Promise<ProviderResult>;
}
