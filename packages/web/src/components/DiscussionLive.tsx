"use client";

import { useEffect, useRef, useState } from "react";
import { useMagiEvents } from "@/lib/use-magi-events";
import { getEventsUrl, sendMessage } from "@/lib/api";
import { stageLabel } from "@/lib/constants";
import { StageProgress } from "./StageProgress";
import { StatementCard } from "./StatementCard";
import { ConsensusMarker } from "./ConsensusMarker";

interface DiscussionLiveProps {
  taskId: string;
}

export function DiscussionLive({ taskId }: DiscussionLiveProps) {
  const eventsUrl = getEventsUrl(taskId);
  const state = useMagiEvents(eventsUrl);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userScrolled = useRef(false);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);

  // Auto-scroll unless user has scrolled up
  useEffect(() => {
    if (!userScrolled.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [state.rounds, state.artifacts, state.commits]);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    userScrolled.current = !atBottom;
  }

  async function handleSendMessage() {
    const msg = messageInput.trim();
    if (!msg || sending) return;
    setSending(true);
    try {
      await sendMessage(taskId, msg);
      setMessageInput("");
    } catch {
      // silently ignore — the message will not appear if it fails
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Status */}
      <div className="flex items-center gap-3">
        <StatusBadge status={state.status} />
        {state.mode && (
          <span className="text-sm text-text-dim">
            {state.mode === "spec" ? "Spec" : "Build"} mode
          </span>
        )}
      </div>

      {/* Stage Progress */}
      {state.stages.length > 0 && (
        <StageProgress stages={state.stages} mode={state.mode} />
      )}

      {/* Discussion Feed */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="space-y-4 max-h-[calc(100vh-280px)] overflow-y-auto pr-2"
      >
        {state.rounds.map((round, i) => (
          <div key={i} className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-text-dim pt-2">
              <span className="font-medium">
                {stageLabel(round.stage)} - Round {round.round}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {round.statements.map((stmt, j) => (
              <StatementCard key={j} role={stmt.role} content={stmt.content} />
            ))}

            {round.consensus && (
              <ConsensusMarker
                consensus={round.consensus}
                summary={round.summary}
              />
            )}
          </div>
        ))}

        {/* Artifacts */}
        {state.artifacts.map((art, i) => (
          <div
            key={`art-${i}`}
            className="flex items-center gap-2 text-sm text-dev bg-dev/10 rounded-lg px-3 py-2"
          >
            <span>{"\u{1F4C4}"}</span>
            <span>
              {art.type}: {art.path}
            </span>
          </div>
        ))}

        {/* Commits */}
        {state.commits.map((commit, i) => (
          <div
            key={`commit-${i}`}
            className="flex items-center gap-2 text-sm text-dev bg-dev/10 rounded-lg px-3 py-2"
          >
            <span>{"\u{1F4DD}"}</span>
            <span className="font-mono text-xs">{commit.hash?.slice(0, 7)}</span>
            <span>{commit.message}</span>
          </div>
        ))}

        {/* Gates */}
        {state.gates.map((gate, i) => (
          <div
            key={`gate-${i}`}
            className="flex items-center gap-2 text-sm text-pd bg-pd/10 rounded-lg px-3 py-2"
          >
            <span>{"\u{1F6A6}"}</span>
            <span>{gate}</span>
          </div>
        ))}

        {/* Error */}
        {state.error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {state.error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* User Message Input */}
      {state.status === "running" && (
        <div className="flex gap-2 pt-2">
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                handleSendMessage();
              }
            }}
            disabled={sending}
            placeholder="議論に介入するメッセージを入力..."
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-dim focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
          />
          <button
            onClick={handleSendMessage}
            disabled={sending || !messageInput.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            送信
          </button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    connecting: {
      label: "Connecting...",
      className: "bg-text-dim/20 text-text-dim",
    },
    running: {
      label: "Running",
      className: "bg-accent/20 text-accent animate-pulse",
    },
    completed: {
      label: "Completed",
      className: "bg-dev/20 text-dev",
    },
    error: {
      label: "Error",
      className: "bg-red-500/20 text-red-400",
    },
  };

  const c = config[status] ?? config.connecting;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${c.className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {c.label}
    </span>
  );
}
