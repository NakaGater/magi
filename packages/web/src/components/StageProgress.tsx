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
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {stageList.map((stage, i) => {
        const status = getStatus(stage.key);
        return (
          <div key={stage.key} className="flex items-center">
            {i > 0 && (
              <div
                className={`w-6 h-px mx-1 ${
                  status === "waiting" ? "bg-border" : "bg-accent"
                }`}
              />
            )}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
                status === "done"
                  ? "bg-dev/15 text-dev"
                  : status === "active"
                    ? "bg-accent/15 text-accent animate-pulse"
                    : "bg-surface-2 text-text-dim"
              }`}
            >
              <span>
                {status === "done" ? "\u2713" : status === "active" ? "\u25CF" : "\u25CB"}
              </span>
              <span>{stage.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
