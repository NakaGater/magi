"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listTasks, type TaskInfo } from "@/lib/api";

export default function HistoryPage() {
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTasks()
      .then(setTasks)
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

      {tasks.length === 0 ? (
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
          {tasks.map((task) => (
            <Link
              key={task.id}
              href={`/discussion/${task.id}`}
              className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4 hover:bg-surface-2 transition-colors"
            >
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  task.mode === "spec"
                    ? "bg-pm/20 text-pm"
                    : "bg-dev/20 text-dev"
                }`}
              >
                {task.mode}
              </span>
              <p className="flex-1 text-sm truncate">{task.task}</p>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  task.status === "completed"
                    ? "bg-dev/20 text-dev"
                    : task.status === "running"
                      ? "bg-accent/20 text-accent"
                      : "bg-red-500/20 text-red-400"
                }`}
              >
                {task.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
