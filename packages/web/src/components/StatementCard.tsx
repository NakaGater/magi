"use client";

import { useMemo } from "react";
import { ROLE_CONFIG } from "@/lib/constants";
import { renderMarkdown } from "@/lib/markdown";

interface StatementCardProps {
  role: string;
  content: string;
}

export function StatementCard({ role, content }: StatementCardProps) {
  const rendered = useMemo(() => renderMarkdown(content), [content]);
  const config = ROLE_CONFIG[role] ?? {
    icon: ">",
    color: "#888",
    label: role,
  };

  return (
    <div
      className="magi-frame bg-surface p-4 transition-colors"
      style={{ borderLeftWidth: 3, borderLeftColor: config.color }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="font-mono text-xs font-bold magi-glow"
          style={{ color: config.color }}
        >
          [{config.icon}]
        </span>
        <span
          className="text-xs font-mono font-bold uppercase tracking-wider magi-glow"
          style={{ color: config.color }}
        >
          {config.label}
        </span>
      </div>
      <div className="text-sm leading-relaxed text-text-primary font-mono">
        {rendered}
      </div>
    </div>
  );
}
