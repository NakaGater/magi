"use client";

import type { ConsensusStatus } from "@/lib/types";
import { CONSENSUS_CONFIG, ROLE_CONFIG } from "@/lib/constants";

interface ConsensusMarkerProps {
  consensus: ConsensusStatus;
  summary?: string;
}

export function ConsensusMarker({ consensus, summary }: ConsensusMarkerProps) {
  const config = CONSENSUS_CONFIG[consensus];

  return (
    <div
      className="magi-frame px-4 py-3 font-mono"
      style={{ backgroundColor: `${config.color}10` }}
    >
      <div className="flex items-center gap-3">
        <span
          className="text-sm font-bold uppercase tracking-wider magi-glow-strong"
          style={{ color: config.color }}
        >
          {config.icon} {config.label}
        </span>
        <div className="flex gap-2 text-xs">
          <span style={{ color: ROLE_CONFIG.PM.color }}>M:1</span>
          <span style={{ color: ROLE_CONFIG.PD.color }}>B:2</span>
          <span style={{ color: ROLE_CONFIG.Dev.color }}>C:3</span>
        </div>
      </div>
      {summary && (
        <p className="text-text-dim text-xs mt-1 truncate">{summary}</p>
      )}
    </div>
  );
}
