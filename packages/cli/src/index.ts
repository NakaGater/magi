import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { Magi } from "@magi/core";
import type { MagiEvent, MagiConfig } from "@magi/core";

const program = new Command();

program
  .name("magi")
  .description("3人の賢者が議論し、成果物を生み出す")
  .version("0.1.0");

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
