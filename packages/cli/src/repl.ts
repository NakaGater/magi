import readline from "readline";
import chalk from "chalk";
import yaml from "js-yaml";
import { existsSync } from "fs";
import { readdir, readFile } from "fs/promises";
import { resolve, join } from "path";
import { Magi, ContextReferenceEngine } from "@magi/core";
import { connectSSE } from "./sse-client.js";
import { formatMagiEvent, terminalWrite, setActiveReadline } from "./format.js";

export interface ReplOptions {
  serverPort: number;
  onQuit: () => void;
}

export async function startRepl(options: ReplOptions): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.hex("#8A83FF")("magi> "),
  });

  setActiveReadline(rl);
  const activeStreams = new Map<string, { close: () => void }>();

  rl.prompt();

  return new Promise<void>((resolvePromise) => {
    rl.on("line", async (input) => {
      const trimmed = input.trim();
      if (!trimmed) {
        rl.prompt();
        return;
      }

      if (!trimmed.startsWith("/")) {
        terminalWrite(chalk.dim("コマンドは / で始めてください。/help でコマンド一覧を表示"));
        rl.prompt();
        return;
      }

      const spaceIdx = trimmed.indexOf(" ");
      const cmd = spaceIdx === -1 ? trimmed : trimmed.substring(0, spaceIdx);
      const arg = spaceIdx === -1 ? "" : trimmed.substring(spaceIdx + 1).trim();

      switch (cmd) {
        case "/spec":
          await handleSpec(arg, options.serverPort, activeStreams);
          break;
        case "/build":
          await handleBuild(arg, options.serverPort, activeStreams);
          break;
        case "/init":
          await handleInit();
          break;
        case "/history":
          await handleHistory(arg || undefined);
          break;
        case "/why":
          await handleWhy(arg);
          break;
        case "/status":
          await handleStatus(options.serverPort);
          break;
        case "/help":
          handleHelp();
          break;
        case "/quit":
        case "/exit":
          options.onQuit();
          rl.close();
          return;
        default:
          terminalWrite(chalk.dim(`不明なコマンド: ${cmd}  /help でコマンド一覧を表示`));
      }

      rl.prompt();
    });

    rl.on("close", () => {
      setActiveReadline(null);
      resolvePromise();
    });

    // Ctrl+C: disconnect active streams or shutdown
    rl.on("SIGINT", () => {
      if (activeStreams.size > 0) {
        for (const [id, s] of activeStreams) {
          s.close();
          activeStreams.delete(id);
        }
        terminalWrite(chalk.dim("\nストリーム切断。タスクはサーバーで継続中。"));
        rl.prompt();
      } else {
        options.onQuit();
      }
    });
  });
}

// --- Command handlers ---

async function handleSpec(
  task: string,
  serverPort: number,
  activeStreams: Map<string, { close: () => void }>,
): Promise<void> {
  if (!task) {
    terminalWrite(chalk.dim("使い方: /spec <課題の説明>"));
    return;
  }

  terminalWrite(chalk.dim(`Spec開始: ${task}`));

  try {
    const res = await fetch(`http://localhost:${serverPort}/api/spec`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      terminalWrite(chalk.red(`エラー: ${(body as any).error ?? res.statusText}`));
      return;
    }

    const { id } = (await res.json()) as { id: string };
    terminalWrite(chalk.dim(`タスクID: ${id}`));

    await streamEvents(id, "spec", serverPort, activeStreams);
  } catch (err) {
    terminalWrite(chalk.red(`サーバー接続エラー: ${(err as Error).message}`));
  }
}

async function handleBuild(
  task: string,
  serverPort: number,
  activeStreams: Map<string, { close: () => void }>,
): Promise<void> {
  if (!task) {
    terminalWrite(chalk.dim("使い方: /build <課題の説明>"));
    return;
  }

  terminalWrite(chalk.dim(`Build開始: ${task}`));

  try {
    const res = await fetch(`http://localhost:${serverPort}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      terminalWrite(chalk.red(`エラー: ${(body as any).error ?? res.statusText}`));
      return;
    }

    const { id } = (await res.json()) as { id: string };
    terminalWrite(chalk.dim(`タスクID: ${id}`));

    await streamEvents(id, "build", serverPort, activeStreams);
  } catch (err) {
    terminalWrite(chalk.red(`サーバー接続エラー: ${(err as Error).message}`));
  }
}

function streamEvents(
  taskId: string,
  mode: "spec" | "build",
  serverPort: number,
  activeStreams: Map<string, { close: () => void }>,
): Promise<void> {
  const eventsPath = mode === "spec"
    ? `/api/spec/${taskId}/events`
    : `/api/tasks/${taskId}/events`;

  return new Promise<void>((resolve) => {
    const conn = connectSSE({
      url: `http://localhost:${serverPort}${eventsPath}`,
      onEvent: (event) => {
        formatMagiEvent(event);
      },
      onComplete: () => {
        activeStreams.delete(taskId);
        terminalWrite(chalk.dim(`\n${mode === "spec" ? "Spec" : "Build"} 完了 (${taskId})`));
        resolve();
      },
      onError: (err) => {
        activeStreams.delete(taskId);
        terminalWrite(chalk.red(`SSEエラー: ${err.message}`));
        resolve();
      },
    });

    activeStreams.set(taskId, conn);
  });
}

async function handleInit(): Promise<void> {
  terminalWrite(chalk.dim("プロジェクトを初期化中..."));
  try {
    const magi = new Magi();
    await magi.init();
    terminalWrite(chalk.green("初期化完了: .magi/ ディレクトリを作成しました"));
  } catch (err) {
    terminalWrite(chalk.red(`初期化エラー: ${(err as Error).message}`));
  }
}

