import type { PipelineStage, ConsensusStatus } from "./types";

export interface RoleConfig {
  icon: string;
  color: string;
  label: string;
}

export const ROLE_CONFIG: Record<string, RoleConfig> = {
  PM:   { icon: "I",   color: "#4A9AF5", label: "MELCHIOR-1" },
  PD:   { icon: "II",  color: "#F5A623", label: "BALTHASAR-2" },
  Dev:  { icon: "III", color: "#58F2A5", label: "CASPER-3" },
  User: { icon: ">>",  color: "#A78BFA", label: "OPERATOR" },
};

export const SPEC_STAGES: { key: PipelineStage; label: string }[] = [
  { key: "elaborate", label: "PROC.01 要件精緻化" },
  { key: "specify",   label: "PROC.02 仕様策定" },
  { key: "decide",    label: "PROC.03 設計判断" },
  { key: "plan",      label: "PROC.04 タスク分割" },
  { key: "sync",      label: "PROC.05 連携・承認" },
];

export const BUILD_STAGES: { key: PipelineStage; label: string }[] = [
  { key: "analysis",  label: "EXEC.01 分析" },
  { key: "design",    label: "EXEC.02 設計" },
  { key: "implement", label: "EXEC.03 実装" },
  { key: "review",    label: "EXEC.04 レビュー" },
  { key: "verify",    label: "EXEC.05 検証" },
];

export const CONSENSUS_CONFIG: Record<
  ConsensusStatus,
  { icon: string; color: string; label: string }
> = {
  agreed:    { icon: ">>", color: "#58F2A5", label: "GRANTED" },
  partial:   { icon: ">>", color: "#F5A623", label: "PARTIAL" },
  disagreed: { icon: ">>", color: "#F25858", label: "DENIED" },
};

export function stageLabel(stage: string): string {
  const all = [...SPEC_STAGES, ...BUILD_STAGES];
  return all.find((s) => s.key === stage)?.label ?? stage;
}
