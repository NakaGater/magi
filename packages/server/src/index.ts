import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { Magi } from "@magi/core";
import type { MagiEvent, TaskResult, SpecResult } from "@magi/core";

const app = new Hono();

app.use("*", cors());

// Active tasks/specs and their events
interface ActiveTask {
  task: string;
  mode: "spec" | "build";
  events: MagiEvent[];
  result?: TaskResult | SpecResult;
  status: string;
  error?: string;
}

const activeTasks = new Map<string, ActiveTask>();
const activeMagiInstances = new Map<string, Magi>();
const sseConnections = new Map<string, Set<ReadableStreamDefaultController>>();

app.get("/", (c) => {
  return c.json({
    name: "Magi Server",
    version: "0.1.0",
    description: "3人の賢者が議論し、成果物を生み出す",
    modes: ["spec", "build"],
  });
});

// --- Spec endpoints ---

app.post("/api/spec", async (c) => {
  const body = await c.req.json<{
    task: string;
    config?: Record<string, unknown>;
  }>();

  if (!body.task) {
    return c.json({ error: "task is required" }, 400);
  }

  const taskId = `spec-${Date.now().toString(36)}`;

  activeTasks.set(taskId, {
    task: body.task,
    mode: "spec",
    events: [],
    status: "running",
  });

  runSpec(taskId, body.task, body.config).catch((err) => {
    const msg = (err as Error).stack ?? (err as Error).message;
    console.error(`[Magi] spec ${taskId} failed:`, msg);
    const taskData = activeTasks.get(taskId);
    if (taskData) {
      taskData.status = "error";
      taskData.error = (err as Error).message;
      const errorEvent = {
        type: "error" as const,
        data: { message: (err as Error).message },
        timestamp: new Date(),
      };
      taskData.events.push(errorEvent);
      broadcastEvent(taskId, errorEvent);
    }
  });

  return c.json({ id: taskId, mode: "spec", status: "running" }, 201);
});

app.get("/api/spec/:id", (c) => {
  const id = c.req.param("id");
  const taskData = activeTasks.get(id);

  if (!taskData || taskData.mode !== "spec") {
    return c.json({ error: "spec task not found" }, 404);
  }

  return c.json({
    id,
    task: taskData.task,
    mode: "spec",
    status: taskData.status,
    events: taskData.events.length,
    result: taskData.result,
    ...(taskData.error && { error: taskData.error }),
  });
});

app.get("/api/spec/:id/events", (c) => {
  return handleSSE(c, c.req.param("id"));
});

app.post("/api/spec/:id/message", async (c) => {
  return handleInjectMessage(c, c.req.param("id"));
});

app.get("/api/specs", (c) => {
  const specs = Array.from(activeTasks.entries())
    .filter(([, data]) => data.mode === "spec")
    .map(([id, data]) => ({
      id,
      task: data.task,
      status: data.status,
      events: data.events.length,
    }));

  return c.json(specs);
});

// --- Build endpoints ---

app.post("/api/tasks", async (c) => {
  const body = await c.req.json<{
    task: string;
    config?: Record<string, unknown>;
  }>();

  if (!body.task) {
    return c.json({ error: "task is required" }, 400);
  }

  const taskId = `task-${Date.now().toString(36)}`;

  activeTasks.set(taskId, {
    task: body.task,
    mode: "build",
    events: [],
    status: "running",
  });

  runBuild(taskId, body.task, body.config).catch((err) => {
    const msg = (err as Error).stack ?? (err as Error).message;
    console.error(`[Magi] build ${taskId} failed:`, msg);
    const taskData = activeTasks.get(taskId);
    if (taskData) {
      taskData.status = "error";
      taskData.error = (err as Error).message;
      const errorEvent = {
        type: "error" as const,
        data: { message: (err as Error).message },
        timestamp: new Date(),
      };
      taskData.events.push(errorEvent);
      broadcastEvent(taskId, errorEvent);
    }
  });

  return c.json({ id: taskId, mode: "build", status: "running" }, 201);
});

