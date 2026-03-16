import readline from "readline";
import chalk from "chalk";
import type { MagiEvent } from "@magi/core";
import type { Interface as ReadlineInterface } from "readline";

let activeRl: ReadlineInterface | null = null;

export function setActiveReadline(rl: ReadlineInterface | null): void {
  activeRl = rl;
}

export function terminalWrite(message: string): void {
  if (activeRl) {
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(message + "\n");
    activeRl.prompt(true);
  } else {
    console.log(message);
  }
}

export function stageLabel(stage: string): string {
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

export function roleIcon(role: string): string {
  const icons: Record<string, string> = {
    PM: "📊",
    PD: "🎨",
    Dev: "⚙️",
  };
  return icons[role] ?? "●";
}

export function formatDuration(start: Date, end: Date): string {
  const ms = end.getTime() - start.getTime();
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export function formatMagiEvent(event: MagiEvent): void {
  switch (event.type) {
    case "stage_start":
      terminalWrite("");
      terminalWrite(chalk.cyan.bold(`▶ ${stageLabel(event.stage!)} 開始`));
      terminalWrite(chalk.dim("─".repeat(50)));
      break;

    case "round_start":
      terminalWrite(chalk.dim(`\n── Round ${event.data.round} ──`));
      break;

    case "statement": {
      const { role, content } = event.data as {
        role: string;
        content: string;
      };
      const icon = roleIcon(role);
      terminalWrite("");
      terminalWrite(chalk.bold(`${icon} ${role}`));
      terminalWrite(content as string);
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
      terminalWrite(chalk.dim(`\n${icon} 合意状況: ${consensus}`));
      break;
    }

    case "stage_end":
      terminalWrite(chalk.cyan(`✓ ${stageLabel(event.stage!)} 完了`));
      break;

    case "artifact": {
      const artType = event.data.type as string;
      const artPath = (event.data.path ?? event.data.paths) as string;
      terminalWrite(
        chalk.green(`  📄 成果物生成: ${artType} → ${artPath}`),
      );
      break;
    }

    case "commit": {
      terminalWrite(
        chalk.green(
          `  📝 ${event.data.hash} ${event.data.message}`,
        ),
      );
      break;
    }

    case "gate":
      terminalWrite(
        chalk.yellow(`\n🚦 ゲート: ${event.data.message}`),
      );
      break;

    case "pause":
      terminalWrite(
        chalk.yellow(`\n⏸ 一時停止: ${event.data.reason}`),
      );
      break;

    case "error":
      terminalWrite(
        chalk.red(`\n❌ エラー: ${event.data.message}`),
      );
      break;

    case "validation_warning":
      terminalWrite(
        chalk.yellow(`\n⚠ バリデーション警告: ${event.data.message}`),
      );
      break;

    case "context_synced":
      terminalWrite(
        chalk.blue(`\n🔄 コンテキスト同期: ${event.data.updatedFiles ?? "完了"}`),
      );
      break;
  }
}
