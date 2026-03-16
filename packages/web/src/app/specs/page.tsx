"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listSpecs, type TaskInfo } from "@/lib/api";

export default function SpecsPage() {
  const [specs, setSpecs] = useState<TaskInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listSpecs()
      .then(setSpecs)
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
        SPECIFICATION DATABASE
      </h1>

      {specs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-text-dim space-y-2 font-mono">
          <p className="uppercase tracking-wider">NO RECORDS FOUND</p>
          <Link
            href="/"
            className="text-accent hover:underline text-xs uppercase tracking-wider"
          >
            &gt;&gt; SUBMIT NEW TASK
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {specs.map((spec) => (
            <Link
              key={spec.id}
              href={spec.status === "completed" ? `/history/${spec.id}` : `/discussion/${spec.id}`}
              className="magi-frame bg-surface p-4 hover:bg-surface-2 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-text-dim uppercase tracking-wider">
                  {spec.id}
                </span>
                <StatusPill status={spec.status} />
              </div>
              <p className="text-sm font-mono line-clamp-2">{spec.task}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles =
    status === "completed"
      ? { color: "#58F2A5", borderColor: "#58F2A540", bg: "#58F2A510" }
      : status === "running"
        ? { color: "#58F2A5", borderColor: "#58F2A540", bg: "#58F2A510" }
        : { color: "#F25858", borderColor: "#F2585840", bg: "#F2585810" };

  return (
    <span
      className="text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 border"
      style={{ color: styles.color, borderColor: styles.borderColor, backgroundColor: styles.bg }}
    >
      {status === "completed" ? "DONE" : status === "running" ? "EXEC" : "ERR"}
    </span>
  );
}
