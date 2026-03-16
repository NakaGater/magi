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
      <div className="flex items-center justify-center py-20 text-text-dim font-mono uppercase tracking-wider">
        LOADING DATA...
      </div>
    );
  }

  if (error) {
    return (
      <div className="magi-frame border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 font-mono">
        <span className="font-bold">[ERROR]</span> {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-mono font-bold uppercase tracking-wider text-accent magi-glow">
        SYSTEM LOG
      </h1>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-text-dim space-y-2 font-mono">
          <p className="uppercase tracking-wider">NO RECORDS FOUND</p>
          <Link
            href="/"
            className="text-accent hover:underline text-xs uppercase tracking-wider"
          >
            &gt;&gt; SUBMIT FIRST TASK
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/history/${item.id}`}
              className="flex items-center gap-4 magi-frame bg-surface p-4 hover:bg-surface-2 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono truncate">{item.task}</p>
                <p className="text-xs text-text-dim font-mono mt-1 uppercase tracking-wider">
                  {item.startedAt
                    ? new Date(item.startedAt).toLocaleString("ja-JP")
                    : "—"}
                  {" // "}
                  {item.stages
                    .filter((s) => s.rounds > 0)
                    .map((s) => stageLabel(s.name))
                    .join(" > ")}
                </p>
              </div>
              <span
                className="text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 border whitespace-nowrap"
                style={
                  item.completedAt
                    ? { color: "#58F2A5", borderColor: "#58F2A540", backgroundColor: "#58F2A510" }
                    : { color: "#F5A623", borderColor: "#F5A62340", backgroundColor: "#F5A62310" }
                }
              >
                {item.completedAt ? "COMPLETE" : "INCOMPLETE"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
