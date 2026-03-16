/** Role definition loaded from YAML */
export interface RoleDefinition {
  name: string;
  title: string;
  perspective: string;
  system_prompt: string;
  icon: string;
  color: string;
}

/** A single statement in a discussion */
export interface Statement {
  role: string;
  content: string;
  timestamp: Date;
  round: number;
}

/** Consensus status for a discussion round */
export type ConsensusStatus = "agreed" | "disagreed" | "partial";

/** Result of a discussion round */
export interface RoundResult {
  round: number;
  statements: Statement[];
  consensus: ConsensusStatus;
  summary: string;
}

// --- Pipeline Modes ---

/** Spec mode pipeline stages */
export type SpecPipelineStage =
  | "elaborate"
  | "specify"
  | "decide"
  | "plan"
  | "sync";

/** Build mode pipeline stages */
export type BuildPipelineStage =
  | "analysis"
  | "design"
  | "implement"
  | "review"
  | "verify";

/** All pipeline stages */
export type PipelineStage = SpecPipelineStage | BuildPipelineStage;

/** Pipeline mode */
export type PipelineMode = "spec" | "build";

// --- Context ---

/** A context file loaded from .magi/context/ */
export interface ContextFile {
  path: string;
  content: string;
  relevantRoles: string[];
}

/** A reference to a past discussion or artifact */
export interface ContextReference {
  path: string;
  title: string;
  excerpt: string;
  relevance: number;
}

// --- Spec Mode Artifacts ---

/** Spec mode output artifacts */
export interface SpecArtifacts {
  requirements?: string;
  spec?: string;
  adrs?: string[];
  tasks?: string;
  mermaid?: string;
  prototypes?: string[];
}

/** Spec mode result */
export interface SpecResult {
  id: string;
  task: string;
  startedAt: Date;
  completedAt: Date;
  stages: StageResult[];
  artifacts: SpecArtifacts;
  outputDir: string;
  totalTokens: number;
  totalCost: number;
}

// --- Build Mode (existing) ---

/** Pipeline stage result */
export interface StageResult {
  stage: PipelineStage;
  rounds: RoundResult[];
  artifacts: string[];
  commits: string[];
}

/** Full task run result (Build mode) */
export interface TaskResult {
  id: string;
  task: string;
  startedAt: Date;
  completedAt: Date;
  stages: StageResult[];
  totalTokens: number;
  totalCost: number;
}

// --- Configuration ---

/** Pipeline configuration */
export interface PipelineConfig {
  maxRounds: number;
  pauseAfterDesign: boolean;
  autoPause: AutoPauseCondition[];
  gates: GateConfig;
}

export interface GateConfig {
  specBeforeSync: boolean;
  buildBeforeImplement: boolean;
}

export interface AutoPauseCondition {
  when: string;
  threshold?: string;
}

/** Magi configuration */
export interface MagiConfig {
  llm: {
    provider: "anthropic";
    model: string;
    maxTokens: number;
  };
  pipeline: PipelineConfig;
  roles: string[];
  rolesDir: string;
  discussionsDir: string;
  specsDir: string;
  contextDir: string;
}

/** Event emitted during pipeline execution */
export interface MagiEvent {
  type:
    | "stage_start"
    | "stage_end"
    | "round_start"
    | "round_end"
    | "statement"
    | "consensus"
    | "commit"
    | "artifact"
    | "gate"
    | "error"
    | "pause"
    | "user_message"
    | "validation_warning"
    | "context_synced";
  stage?: PipelineStage;
  mode?: PipelineMode;
  data: Record<string, unknown>;
  timestamp: Date;
}

export type MagiEventHandler = (event: MagiEvent) => void;

/** Default configuration */
export const DEFAULT_CONFIG: MagiConfig = {
  llm: {
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
    maxTokens: 4096,
  },
  pipeline: {
    maxRounds: 3,
    pauseAfterDesign: false,
    autoPause: [
      { when: "design_disagreement" },
      { when: "security_issue_found" },
      { when: "breaking_change" },
    ],
    gates: {
      specBeforeSync: true,
      buildBeforeImplement: true,
    },
  },
  roles: ["pm", "pd", "dev"],
  rolesDir: "roles",
  discussionsDir: ".magi/discussions",
  specsDir: ".magi/specs",
  contextDir: ".magi/context",
};
