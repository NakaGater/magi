import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { Magi } from "@magi/core";
import type { MagiEvent, TaskResult } from "@magi/core";

const app = new Hono();

app.use("*", cors());

// Active tasks and their events
const activeTasks = new Map<
  string,
  { task: string; events: MagiEvent[]; result?: TaskResult; status: string }
>();

// SSE connections per task
const sseConnections = new Map<string, Set<ReadableStreamDefaultController>>();

app.get("/", (c) => {
  return c.json({
    name: "Magi Server",
    version: "0.1.0",
    description: "3人の賢者が議論し、コードを織り上げる",
  });
});

// Create a new task
app.post("/api/tasks", async (c) => {
  const body = await c.req.json<{ task: string; config?: Record<string, unknown> }>();

  if (!body.task) {
    return c.json({ error: "task is required" }, 400);
  }

  const taskId = `task-${Date.now().toString(36)}`;

  activeTasks.set(taskId, {
    task: body.task,
    events: [],
    status: "running",
  });

  // Start task execution asynchronously
  runTask(taskId, body.task, body.config).catch((err) => {
    const taskData = activeTasks.get(taskId);
    if (taskData) {
      taskData.status = "error";
      broadcastEvent(taskId, {
        type: "error",
        data: { message: (err as Error).message },
        timestamp: new Date(),
      });
    }
  });

  return c.json({ id: taskId, status: "running" }, 201);
});

// Get task status
app.get("/api/tasks/:id", (c) => {
  const id = c.req.param("id");
  const taskData = activeTasks.get(id);

  if (!taskData) {
    return c.json({ error: "task not found" }, 404);
  }

  return c.json({
    id,
    task: taskData.task,
    status: taskData.status,
    events: taskData.events.length,
    result: taskData.result,
  });
});

// List all tasks
app.get("/api/tasks", (c) => {
  const tasks = Array.from(activeTasks.entries()).map(([id, data]) => ({
    id,
    task: data.task,
    status: data.status,
    events: data.events.length,
  }));

  return c.json(tasks);
});

// SSE endpoint for live events
app.get("/api/tasks/:id/events", (c) => {
  const id = c.req.param("id");
  const taskData = activeTasks.get(id);

  if (!taskData) {
    return c.json({ error: "task not found" }, 404);
  }

  const stream = new ReadableStream({
    start(controller) {
      // Send past events first
      for (const event of taskData.events) {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(new TextEncoder().encode(data));
      }

      // Register for future events
      if (!sseConnections.has(id)) {
        sseConnections.set(id, new Set());
      }
      sseConnections.get(id)!.add(controller);
    },
    cancel() {
      sseConnections.get(id)?.delete(undefined as any);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});

// History endpoint
app.get("/api/history", (c) => {
  // TODO: Read from .magi/discussions/
  return c.json([]);
});

async function runTask(
  taskId: string,
  task: string,
  config?: Record<string, unknown>,
): Promise<void> {
  const magi = new Magi(config as any);
  await magi.init();

  magi.onEvent((event) => {
    const taskData = activeTasks.get(taskId);
    if (taskData) {
      taskData.events.push(event);
    }
    broadcastEvent(taskId, event);
  });

  const result = await magi.run(task);

  const taskData = activeTasks.get(taskId);
  if (taskData) {
    taskData.result = result;
    taskData.status = "completed";
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
