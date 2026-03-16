"use client";

import { ROLE_CONFIG } from "@/lib/constants";

interface StatementCardProps {
  role: string;
  content: string;
}

export function StatementCard({ role, content }: StatementCardProps) {
  const config = ROLE_CONFIG[role] ?? {
    icon: "\u25CF",
    color: "#888",
    label: role,
  };

  return (
    <div
      className="rounded-lg border border-border bg-surface p-4 transition-colors"
      style={{ borderLeftWidth: 3, borderLeftColor: config.color }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span>{config.icon}</span>
        <span
          className="text-sm font-semibold"
          style={{ color: config.color }}
        >
          {config.label}
        </span>
      </div>
      <div className="text-sm leading-relaxed text-text-primary whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
}
