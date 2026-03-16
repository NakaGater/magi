import http from "http";
import type { MagiEvent } from "@magi/core";

export interface SSEClientOptions {
  url: string;
  onEvent: (event: MagiEvent) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
}

export function connectSSE(opts: SSEClientOptions): { close: () => void } {
  const req = http.get(opts.url, (res) => {
    if (res.statusCode !== 200) {
      opts.onError(new Error(`SSE connection failed: HTTP ${res.statusCode}`));
      return;
    }

    let buffer = "";

    res.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const parts = buffer.split("\n\n");
      buffer = parts.pop()!;

      for (const part of parts) {
        const line = part.trim();
        if (line.startsWith("data: ")) {
          try {
            opts.onEvent(JSON.parse(line.substring(6)));
          } catch {
            // skip unparseable events
          }
        }
      }
    });

    res.on("end", () => opts.onComplete());
    res.on("error", (err) => opts.onError(err));
  });

  req.on("error", (err) => opts.onError(err));

  return { close: () => req.destroy() };
}
