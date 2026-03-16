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
      <h1 className="text-xl font-bold">Specs</h1>

      {specs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-text-dim space-y-2">
          <p>まだ仕様書がありません</p>
          <Link
            href="/"
            className="text-accent hover:underline text-sm"
          >
            タスクを投入して最初の仕様書を作成
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {specs.map((spec) => (
            <Link
              key={spec.id}
              href={`/discussion/${spec.id}`}
              className="rounded-lg border border-border bg-surface p-4 hover:bg-surface-2 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-mono text-text-dim">
                  {spec.id}
                </span>
                <StatusPill status={spec.status} />
              </div>
              <p className="text-sm line-clamp-2">{spec.task}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "completed"
      ? "bg-dev/20 text-dev"
      : status === "running"
        ? "bg-accent/20 text-accent"
        : "bg-red-500/20 text-red-400";

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>
      {status}
    </span>
  );
}
