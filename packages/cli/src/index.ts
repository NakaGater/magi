import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { Magi } from "@magi/core";
import type { MagiEvent } from "@magi/core";

const program = new Command();

program
  .name("magi")
  .description("3人の賢者が議論し、コードを織り上げる")
  .version("0.1.0");

// Main command: magi "task description"
program
  .argument("[task]", "課題の説明")
  .option("--quick", "議論なし高速モード")
  .option("--deep", "5ラウンド深い議論")
  .option("--pause-after <stage>", "指定ステージ後に停止")
  .option("--roles-dir <dir>", "ロール定義ディレクトリ", "roles")
  .action(async (task: string | undefined, options) => {
    if (!task) {
      program.help();
      return;
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error(
        chalk.red("Error: ANTHROPIC_API_KEY environment variable is required"),
      );
      console.error(chalk.dim("Run: export ANTHROPIC_API_KEY=your-key"));
      process.exit(1);
    }

    const spinner = ora("Magi を初期化中...").start();

    try {
      const config: Record<string, unknown> = {};

      if (options.quick) {
        (config as any).pipeline = { maxRounds: 1 };
      } else if (options.deep) {
        (config as any).pipeline = { maxRounds: 5 };
      }

      if (options.pauseAfter) {
        (config as any).pipeline = {
          ...((config as any).pipeline ?? {}),
          pauseAfterDesign: options.pauseAfter === "design",
        };
      }

      const magi = new Magi(config as any);
      await magi.init(options.rolesDir);

      spinner.succeed("Magi 準備完了");
      console.log();
      console.log(chalk.bold(`📋 課題: ${task}`));
      console.log(chalk.dim("─".repeat(50)));

      // Event handler for live output
      magi.onEvent((event: MagiEvent) => {
        switch (event.type) {
          case "stage_start":
            console.log();
            console.log(
              chalk.cyan.bold(`▶ ${stageLabel(event.stage!)} 開始`),
            );
            console.log(chalk.dim("─".repeat(50)));
            break;

          case "round_start":
            console.log(
              chalk.dim(`\n── Round ${event.data.round} ──`),
            );
            break;

          case "statement": {
            const { role, content } = event.data as {
              role: string;
              content: string;
            };
            const icon = roleIcon(role as string);
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
            console.log(
              chalk.cyan(`✓ ${stageLabel(event.stage!)} 完了`),
            );
            break;

          case "commit":
            console.log(
              chalk.green(`  📝 ${event.data.hash} ${event.data.message}`),
            );
            break;

          case "pause":
            console.log(
              chalk.yellow(`\n⏸ 一時停止: ${event.data.reason}`),
            );
            break;

          case "error":
            console.log(chalk.red(`\n❌ エラー: ${event.data.message}`));
            break;
        }
      });

      const result = await magi.run(task);

      console.log();
      console.log(chalk.dim("═".repeat(50)));
      console.log(chalk.bold.green("✅ 完了"));
      console.log(chalk.dim(`Tokens: ${result.totalTokens.toLocaleString()}`));
      console.log(chalk.dim(`Cost: $${result.totalCost.toFixed(4)}`));
      console.log(
        chalk.dim(`Duration: ${formatDuration(result.startedAt, result.completedAt)}`),
      );
    } catch (error) {
      spinner.fail("エラーが発生しました");
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

// History command
program
  .command("history")
  .argument("[keyword]", "検索キーワード")
  .description("議論履歴の一覧")
  .action(async (keyword?: string) => {
    console.log(chalk.bold("📚 議論履歴"));
    console.log(chalk.dim("(実装予定: .magi/discussions/ から読み込み)"));
    if (keyword) {
      console.log(chalk.dim(`検索: ${keyword}`));
    }
  });

// Why command
program
  .command("why <keyword>")
  .description("判断理由の検索")
  .action(async (keyword: string) => {
    console.log(chalk.bold(`🔍 「${keyword}」に関する判断理由`));
    console.log(chalk.dim("(実装予定: 議論ログの全文検索)"));
  });

// Init command
program
  .command("init")
  .description("プロジェクトの初期化")
  .action(async () => {
    const spinner = ora("プロジェクトを初期化中...").start();
    try {
      const magi = new Magi();
      await magi.init();
      spinner.succeed("初期化完了: .magi/ ディレクトリを作成しました");
    } catch (error) {
      spinner.fail("初期化に失敗しました");
      console.error(chalk.red((error as Error).message));
    }
  });

function stageLabel(stage: string): string {
  const labels: Record<string, string> = {
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