app.get("/api/tasks/:id", (c) => {
  const id = c.req.param("id");
  const taskData = activeTasks.get(id);

  if (!taskData) {
    return c.json({ error: "task not found" }, 404);
  }

  return c.json({
    id,
    task: taskData.task,
    mode: taskData.mode,
    status: taskData.status,
    events: taskData.events.length,
    result: taskData.result,
    ...(taskData.error && { error: taskData.error }),
  });
});

app.get("/api/tasks/:id/events", (c) => {
  return handleSSE(c, c.req.param("id"));
});

app.post("/api/tasks/:id/message", async (c) => {
  return handleInjectMessage(c, c.req.param("id"));
});

app.get("/api/tasks", (c) => {
  const tasks = Array.from(activeTasks.entries()).map(([id, data]) => ({
    id,
    task: data.task,
    mode: data.mode,
    status: data.status,
    events: data.events.length,
  }));

  return c.json(tasks);
});

// --- History endpoint ---

app.get("/api/history", (c) => {
  return c.json([]);
});

// --- Helpers ---

async function handleInjectMessage(c: any, id: string) {
  const taskData = activeTasks.get(id);
  if (!taskData) {
    return c.json({ error: "task not found" }, 404);
  }
  if (taskData.status !== "running") {
    return c.json({ error: "task is not running" }, 409);
  }
  const magi = activeMagiInstances.get(id);
  if (!magi) {
    return c.json({ error: "no active magi instance" }, 409);
  }
  const body = (await c.req.json()) as { message: string };
  if (!body.message) {
    return c.json({ error: "message is required" }, 400);
  }
  try {
    magi.injectMessage(body.message);
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 409);
  }
}

function handleSSE(c: any, id: string): Response {
  const taskData = activeTasks.get(id);

  if (!taskData) {
    return c.json({ error: "task not found" }, 404);
  }

  let streamController: ReadableStreamDefaultController;

  const stream = new ReadableStream({
    start(controller) {
      streamController = controller;

      for (const event of taskData.events) {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(new TextEncoder().encode(data));
      }

      if (!sseConnections.has(id)) {
        sseConnections.set(id, new Set());
      }
      sseConnections.get(id)!.add(controller);
    },
    cancel() {
      const controllers = sseConnections.get(id);
      if (controllers) {
        controllers.delete(streamController);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function runSpec(
  taskId: string,
  task: string,
  config?: Record<string, unknown>,
): Promise<void> {
  const magi = new Magi(config as any);
  await magi.init();
  activeMagiInstances.set(taskId, magi);

  magi.onEvent((event) => {
    const taskData = activeTasks.get(taskId);
    if (taskData) {
      taskData.events.push(event);
    }
    broadcastEvent(taskId, event);
  });

  try {
    const result = await magi.spec(task);

    const taskData = activeTasks.get(taskId);
    if (taskData) {
      taskData.result = result;
      taskData.status = "completed";
    }
  } finally {
    activeMagiInstances.delete(taskId);
  }
}

async function runBuild(
  taskId: string,
  task: string,
  config?: Record<string, unknown>,
): Promise<void> {
  const magi = new Magi(config as any);
  await magi.init();
  activeMagiInstances.set(taskId, magi);

  magi.onEvent((event) => {
    const taskData = activeTasks.get(taskId);
    if (taskData) {
      taskData.events.push(event);
    }
    broadcastEvent(taskId, event);
  });

  try {
    const result = await magi.build(task);

    const taskData = activeTasks.get(taskId);
    if (taskData) {
      taskData.result = result;
      taskData.status = "completed";
    }
  } finally {
    activeMagiInstances.delete(taskId);
  }
}

function broadcastEvent(taskId: string, event: MagiEvent): void {
  const controllers = sseConnections.get(taskId);
  if (!controllers) return;

  const data = `data: ${JSON.stringify(event)}\n\n`;
  const encoded = new TextEncoder().encode(data);

  for (const controller of controllers) {
    try {
      controller.enqueue(encoded);
    } catch {
      controllers.delete(controller);
    }
  }
}

const port = parseInt(process.env.PORT ?? "3400", 10);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Magi Server running at http://localhost:${info.port}`);
});

export default app;
