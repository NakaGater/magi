"use client";

import { useEffect, useRef, useState } from "react";
import { useMagiEvents } from "@/lib/use-magi-events";
import { getEventsUrl, sendMessage, getTaskStatus } from "@/lib/api";
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
  const [taskText, setTaskText] = useState("");

  // Fetch task text for banner
  useEffect(() => {
    getTaskStatus(taskId)
      .then((info) => setTaskText(info.task ?? ""))
      .catch(() => {});
  }, [taskId]);

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
      // silently ignore
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Task Banner */}
      {taskText && (
        <div className="magi-frame bg-accent/5 px-4 py-3">
          <span className="text-xs font-mono font-bold text-accent uppercase tracking-wider magi-glow">
            MISSION BRIEF
          </span>
          <p className="text-sm text-text-primary mt-1 font-mono">{taskText}</p>
        </div>
      )}

      {/* Status */}
      <div className="flex items-center gap-3">
        <StatusBadge status={state.status} />
        {state.mode && (
          <span className="text-xs font-mono text-text-dim uppercase tracking-wider">
            {state.mode === "spec" ? "SPEC MODE" : "BUILD MODE"}
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
        className="space-y-4 max-h-[calc(100vh-280px)] overflow-y-auto overflow-x-hidden scrollbar-hidden pr-2"
      >
        {state.rounds.map((round, i) => (
          <div key={i} className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-text-dim pt-2 font-mono uppercase tracking-wider">
              <span className="magi-glow">
                {stageLabel(round.stage)} // ROUND {round.round}
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
            className="flex items-center gap-2 text-xs text-dev bg-dev/10 border border-dev/20 px-3 py-2 font-mono"
          >
            <span className="font-bold magi-glow">[OUTPUT]</span>
            <span>
              {art.type}: {art.path}
            </span>
          </div>
        ))}

        {/* Commits */}
        {state.commits.map((commit, i) => (
          <div
            key={`commit-${i}`}
            className="flex items-center gap-2 text-xs text-dev bg-dev/10 border border-dev/20 px-3 py-2 font-mono"
          >
            <span className="font-bold magi-glow">[COMMIT]</span>
            <span>{commit.hash?.slice(0, 7)}</span>
            <span>{commit.message}</span>
          </div>
        ))}

        {/* Gates */}
        {state.gates.map((gate, i) => (
          <div
            key={`gate-${i}`}
            className="flex items-center gap-2 text-xs text-pd bg-pd/10 border border-pd/20 px-3 py-2 font-mono"
          >
            <span className="font-bold magi-glow">[GATE]</span>
            <span>{gate}</span>
          </div>
        ))}

        {/* Error */}
        {state.error && (
          <div className="magi-frame border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 font-mono">
            <span className="font-bold">[ERROR]</span> {state.error}
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
            placeholder="> OPERATOR INPUT..."
            className="flex-1 border border-border bg-surface px-3 py-2 text-sm font-mono text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent/50 disabled:opacity-50"
          />
          <button
            onClick={handleSendMessage}
            disabled={sending || !messageInput.trim()}
            className="border border-accent bg-accent/10 px-4 py-2 text-xs font-mono font-bold text-accent uppercase tracking-wider hover:bg-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            SEND
          </button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    connecting: {
      label: "CONNECTING",
      color: "#4a7a5a",
    },
    running: {
      label: "PROCESSING",
      color: "#58f2a5",
    },
    completed: {
      label: "COMPLETE",
      color: "#58f2a5",
    },
    error: {
      label: "ERROR",
      color: "#f25858",
    },
  };

  const c = config[status] ?? config.connecting;

  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-bold uppercase tracking-wider border"
      style={{
        color: c.color,
        borderColor: `${c.color}40`,
        backgroundColor: `${c.color}10`,
        animation: status === "running" ? "magi-pulse 2s infinite" : undefined,
      }}
    >
      <span
        className="w-1.5 h-1.5 bg-current"
      />
      {c.label}
    </span>
  );
}
