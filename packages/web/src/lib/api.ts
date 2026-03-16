// SSE はNext.js rewriteを経由するとバッファされてストリーミングできないため、
// バックエンドに直接接続する
const MAGI_SERVER =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_MAGI_SERVER ?? "http://localhost:3400")
    : "http://localhost:3400";

export interface TaskInfo {
  id: string;
  task: string;
  mode: "spec" | "build";
  status: string;
  events: number;
  result?: unknown;
}

export async function createSpec(task: string): Promise<{ id: string }> {
  const res = await fetch("/api/spec", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task }),
  });
  if (!res.ok) throw new Error(`Failed to create spec: ${res.statusText}`);
  return res.json();
}

export async function createBuildTask(task: string): Promise<{ id: string }> {
  const res = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task }),
  });
  if (!res.ok) throw new Error(`Failed to create task: ${res.statusText}`);
  return res.json();
}

export async function getTaskStatus(id: string): Promise<TaskInfo> {
  const prefix = id.startsWith("spec-") ? "spec" : "tasks";
  const res = await fetch(`/api/${prefix}/${id}`);
  if (!res.ok) throw new Error(`Failed to get task: ${res.statusText}`);
  return res.json();
}

export async function listSpecs(): Promise<TaskInfo[]> {
  const res = await fetch("/api/specs");
  if (!res.ok) throw new Error(`Failed to list specs: ${res.statusText}`);
  return res.json();
}

export async function listTasks(): Promise<TaskInfo[]> {
  const res = await fetch("/api/tasks");
  if (!res.ok) throw new Error(`Failed to list tasks: ${res.statusText}`);
  return res.json();
}

export async function sendMessage(id: string, message: string): Promise<void> {
  const prefix = id.startsWith("spec-") ? "spec" : "tasks";
  const res = await fetch(`/api/${prefix}/${id}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Failed to send message: ${res.statusText}`);
  }
}

export function getEventsUrl(id: string): string {
  const prefix = id.startsWith("spec-") ? "spec" : "tasks";
  return `${MAGI_SERVER}/api/${prefix}/${id}/events`;
}
