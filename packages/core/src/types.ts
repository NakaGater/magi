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

/** Pipeline stage */
export type PipelineStage =
  | "analysis"
  | "design"
  | "implement"
  | "review"
  | "verify";

/** Pipeline stage result */
export interface StageResult {
  stage: PipelineStage;
  rounds: RoundResult[];
  artifacts: string[];
  commits: string[];
}

/** Full task run result */
export interface TaskResult {
  id: string;
  task: string;
  startedAt: Date;
  completedAt: Date;
  stages: StageResult[];
  totalTokens: number;
  totalCost: number;
}

/** Pipeline configuration */
export interface PipelineConfig {
  maxRounds: number;
  pauseAfterDesign: boolean;
  autoPause: AutoPauseCondition[];
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
    | "error"
    | "pause";
  stage?: PipelineStage;
  data: Record<string, unknown>;
  timestamp: Date;
}

export type MagiEventHandler = (event: MagiEvent) => void;

/** Default configuration */
export const DEFAULT_CONFIG: MagiConfig = {
  llm: {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
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
  },
  roles: ["pm", "pd", "dev"],
  rolesDir: "roles",
  discussionsDir: ".magi/discussions",
};
