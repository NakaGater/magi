import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import type {
  RoundResult,
  StageResult,
  TaskResult,
  SpecResult,
  PipelineStage,
  SpecPipelineStage,
  BuildPipelineStage,
} from "../types.js";

export class DiscussionLogger {
  private baseDir: string;

  constructor(discussionsDir: string) {
    this.baseDir = discussionsDir;
  }

  /** Create a discussion directory for a task */
  async createDiscussionDir(taskId: string): Promise<string> {
    const date = new Date().toISOString().split("T")[0];
    const dirName = `${date}_${taskId}`;
    const dirPath = join(this.baseDir, dirName);

    if (!existsSync(dirPath)) {
      await mkdir(dirPath, { recursive: true });
    }

    return dirPath;
  }

  /** Write a stage log as Markdown */
  async writeStageLog(
    discussionDir: string,
    stage: PipelineStage,
    stageIndex: number,
    result: StageResult,
  ): Promise<string> {
    const filename = `${String(stageIndex).padStart(2, "0")}-${stage}.md`;
    const filePath = join(discussionDir, filename);

    let content = `# ${this.stageTitle(stage)}\n\n`;
    content += `Stage: ${stage}\n`;
    content += `Rounds: ${result.rounds.length}\n\n`;

    for (const round of result.rounds) {
      content += this.formatRound(round);
    }

    if (result.commits.length > 0) {
      content += `## Commits\n\n`;
      for (const commit of result.commits) {
        content += `- \`${commit}\`\n`;
      }
      content += "\n";
    }

    await writeFile(filePath, content, "utf-8");
    return filePath;
  }

  /** Write task metadata YAML */
  async writeMetadata(
    discussionDir: string,
    result: TaskResult | SpecResult,
  ): Promise<string> {
    const filePath = join(discussionDir, "meta.yaml");

    const lines = [
      `id: "${result.id}"`,
      `task: "${result.task.replace(/"/g, '\\"')}"`,
      `started_at: "${result.startedAt.toISOString()}"`,
      `completed_at: "${result.completedAt.toISOString()}"`,
      `total_tokens: ${result.totalTokens}`,
      `total_cost: ${result.totalCost.toFixed(4)}`,
      `stages:`,
    ];

    for (const stage of result.stages) {
      lines.push(`  - name: ${stage.stage}`);
      lines.push(`    rounds: ${stage.rounds.length}`);
      lines.push(`    commits: ${stage.commits.length}`);
    }

    await writeFile(filePath, lines.join("\n") + "\n", "utf-8");
    return filePath;
  }

  /** Write a summary document */
  async writeSummary(
    discussionDir: string,
    result: TaskResult | SpecResult,
  ): Promise<string> {
    const filePath = join(discussionDir, "summary.md");

    let content = `# Summary: ${result.task}\n\n`;
    content += `- **Date**: ${result.startedAt.toISOString().split("T")[0]}\n`;
    content += `- **Tokens**: ${result.totalTokens.toLocaleString()}\n`;
    content += `- **Cost**: $${result.totalCost.toFixed(4)}\n\n`;

    content += `## Stages\n\n`;
    for (const stage of result.stages) {
      const lastRound = stage.rounds[stage.rounds.length - 1];
      const consensus = lastRound?.consensus ?? "N/A";
      content += `### ${this.stageTitle(stage.stage)}\n`;
      content += `- Rounds: ${stage.rounds.length}\n`;
      content += `- Consensus: ${consensus}\n`;
      if (lastRound) {
        content += `- Summary: ${lastRound.summary}\n`;
      }
      content += "\n";
    }

    await writeFile(filePath, content, "utf-8");
    return filePath;
  }

  /** Write a combined discussion log for spec mode */
  async writeDiscussionLog(
    outputDir: string,
    stages: StageResult[],
    task: string,
  ): Promise<string> {
    const filePath = join(outputDir, "discussion.md");

    let content = `# 議論ログ: ${task}\n\n`;
    content += `生成日時: ${new Date().toISOString()}\n\n`;

    for (const stage of stages) {
      content += `---\n\n`;
      content += `## ${this.stageTitle(stage.stage)}\n\n`;

      if (stage.rounds.length === 0) {
        content += `_このステージは自動承認されました。_\n\n`;
        continue;
      }

      for (const round of stage.rounds) {
        content += this.formatRound(round);
      }
    }

    await writeFile(filePath, content, "utf-8");
    return filePath;
  }

  private formatRound(round: RoundResult): string {
    let content = `### Round ${round.round}\n\n`;
    content += `Consensus: **${round.consensus}**\n\n`;

    for (const stmt of round.statements) {
      content += `#### 【${stmt.role}】\n`;
      content += `_${stmt.timestamp.toISOString()}_\n\n`;
      content += `${stmt.content}\n\n`;
    }

    return content;
  }

  private stageTitle(stage: PipelineStage): string {
    const titles: Record<string, string> = {
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
    return titles[stage] ?? stage;
  }
}
