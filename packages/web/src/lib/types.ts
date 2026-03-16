/**
 * @magi/core の型定義のうち Web UI で必要なもののみ再定義。
 * @magi/core は Node.js 専用依存を含むため、ブラウザバンドルに含められない。
 */

export type SpecPipelineStage =
  | "elaborate"
  | "specify"
  | "decide"
  | "plan"
  | "sync";

export type BuildPipelineStage =
  | "analysis"
  | "design"
  | "implement"
  | "review"
  | "verify";

export type PipelineStage = SpecPipelineStage | BuildPipelineStage;

export type PipelineMode = "spec" | "build";

export type ConsensusStatus = "agreed" | "disagreed" | "partial";

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
