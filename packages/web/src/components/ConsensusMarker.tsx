"use client";

import type { ConsensusStatus } from "@/lib/types";
import { CONSENSUS_CONFIG } from "@/lib/constants";

interface ConsensusMarkerProps {
  consensus: ConsensusStatus;
  summary?: string;
}

export function ConsensusMarker({ consensus, summary }: ConsensusMarkerProps) {
  const config = CONSENSUS_CONFIG[consensus];

  return (
    <div
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
      style={{ backgroundColor: `${config.color}15`, color: config.color }}
    >
      <span>{config.icon}</span>
      <span className="font-medium">{config.label}</span>
      {summary && (
        <span className="text-text-dim ml-2 text-xs truncate">{summary}</span>
      )}
    </div>
  );
}
