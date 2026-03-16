import type { PipelineStage, ConsensusStatus } from "./types";

export interface RoleConfig {
  icon: string;
  color: string;
  label: string;
}

export const ROLE_CONFIG: Record<string, RoleConfig> = {
  PM: { icon: "\u{1F4CA}", color: "#4A90D9", label: "PM" },
  PD: { icon: "\u{1F3A8}", color: "#E8A838", label: "PD" },
  Dev: { icon: "\u2699\uFE0F", color: "#50C878", label: "Dev" },
  User: { icon: "\u{1F464}", color: "#A78BFA", label: "User" },
};

export const SPEC_STAGES: { key: PipelineStage; label: string }[] = [
  { key: "elaborate", label: "要件精緻化" },
  { key: "specify", label: "仕様策定" },
  { key: "decide", label: "設計判断" },
  { key: "plan", label: "タスク分割" },
  { key: "sync", label: "連携・承認" },
];

export const BUILD_STAGES: { key: PipelineStage; label: string }[] = [
  { key: "analysis", label: "分析" },
  { key: "design", label: "設計" },
  { key: "implement", label: "実装" },
  { key: "review", label: "レビュー" },
  { key: "verify", label: "検証" },
];

export const CONSENSUS_CONFIG: Record<
  ConsensusStatus,
  { icon: string; color: string; label: string }
> = {
  agreed: { icon: "\u2705", color: "#50C878", label: "合意" },
  partial: { icon: "\u{1F536}", color: "#E8A838", label: "部分合意" },
  disagreed: { icon: "\u274C", color: "#E85050", label: "不一致" },
};

export function stageLabel(stage: string): string {
  const all = [...SPEC_STAGES, ...BUILD_STAGES];
  return all.find((s) => s.key === stage)?.label ?? stage;
}
