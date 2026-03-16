"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listHistory, type HistoryItem } from "@/lib/api";
import { stageLabel } from "@/lib/constants";

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listHistory()
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-text-dim">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">History</h1>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-text-dim space-y-2">
          <p>まだ議論履歴がありません</p>
          <Link
            href="/"
            className="text-accent hover:underline text-sm"
          >
            最初のタスクを投入
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/history/${item.id}`}
              className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4 hover:bg-surface-2 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{item.task}</p>
                <p className="text-xs text-text-dim mt-1">
                  {item.startedAt
                    ? new Date(item.startedAt).toLocaleString("ja-JP")
                    : "—"}
                  {" · "}
                  {item.stages
                    .filter((s) => s.rounds > 0)
                    .map((s) => stageLabel(s.name))
                    .join(" → ")}
                </p>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                  item.completedAt
                    ? "bg-dev/20 text-dev"
                    : "bg-accent/20 text-accent"
                }`}
              >
                {item.completedAt ? "completed" : "incomplete"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