async function handleHistory(keyword?: string): Promise<void> {
  const discussionsDir = resolve(process.cwd(), ".magi/discussions");
  if (!existsSync(discussionsDir)) {
    terminalWrite(chalk.dim("議論履歴がありません (.magi/discussions/ が存在しません)"));
    return;
  }

  const entries = await readdir(discussionsDir, { withFileTypes: true });

  interface DiscussionEntry {
    hashId: string;
    task: string;
    startedAt: string;
    stages: string[];
  }

  const items: DiscussionEntry[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const metaPath = join(discussionsDir, entry.name, "meta.yaml");
    if (!existsSync(metaPath)) continue;

    try {
      const raw = await readFile(metaPath, "utf-8");
      const meta = yaml.load(raw) as Record<string, any>;
      const hashMatch = entry.name.match(/-([a-z0-9]+)$/);
      const hashId = hashMatch ? hashMatch[1] : entry.name;
      const stages = (meta.stages ?? []).map((s: any) => s.name ?? s);

      items.push({
        hashId,
        task: meta.task ?? "",
        startedAt: meta.started_at ?? "",
        stages,
      });
    } catch {
      // skip
    }
  }

  items.sort((a, b) => (b.startedAt > a.startedAt ? 1 : -1));

  const filtered = keyword
    ? items.filter((item) => item.task.includes(keyword))
    : items;

  if (filtered.length === 0) {
    terminalWrite(chalk.dim(keyword ? `「${keyword}」に一致する議論が見つかりませんでした` : "議論履歴がありません"));
    return;
  }

  terminalWrite(chalk.bold("📚 議論履歴"));
  terminalWrite("");

  for (const item of filtered) {
    const date = item.startedAt ? item.startedAt.substring(0, 10) : "----/--/--";
    const stagesStr = item.stages.length > 0
      ? chalk.dim(`[${item.stages.join(", ")}]`)
      : "";
    terminalWrite(
      `  ${chalk.dim(date)}  ${chalk.cyan(item.hashId)}  ${item.task}  ${stagesStr}`,
    );
  }
}

async function handleWhy(keyword: string): Promise<void> {
  if (!keyword) {
    terminalWrite(chalk.dim("使い方: /why <キーワード>"));
    return;
  }

  const engine = new ContextReferenceEngine(
    resolve(process.cwd(), ".magi/discussions"),
    resolve(process.cwd(), ".magi/specs"),
  );
  const refs = await engine.findRelated(keyword);

  if (refs.length === 0) {
    terminalWrite(chalk.dim("該当する判断理由が見つかりませんでした"));
    return;
  }

  terminalWrite(chalk.bold(`🔍 「${keyword}」に関する判断理由`));
  terminalWrite("");

  for (const ref of refs) {
    terminalWrite(chalk.cyan.bold(ref.title));
    terminalWrite(chalk.dim(`  ${ref.path}  (スコア: ${ref.relevance.toFixed(1)})`));
    const lines = ref.excerpt.split("\n").slice(0, 5);
    for (const line of lines) {
      terminalWrite(chalk.dim(`  ${line}`));
    }
    terminalWrite("");
  }
}

async function handleStatus(serverPort: number): Promise<void> {
  try {
    const [tasksRes, specsRes] = await Promise.all([
      fetch(`http://localhost:${serverPort}/api/tasks`),
      fetch(`http://localhost:${serverPort}/api/specs`),
    ]);

    const tasks = (await tasksRes.json()) as any[];
    const specs = (await specsRes.json()) as any[];

    if (tasks.length === 0 && specs.length === 0) {
      terminalWrite(chalk.dim("実行中のタスクはありません"));
      return;
    }

    terminalWrite(chalk.bold("📋 タスク状態"));
    terminalWrite("");

    for (const spec of specs) {
      const statusIcon = spec.status === "running" ? "🔄" : spec.status === "completed" ? "✅" : "❌";
      terminalWrite(`  ${statusIcon} [spec] ${chalk.cyan(spec.id)}  ${spec.task}  ${chalk.dim(spec.status)}`);
    }

    for (const task of tasks) {
      if (task.mode === "spec") continue; // already shown in specs
      const statusIcon = task.status === "running" ? "🔄" : task.status === "completed" ? "✅" : "❌";
      terminalWrite(`  ${statusIcon} [${task.mode}] ${chalk.cyan(task.id)}  ${task.task}  ${chalk.dim(task.status)}`);
    }
  } catch (err) {
    terminalWrite(chalk.red(`サーバー接続エラー: ${(err as Error).message}`));
  }
}

function handleHelp(): void {
  const help = [
    "",
    chalk.bold("  Magi REPL コマンド"),
    chalk.dim("  ──────────────────────────────────────"),
    "",
    `  ${chalk.hex("#8A83FF")("/spec <task>")}     Specモード: 議論→仕様書生成`,
    `  ${chalk.hex("#8A83FF")("/build <task>")}    Buildモード: 議論→実装→検証`,
    `  ${chalk.hex("#8A83FF")("/init")}            プロジェクト初期化`,
    `  ${chalk.hex("#8A83FF")("/history [word]")}  議論履歴の一覧`,
    `  ${chalk.hex("#8A83FF")("/why <keyword>")}   判断理由の検索`,
    `  ${chalk.hex("#8A83FF")("/status")}          実行中タスクの状態`,
    `  ${chalk.hex("#8A83FF")("/help")}            このヘルプを表示`,
    `  ${chalk.hex("#8A83FF")("/quit")}            Magi を終了`,
    "",
    chalk.dim("  実行中に Ctrl+C でSSEストリームを切断（タスクはサーバーで継続）"),
    "",
  ];
  terminalWrite(help.join("\n"));
}
