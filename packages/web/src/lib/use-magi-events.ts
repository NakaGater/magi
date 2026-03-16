"use client";

import { useEffect, useReducer, useRef } from "react";
import type { MagiEvent, PipelineStage, ConsensusStatus } from "./types";

export interface StageState {
  stage: PipelineStage;
  status: "waiting" | "active" | "done";
}

export interface RoundState {
  round: number;
  stage: PipelineStage;
  statements: {
    role: string;
    content: string;
  }[];
  consensus?: ConsensusStatus;
  summary?: string;
}

export interface MagiState {
  stages: StageState[];
  rounds: RoundState[];
  artifacts: { type: string; path: string }[];
  commits: { hash: string; message: string }[];
  gates: string[];
  status: "connecting" | "running" | "completed" | "error";
  error?: string;
  mode?: "spec" | "build";
  currentStage?: PipelineStage;
  currentRound?: number;
}

type Action =
  | { type: "EVENT"; event: MagiEvent }
  | { type: "CONNECTED" }
  | { type: "COMPLETED" }
  | { type: "ERROR"; message: string };

const initialState: MagiState = {
  stages: [],
  rounds: [],
  artifacts: [],
  commits: [],
  gates: [],
  status: "connecting",
};

function reducer(state: MagiState, action: Action): MagiState {
  switch (action.type) {
    case "CONNECTED":
      return { ...state, status: "running" };

    case "COMPLETED":
      return { ...state, status: "completed" };

    case "ERROR":
      return { ...state, status: "error", error: action.message };

    case "EVENT": {
      const event = action.event;

      switch (event.type) {
        case "stage_start": {
          const stage = event.stage!;
          const mode = event.mode ?? state.mode;
          const stages = state.stages.map((s) =>
            s.stage === stage ? { ...s, status: "active" as const } : s
          );
          // Add stage if not already tracked
          if (!stages.find((s) => s.stage === stage)) {
            stages.push({ stage, status: "active" });
          }
          return { ...state, stages, currentStage: stage, mode };
        }

        case "stage_end": {
          const stage = event.stage!;
          const stages = state.stages.map((s) =>
            s.stage === stage ? { ...s, status: "done" as const } : s
          );
          return { ...state, stages };
        }

        case "round_start": {
          const round = event.data.round as number;
          const stage = event.stage ?? state.currentStage;
          const newRound: RoundState = {
            round,
            stage: stage!,
            statements: [],
          };
          return {
            ...state,
            rounds: [...state.rounds, newRound],
            currentRound: round,
          };
        }

        case "statement": {
          const { role, content } = event.data as {
            role: string;
            content: string;
          };
          const rounds = [...state.rounds];
          const lastRound = rounds[rounds.length - 1];
          if (lastRound) {
            rounds[rounds.length - 1] = {
              ...lastRound,
              statements: [...lastRound.statements, { role, content }],
            };
          }
          return { ...state, rounds };
        }

        case "consensus":
        case "round_end": {
          const consensus = event.data.consensus as ConsensusStatus;
          const summary = event.data.summary as string | undefined;
          const rounds = [...state.rounds];
          const lastRound = rounds[rounds.length - 1];
          if (lastRound) {
            rounds[rounds.length - 1] = {
              ...lastRound,
              consensus,
              summary,
            };
          }
          return { ...state, rounds };
        }

        case "artifact": {
          const artType = event.data.type as string;
          const artPath = (event.data.path ?? event.data.paths ?? "") as string;
          return {
            ...state,
            artifacts: [...state.artifacts, { type: artType, path: artPath }],
          };
        }

        case "commit": {
          const hash = event.data.hash as string;
          const message = event.data.message as string;
          return {
            ...state,
            commits: [...state.commits, { hash, message }],
          };
        }

        case "gate": {
          const msg = event.data.message as string;
          return { ...state, gates: [...state.gates, msg] };
        }

        case "error": {
          return {
            ...state,
            status: "error",
            error: event.data.message as string,
          };
        }

        case "user_message": {
          const { role, content } = event.data as {
            role: string;
            content: string;
          };
          const rounds = [...state.rounds];
          const lastRound = rounds[rounds.length - 1];
          if (lastRound) {
            rounds[rounds.length - 1] = {
              ...lastRound,
              statements: [...lastRound.statements, { role, content }],
            };
          }
          return { ...state, rounds };
        }

        case "pause": {
          return state;
        }

        default:
          return state;
      }
    }

    default:
      return state;
  }
}

export function useMagiEvents(eventsUrl: string | null): MagiState {
  const [state, dispatch] = useReducer(reducer, initialState);
  const hasConnected = useRef(false);
  const retryCount = useRef(0);

  useEffect(() => {
    if (!eventsUrl) return;

    let eventSource: EventSource | null = null;
    let closed = false;

    function connect() {
      if (closed) return;
      eventSource = new EventSource(eventsUrl!);

      eventSource.onopen = () => {
        hasConnected.current = true;
        retryCount.current = 0;
        dispatch({ type: "CONNECTED" });
      };

      eventSource.onmessage = (e) => {
        if (!hasConnected.current) {
          hasConnected.current = true;
          retryCount.current = 0;
          dispatch({ type: "CONNECTED" });
        }
        try {
          const event = JSON.parse(e.data) as MagiEvent;
          dispatch({ type: "EVENT", event });
        } catch {
          // ignore parse errors
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();

        if (hasConnected.current) {
          // Connection was established then lost — task likely completed
          // Poll status to confirm
          pollStatus();
          return;
        }

        // Never connected — retry with backoff (server may not be ready yet)
        retryCount.current += 1;
        if (retryCount.current <= 10 && !closed) {
          const delay = Math.min(1000 * retryCount.current, 5000);
          setTimeout(connect, delay);
        } else {
          dispatch({
            type: "ERROR",
            message: "サーバーに接続できません。サーバーが起動しているか確認してください。",
          });
        }
      };
    }

    async function pollStatus() {
      try {
        const prefix = eventsUrl!.includes("/spec/") ? "spec" : "tasks";
        const parts = eventsUrl!.split("/");
        const idIndex = parts.indexOf(prefix) + 1;
        const taskId = parts[idIndex];
        const origin = new URL(eventsUrl!).origin;
        const res = await fetch(`${origin}/api/${prefix}/${taskId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === "completed") {
            dispatch({ type: "COMPLETED" });
          } else if (data.status === "error") {
            dispatch({
              type: "ERROR",
              message: data.error ?? "タスクがエラーで終了しました",
            });
          } else if (data.status === "running") {
            // Still running, reconnect SSE
            if (!closed) {
              setTimeout(connect, 1000);
            }
          }
        }
      } catch {
        // ignore poll errors
      }
    }

    connect();

    return () => {
      closed = true;
      eventSource?.close();
    };
  }, [eventsUrl]);

  return state;
}
