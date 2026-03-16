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
    <form onSubmit={handleSubmit} className="w-full max-w-2xl space-y-4">
      <div className="flex gap-2">
        <ModeButton
          active={mode === "spec"}
          onClick={() => setMode("spec")}
          label="SPEC"
          description="仕様書を生成"
        />
        <ModeButton
          active={false}
          onClick={() => {}}
          label="BUILD"
          description="実装を実行"
          disabled
        />
      </div>

      <div>
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder={
            mode === "spec"
              ? "> ENTER SPECIFICATION QUERY..."
              : "> ENTER BUILD COMMAND..."
          }
          rows={5}
          className="w-full border border-border bg-surface-2 px-4 py-3 text-text-primary font-mono text-sm placeholder:text-text-dim focus:outline-none focus:border-accent/50 resize-none"
        />
      </div>

      {error && (
        <p className="text-sm text-red-400 font-mono">{error}</p>
      )}

      <button
        type="submit"
        disabled={!task.trim() || submitting}
        className="w-full border border-accent bg-accent/10 px-4 py-3 font-mono font-bold text-accent uppercase tracking-wider transition-colors hover:bg-accent/20 disabled:opacity-50 disabled:cursor-not-allowed magi-glow"
      >
        {submitting ? "PROCESSING..." : "EXECUTE"}
      </button>
    </form>
  );
}

function ModeButton({
  active,
  onClick,
  label,
  description,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  description: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 border px-4 py-3 text-left transition-colors font-mono ${
        disabled
          ? "border-border bg-surface text-text-dim opacity-40 cursor-not-allowed"
          : active
            ? "border-accent bg-accent/10 text-accent"
            : "border-border bg-surface text-text-dim hover:border-accent/30 hover:bg-surface-2"
      }`}
    >
      <div className="font-bold uppercase tracking-wider text-sm">{label}</div>
      <div className="text-xs mt-0.5 opacity-70">{description}</div>
    </button>
  );
}
