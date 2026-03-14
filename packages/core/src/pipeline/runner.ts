import type {
  PipelineStage,
  StageResult,
  TaskResult,
  MagiConfig,
  MagiEvent,
  MagiEventHandler,
  Statement,
} from "../types.js";
import type { RoleEngine } from "../roles/engine.js";
import type { GitManager } from "../git/manager.js";
import type { DiscussionLogger } from "../logger/writer.js";

const STAGES: PipelineStage[] = [
  "analysis",
  "design",
  "implement",
  "review",
  "verify",
];

const STAGE_PROMPTS: Record<PipelineStage, string> = {
  analysis:
    "この課題のスコープと影響範囲を分析してください。既存コードとの関連性、リスク、前提条件を明確にしてください。",
  design:
    "分析結果を踏まえて、設計方針を議論してください。アーキテクチャ、データモデル、インターフェース設計について合意を形成してください。",
  implement:
    "合意した設計に基づいて、実装方針を具体的に議論してください。コードの構造、エラー処理、テスト方針を含めてください。",
  review:
    "実装された内容をレビューしてください。バグ、セキュリティ問題、パフォーマンス懸念、コード品質について議論してください。",
  verify:
    "テスト結果を確認し、リリース可否を判断してください。テストカバレッジ、エッジケース、ドキュメントの充実度を評価してください。",
};

export class PipelineRunner {
  private config: MagiConfig;
  private roleEngine: RoleEngine;
  private git: GitManager;
  private logger: DiscussionLogger;
  private eventHandlers: MagiEventHandler[] = [];
  private totalTokens: number = 0;

  constructor(
    config: MagiConfig,
    roleEngine: RoleEngine,
    git: GitManager,
    logger: DiscussionLogger,
  ) {
    this.config = config;
    this.roleEngine = roleEngine;
    this.git = git;
    this.logger = logger;
  }

  /** Register an event handler */
  onEvent(handler: MagiEventHandler): void {
    this.eventHandlers.push(handler);
  }

  private emit(event: Omit<MagiEvent, "timestamp">): void {
    const fullEvent: MagiEvent = { ...event, timestamp: new Date() };
    for (const handler of this.eventHandlers) {
      handler(fullEvent);
    }
  }

  /** Run the full pipeline for a task */
  async run(task: string, taskId: string): Promise<TaskResult> {
    const startedAt = new Date();
    const stages: StageResult[] = [];
    const discussionDir = await this.logger.createDiscussionDir(taskId);

    await this.git.initMagiDir();

    for (let i = 0; i < STAGES.length; i++) {
      const stage = STAGES[i];
      this.emit({ type: "stage_start", stage, data: { task } });

      const stageResult = await this.runStage(stage, task, stages);
      stages.push(stageResult);

      // Write stage log
      const logPath = await this.logger.writeStageLog(
        discussionDir,
        stage,
        i,
        stageResult,
      );

      // Auto-commit discussion log
      const commitHash = await this.git.commit(
        this.stageCommitPrefix(stage),
        `${stage} discussion for: ${task.substring(0, 50)}`,
        [logPath],
      );
      stageResult.commits.push(commitHash);

      this.emit({
        type: "stage_end",
        stage,
        data: { consensus: stageResult.rounds.at(-1)?.consensus },
      });

      // Check for auto-pause conditions
      if (this.shouldPause(stage, stageResult)) {
        this.emit({
          type: "pause",
          stage,
          data: { reason: "auto_pause_triggered" },
        });
        break;
      }
    }

    const completedAt = new Date();
    const result: TaskResult = {
      id: taskId,
      task,
      startedAt,
      completedAt,
      stages,
      totalTokens: this.totalTokens,
      totalCost: this.estimateCost(this.totalTokens),
    };

    // Write metadata and summary
    await this.logger.writeMetadata(discussionDir, result);
    await this.logger.writeSummary(discussionDir, result);

    // Final commit with metadata
    await this.git.commit("docs", `discussion complete: ${task.substring(0, 50)}`, [
      discussionDir,
    ]);

    return result;
  }

  private async runStage(
    stage: PipelineStage,
    task: string,
    previousStages: StageResult[],
  ): Promise<StageResult> {
    const rounds = [];
    const allStatements: Statement[] = [];
    const maxRounds = this.config.pipeline.maxRounds;

    const context = this.buildContext(previousStages);
    const stagePrompt = `${task}\n\n## 現在のフェーズ: ${stage}\n${STAGE_PROMPTS[stage]}`;

    for (let round = 1; round <= maxRounds; round++) {
      this.emit({
        type: "round_start",
        stage,
        data: { round },
      });

      const roundResult = await this.roleEngine.runRound(
        stagePrompt,
        context,
        round,
        allStatements,
      );

      rounds.push(roundResult);
      allStatements.push(...roundResult.statements);

      // Emit each statement
      for (const stmt of roundResult.statements) {
        this.emit({
          type: "statement",
          stage,
          data: {
            role: stmt.role,
            content: stmt.content,
            round,
          },
        });
      }

      this.emit({
        type: "round_end",
        stage,
        data: { round, consensus: roundResult.consensus },
      });

      // If all roles agree, move to next stage
      if (roundResult.consensus === "agreed") {
        break;
      }
    }

    return {
      stage,
      rounds,
      artifacts: [],
      commits: [],
    };
  }

  private buildContext(previousStages: StageResult[]): string {
    if (previousStages.length === 0) return "";

    let context = "## これまでのフェーズの結果\n\n";
    for (const stage of previousStages) {
      const lastRound = stage.rounds[stage.rounds.length - 1];
      context += `### ${stage.stage}\n`;
      context += `合意状況: ${lastRound?.consensus ?? "N/A"}\n`;
      if (lastRound) {
        for (const stmt of lastRound.statements) {
          context += `【${stmt.role}】${stmt.content.substring(0, 200)}\n`;
        }
      }
      context += "\n";
    }
    return context;
  }

  private stageCommitPrefix(stage: PipelineStage): string {
    const prefixes: Record<PipelineStage, string> = {
      analysis: "analysis",
      design: "design",
      implement: "feat",
      review: "fix",
      verify: "test",
    };
    return prefixes[stage];
  }

  private shouldPause(stage: PipelineStage, result: StageResult): boolean {
    if (stage === "design" && this.config.pipeline.pauseAfterDesign) {
      return true;
    }

    const lastRound = result.rounds[result.rounds.length - 1];
    if (!lastRound) return false;

    for (const condition of this.config.pipeline.autoPause) {
      if (
        condition.when === "design_disagreement" &&
        stage === "design" &&
        lastRound.consensus === "disagreed"
      ) {
        return true;
      }
      if (
        condition.when === "security_issue_found" &&
        lastRound.statements.some((s) =>
          s.content.includes("セキュリティ") || s.content.includes("security"),
        )
      ) {
        // Only pause if flagged as a concern
        if (lastRound.statements.some((s) => s.content.includes("⚠️"))) {
          return true;
        }
      }
    }

    return false;
  }

  private estimateCost(tokens: number): number {
    // Rough estimate for Claude Sonnet pricing
    return (tokens / 1_000_000) * 3;
  }
}
