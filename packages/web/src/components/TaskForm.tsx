"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSpec, createBuildTask } from "@/lib/api";

type Mode = "spec" | "build";

export function TaskForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("spec");
  const [task, setTask] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!task.trim() || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const result =
        mode === "spec"
          ? await createSpec(task.trim())
          : await createBuildTask(task.trim());

      router.push(`/discussion/${result.id}`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl space-y-6">
      <div className="flex gap-2">
        <ModeButton
          active={mode === "spec"}
          onClick={() => setMode("spec")}
          label="Spec"
          description="仕様書を生成"
        />
        <ModeButton
          active={mode === "build"}
          onClick={() => setMode("build")}
          label="Build"
          description="実装を実行"
        />
      </div>

      <div>
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder={
            mode === "spec"
              ? "仕様を議論したい課題を入力..."
              : "実装したい課題を入力..."
          }
          rows={5}
          className="w-full rounded-lg border border-border bg-surface-2 px-4 py-3 text-text-primary placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
        />
      </div>

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={!task.trim() || submitting}
        className="w-full rounded-lg bg-accent px-4 py-3 font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? "送信中..." : "議論を開始"}
      </button>
    </form>
  );
}

function ModeButton({
  active,
  onClick,
  label,
  description,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg border px-4 py-3 text-left transition-colors ${
        active
          ? "border-accent bg-accent/10 text-text-primary"
          : "border-border bg-surface text-text-dim hover:border-border hover:bg-surface-2"
      }`}
    >
      <div className="font-medium">{label}</div>
      <div className="text-xs mt-0.5 opacity-70">{description}</div>
    </button>
  );
}
