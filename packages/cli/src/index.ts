import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { spawn, type ChildProcess } from "child_process";
import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { Magi } from "@magi/core";
import type { MagiEvent, MagiConfig } from "@magi/core";

const program = new Command();

// Default to "start" when no arguments given
if (process.argv.length === 2) {
  process.argv.push("start");
}

program
  .name("magi")
  .description("3人の賢者が議論し、成果物を生み出す")
  .version("0.1.0");

// --- Start command ---
program
  .command("start")
  .description("サーバーとWeb UIを起動")
  .option("--port <n>", "サーバーポート", "3400")
  .option("--web-port <n>", "Web UIポート", "3000")
  .option("--dev", "開発モードで起動")
  .option("--no-open", "ブラウザを自動で開かない")
  .action(async (options) => {
    const serverPort = options.port;
    const webPort = options.webPort;
    const isDev = options.dev ?? false;
    const shouldOpen = options.open !== false;

    // Resolve paths
    const cliDir = typeof __dirname !== "undefined"
      ? __dirname
      : dirname(fileURLToPath(import.meta.url));
    const repoRoot = resolve(cliDir, "..", "..", "..");
    const serverDist = resolve(repoRoot, "packages", "server", "dist", "index.js");

    const webNextDir = resolve(repoRoot, "packages", "web", ".next");

    if (!isDev && !existsSync(serverDist)) {
      console.error(chalk.red("Server not built. Run: pnpm build"));
      process.exit(1);
    }
    if (!isDev && !existsSync(webNextDir)) {
      console.error(chalk.red("Web UI not built. Run: pnpm build"));
      process.exit(1);
    }

    //  M(11) + gap(5) + A(8) + gap(5) + G(9) + gap(5) + I(3) = 46
    const g = (hex: string, text: string) => chalk.hex(hex)(text);
    const banner = [
      "",
      g("#6C63FF", "  ███╗   ███╗      █████╗       ██████╗      ██╗"),
      g("#7073FF", "  ████╗ ████║     ██╔══██╗     ██╔════╝      ██║"),
      g("#7F7AFF", "  ██╔████╔██║     ███████║     ██║  ███╗     ██║"),
      g("#9993FF", "  ██║╚██╔╝██║     ██╔══██║     ██║   ██║     ██║"),
      g("#A8A3FF", "  ██║ ╚═╝ ██║     ██║  ██║     ╚██████╔╝     ██║"),
      g("#B7B3FF", "  ╚═╝     ╚═╝     ╚═╝  ╚═╝      ╚═════╝      ╚═╝"),
      "",
      chalk.dim("  Three Wise Agents, One Decision              v0.1.0"),
      "",
      chalk.dim("  ──────────────────────────────────────────────────"),
      `  ${g("#8A83FF", "Server")}   ${chalk.white(`http://localhost:${serverPort}`)}`,
      `  ${g("#8A83FF", "Web UI")}   ${chalk.white(`http://localhost:${webPort}`)}`,
      `  ${g("#8A83FF", "Mode")}     ${chalk.white(isDev ? "development" : "production")}`,
      chalk.dim("  ──────────────────────────────────────────────────"),
      "",
    ];
    console.log(banner.join("\n"));

    const children: ChildProcess[] = [];

    // Start server
    const serverChild = isDev
      ? spawn("pnpm", ["--filter", "@magi/server", "run", "dev"], {
          cwd: repoRoot,
          env: { ...process.env, PORT: serverPort },
          stdio: ["ignore", "pipe", "pipe"],
        })
      : spawn("node", [serverDist], {
          cwd: repoRoot,
          env: { ...process.env, PORT: serverPort },
          stdio: ["ignore", "pipe", "pipe"],
        });

    children.push(serverChild);

    // Noise patterns to suppress from child output
    const suppressPatterns = [
      /^>\s/,                    // pnpm script echo ("> next start")
      /^@magi\//,               // pnpm package prefix
      /ExperimentalWarning/,
      /^\s*$/,                   // blank lines
      /^▲\s*Next/,              // Next.js version banner
      /^-\s*(Local|Network):/,  // Next.js URL info (already in our banner)
      /^✓\s*Starting\.\.\./,   // Next.js "Starting..."
    ];

    const shouldSuppress = (line: string) =>
      suppressPatterns.some((p) => p.test(line));

    const formatLog = (prefix: string, color: typeof chalk.blue, data: Buffer) => {
      for (const raw of data.toString().split("\n")) {
        const line = raw.trim();
        if (!line || shouldSuppress(line)) continue;
        console.log(`  ${color(prefix)}  ${chalk.dim(line)}`);
      }
    };

    serverChild.stdout?.on("data", (data: Buffer) => formatLog("server", chalk.blue, data));
    serverChild.stderr?.on("data", (data: Buffer) => formatLog("server", chalk.red, data));

    // Start web UI
    const webCommand = isDev ? "dev" : "start";
    const webChild = spawn("pnpm", ["--filter", "@magi/web", "run", webCommand], {
      cwd: repoRoot,
      env: { ...process.env, PORT: webPort, NEXT_PUBLIC_MAGI_SERVER: `http://localhost:${serverPort}` },
      stdio: ["ignore", "pipe", "pipe"],
    });
    children.push(webChild);

    webChild.stdout?.on("data", (data: Buffer) => formatLog("web   ", chalk.green, data));
    webChild.stderr?.on("data", (data: Buffer) => formatLog("web   ", chalk.red, data));

    // Open browser after a short delay
    if (shouldOpen) {
      setTimeout(() => {
        const url = `http://localhost:${webPort}`;
        spawn("open", [url], { stdio: "ignore" }).unref();
      }, 3000);
    }

    // Graceful shutdown
    const shutdown = () => {
      console.log(chalk.dim("\nMagi をシャットダウン中..."));
      for (const child of children) {
        child.kill("SIGTERM");
      }
      setTimeout(() => process.exit(0), 2000);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    // Wait for children to exit
    await Promise.all(
      children.map(
        (child) =>
          new Promise<void>((res) => {
            child.on("exit", () => res());
          }),
      ),
    );
  });

// --- Spec command ---
program
  .command("spec")
  .argument("<task>", "課題の説明")
  .option("--sync", "生成と同時にGitHub Projectsへ連携")
  .option("--rounds <n>", "議論ラウンド数", "3")
  .option("--roles-dir <dir>", "ロール定義ディレクトリ", "roles")
  .description("Specモード: 議論→仕様書+ADR+タスクリスト生成")
  .action(async (task: string, options) => {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error(
        chalk.red("Error: ANTHROPIC_API_KEY environment variable is required"),
      );
      console.error(chalk.dim("Run: export ANTHROPIC_API_KEY=your-key"));
      process.exit(1);
    }

    const spinner = ora("Magi を初期化中...").start();

    try {
      const config: Partial<MagiConfig> = {};
      const rounds = parseInt(options.rounds, 10);
      if (rounds !== 3) {
        config.pipeline = {
          ...config.pipeline,
          maxRounds: rounds,
        } as MagiConfig["pipeline"];
      }

      const magi = new Magi(config);
      await magi.init(options.rolesDir);

      spinner.succeed("Magi 準備完了");
      console.log();
      console.log(chalk.bold(`📋 Specモード: ${task}`));
      console.log(chalk.dim("─".repeat(50)));

      setupEventHandler(magi);

      const result = await magi.spec(task);

      console.log();
      console.log(chalk.dim("═".repeat(50)));
      console.log(chalk.bold.green("✅ Spec完了"));
      console.log(chalk.dim(`出力: ${result.outputDir}`));
      console.log();

      // List generated artifacts
      if (result.artifacts.requirements) {
        console.log(chalk.green("  📄 requirements.md"));
      }
      if (result.artifacts.spec) {
        console.log(chalk.green("  📄 spec.md"));
      }
      if (result.artifacts.adrs && result.artifacts.adrs.length > 0) {
        console.log(
          chalk.green(`  📄 ADR x${result.artifacts.adrs.length}`),
        );
      }
      if (result.artifacts.tasks) {
        console.log(chalk.green("  📄 tasks.yaml"));
      }
      if (result.artifacts.mermaid) {
        console.log(chalk.green("  📄 flow.mermaid"));
      }

      console.log();
      console.log(
        chalk.dim(
          `Duration: ${formatDuration(result.startedAt, result.completedAt)}`,
        ),
      );
    } catch (error) {
      spinner.fail("エラーが発生しました");
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

// --- Build command ---
program
  .command("build")
  .argument("<task>", "課題の説明")
  .option("--quick", "議論なし高速モード")
  .option("--deep", "5ラウンド深い議論")
  .option("--pause-after <stage>", "指定ステージ後に停止")
  .option("--roles-dir <dir>", "ロール定義ディレクトリ", "roles")
  .description("Buildモード: 議論→実装→レビュー→検証")
  .action(async (task: string, options) => {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error(
        chalk.red("Error: ANTHROPIC_API_KEY environment variable is required"),
      );
      console.error(chalk.dim("Run: export ANTHROPIC_API_KEY=your-key"));
      process.exit(1);
    }

    const spinner = ora("Magi を初期化中...").start();

    try {
      const config: Partial<MagiConfig> = {};

      if (options.quick) {
        config.pipeline = {
          maxRounds: 1,
        } as MagiConfig["pipeline"];
      } else if (options.deep) {
        config.pipeline = {
          maxRounds: 5,
        } as MagiConfig["pipeline"];
      }

      const magi = new Magi(config);
      await magi.init(options.rolesDir);

      spinner.succeed("Magi 準備完了");
      console.log();
      console.log(chalk.bold(`📋 Buildモード: ${task}`));
      console.log(chalk.dim("─".repeat(50)));

      setupEventHandler(magi);

      const result = await magi.build(task);

      console.log();
      console.log(chalk.dim("═".repeat(50)));
      console.log(chalk.bold.green("✅ Build完了"));
      console.log(
        chalk.dim(
          `Duration: ${formatDuration(result.startedAt, result.completedAt)}`,
        ),
      );
    } catch (error) {
      spinner.fail("エラーが発生しました");
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

// --- Init command ---
program
  .command("init")
  .description("プロジェクトの初期化")
  .action(async () => {
    const spinner = ora("プロジェクトを初期化中...").start();
    try {
      const magi = new Magi();
      await magi.init();
      spinner.succeed(
        "初期化完了: .magi/ ディレクトリを作成しました（discussions, specs, context）",
      );
    } catch (error) {
      spinner.fail("初期化に失敗しました");
      console.error(chalk.red((error as Error).message));
    }
  });

// --- History command ---
program
  .command("history")
  .argument("[keyword]", "検索キーワード")
  .description("議論履歴の一覧")
  .action(async (keyword?: string) => {
    console.log(chalk.bold("📚 議論履歴"));
    console.log(
      chalk.dim("(実装予定: .magi/discussions/ と .magi/specs/ から読み込み)"),
    );
    if (keyword) {
      console.log(chalk.dim(`検索: ${keyword}`));
    }
  });

// --- Why command ---
program
  .command("why <keyword>")
  .description("判断理由の検索")
  .action(async (keyword: string) => {
    console.log(chalk.bold(`🔍 「${keyword}」に関する判断理由`));
    console.log(chalk.dim("(実装予定: 議論ログ・ADRの全文検索)"));
  });

// --- Event handler ---
function setupEventHandler(magi: Magi): void {
  magi.onEvent((event: MagiEvent) => {
    switch (event.type) {
      case "stage_start":
        console.log();
        console.log(chalk.cyan.bold(`▶ ${stageLabel(event.stage!)} 開始`));
        console.log(chalk.dim("─".repeat(50)));
        break;

      case "round_start":
        console.log(chalk.dim(`\n── Round ${event.data.round} ──`));
        break;

      case "statement": {
        const { role, content } = event.data as {
          role: string;
          content: string;
        };
        const icon = roleIcon(role);
        console.log();
        console.log(chalk.bold(`${icon} ${role}`));
        console.log(content as string);
        break;
      }

      case "round_end": {
        const consensus = event.data.consensus as string;
        const icon =
          consensus === "agreed"
            ? "✅"
            : consensus === "partial"
              ? "🔶"
              : "❌";
        console.log(chalk.dim(`\n${icon} 合意状況: ${consensus}`));
        break;
      }

      case "stage_end":
        console.log(chalk.cyan(`✓ ${stageLabel(event.stage!)} 完了`));
        break;

      case "artifact": {
        const artType = event.data.type as string;
        const artPath = (event.data.path ?? event.data.paths) as string;
        console.log(
          chalk.green(`  📄 成果物生成: ${artType} → ${artPath}`),
        );
        break;
      }

      case "commit": {
        console.log(
          chalk.green(
            `  📝 ${event.data.hash} ${event.data.message}`,
          ),
        );
        break;
      }

      case "gate":
        console.log(
          chalk.yellow(`\n🚦 ゲート: ${event.data.message}`),
        );
        break;

      case "pause":
        console.log(
          chalk.yellow(`\n⏸ 一時停止: ${event.data.reason}`),
        );
        break;

      case "error":
        console.log(
          chalk.red(`\n❌ エラー: ${event.data.message}`),
        );
        break;

      case "validation_warning":
        console.log(
          chalk.yellow(`\n⚠ バリデーション警告: ${event.data.message}`),
        );
        break;

      case "context_synced":
        console.log(
          chalk.blue(`\n🔄 コンテキスト同期: ${event.data.updatedFiles ?? "完了"}`),
        );
        break;
    }
  });
}

function stageLabel(stage: string): string {
  const labels: Record<string, string> = {
    // Spec mode
    elaborate: "要件精緻化 (Elaborate)",
    specify: "仕様策定 (Specify)",
    decide: "設計判断 (Decide)",
    plan: "タスク分割 (Plan)",
    sync: "連携・承認 (Sync)",
    // Build mode
    analysis: "分析 (Analysis)",
    design: "設計 (Design)",
    implement: "実装 (Implementation)",
    review: "レビュー (Review)",
    verify: "検証 (Verification)",
  };
  return labels[stage] ?? stage;
}

function roleIcon(role: string): string {
  const icons: Record<string, string> = {
    PM: "📊",
    PD: "🎨",
    Dev: "⚙️",
  };
  return icons[role] ?? "●";
}

function formatDuration(start: Date, end: Date): string {
  const ms = end.getTime() - start.getTime();
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

program.parse();
