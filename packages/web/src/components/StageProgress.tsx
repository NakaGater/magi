"use client";

import type { StageState } from "@/lib/use-magi-events";
import { SPEC_STAGES, BUILD_STAGES } from "@/lib/constants";
import type { PipelineMode } from "@/lib/types";

interface StageProgressProps {
  stages: StageState[];
  mode?: PipelineMode;
}

export function StageProgress({ stages, mode }: StageProgressProps) {
  const stageList = mode === "build" ? BUILD_STAGES : SPEC_STAGES;

  function getStatus(key: string): "waiting" | "active" | "done" {
    return stages.find((s) => s.stage === key)?.status ?? "waiting";
  }

  return (
    <div className="magi-frame bg-surface p-3">
      <div className="text-xs font-mono uppercase tracking-wider text-text-dim mb-2 magi-glow">
        PIPELINE STATUS
      </div>
      <div className="flex items-center gap-1 overflow-x-auto">
        {stageList.map((stage, i) => {
          const status = getStatus(stage.key);
          return (
            <div key={stage.key} className="flex items-center">
              {i > 0 && (
                <div
                  className={`w-4 h-px mx-0.5 ${
                    status === "waiting" ? "bg-border" : "bg-accent"
                  }`}
                />
              )}
              <div
                className={`flex items-center gap-1.5 px-2 py-1 text-xs font-mono whitespace-nowrap transition-colors border ${
                  status === "done"
                    ? "border-dev/30 bg-dev/10 text-dev"
                    : status === "active"
                      ? "border-accent/30 bg-accent/10 text-accent"
                      : "border-border bg-surface-2 text-text-dim"
                }`}
                style={{ animation: status === "active" ? "magi-pulse 2s infinite" : undefined }}
              >
                <span className="font-bold">
                  {status === "done" ? "DONE" : status === "active" ? "EXEC" : "WAIT"}
                </span>
                <span>{stage.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
