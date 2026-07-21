export type LearnerState =
  | "self_correcting"
  | "progressing"
  | "experimenting"
  | "stalled"
  | "uncertain"
  | "complete";

export type RuntimeAction = "remain_silent" | "ask_question" | "complete";

export interface TaskContext {
  text: string;
  summary: string;
  source: "marker" | "selection" | "inferred";
}

export interface DiagnosticContext {
  severity: "error" | "warning";
  message: string;
  line: number;
}

export interface TrajectoryEvent {
  revision: number;
  learnerState: LearnerState;
  action: RuntimeAction;
  summary: string;
  question: string | null;
}

export interface AssessmentPacket {
  task: TaskContext;
  languageId: string;
  fileName: string;
  previousCode: string | null;
  currentCode: string;
  revisionDiff: string | null;
  diagnostics: DiagnosticContext[];
  trajectorySummary: string;
  recentEvents: TrajectoryEvent[];
  explicitHelpRequested: boolean;
}

export interface AssessmentDecision {
  learnerState: LearnerState;
  action: RuntimeAction;
  question: string | null;
  assessment: string;
  trajectorySummary: string;
  completionSummary: string | null;
}

export interface ReferenceSolution {
  title: string;
  code: string;
  explanation: string;
  complexity: string;
}

export interface ProviderResult<T> {
  provider: "codex-cli";
  model: "gpt-5.6-luna";
  latencyMs: number;
  value: T | null;
  error: string | null;
}

export interface RuntimeSession {
  id: string;
  documentUri: string;
  fileName: string;
  languageId: string;
  task: TaskContext;
  startedAt: number;
  revision: number;
  lastAssessedCode: string;
  trajectorySummary: string;
  events: TrajectoryEvent[];
  questionsShown: number;
  silentAssessments: number;
  phase:
    | "observing"
    | "assessing"
    | "question"
    | "completing"
    | "complete"
    | "paused";
  completionSummary: string | null;
  reference: ReferenceSolution | null;
}
