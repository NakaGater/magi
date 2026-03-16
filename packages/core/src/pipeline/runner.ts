import type {
  BuildPipelineStage,
  StageResult,
  TaskResult,
  MagiConfig,
  MagiEvent,
  MagiEventHandler,
} from "../types.js";
import type { RoleEngine } from "../roles/engine.js";
import type { GitManager } from "../git/manager.js";
import type { DiscussionLogger } from "../logger/writer.js";
import { DiscussionProtocol } from "../discussion/protocol.js";

const BUILD_STAGES: BuildPipelineStage[] = [
  "analysis",
  "design",
  "implement",
  "review",
  "verify",
];

const BUILD_STAGE_PROMPTS: Record<BuildPipelineStage, string> = {
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
  private discussion: DiscussionProtocol;
  private eventHandlers: MagiEventHandler[] = [];

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
    this.discussion = new DiscussionProtocol(roleEngine);
  }

  onEvent(handler: MagiEventHandler): void {
    this.eventHandlers.push(handler);
    this.discussion.onEvent(handler);
  }

  /** Forward a user message to the active discussion */
  injectMessage(message: string): void {
    this.discussion.injectMessage(message);
  }

  private emit(event: Omit<MagiEvent, "timestamp">): void {
    const fullEvent: MagiEvent = { ...event, timestamp: new Date() };
    for (const handler of this.eventHandlers) {
      handler(fullEvent);
    }
  }

  /** Run the full Build pipeline for a task */
  async run(task: string, taskId: string): Promise<TaskResult> {
    const startedAt = new Date();
    const stages: StageResult[] = [];
    const discussionDir = await this.logger.createDiscussionDir(taskId);

    await this.git.initMagiDir();

    for (let i = 0; i < BUILD_STAGES.length; i++) {
      const stage = BUILD_STAGES[i];
      this.emit({ type: "stage_start", stage, mode: "build", data: { task } });

      const context = this.buildContext(stages);
      const stagePrompt = `${task}\n\n## 現在のフェーズ: ${stage}\n${BUILD_STAGE_PROMPTS[stage]}`;

      const discussionResult = await this.discussion.discuss({
        topic: stagePrompt,
        context,
        stage,
        maxRounds: this.config.pipeline.maxRounds,
      });

      const stageResult: StageResult = {
        stage,
        rounds: discussionResult.rounds,
        artifacts: [],
        commits: [],
      };

      // Write stage log
      const logPath = await this.logger.writeStageLog(
        discussionDir,
        stage,
        i,
        stageResult,
      );

      // Auto-commit
      const commitHash = await this.git.commit(
        this.stageCommitPrefix(stage),
        `${stage} discussion for: ${task.substring(0, 50)}`,
        [logPath],
      );
      if (commitHash) {
        stageResult.commits.push(commitHash);
      }

      stages.push(stageResult);

      this.emit({
        type: "stage_end",
        stage,
        mode: "build",
        data: { consensus: discussionResult.finalConsensus },
      });

      // Check for auto-pause
      if (this.shouldPause(stage, stageResult)) {
        this.emit({
          type: "pause",
          stage,
          mode: "build",
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
      totalTokens: 0,
      totalCost: 0,
    };

    await this.logger.writeMetadata(discussionDir, result);
    await this.logger.writeSummary(discussionDir, result);

    await this.git.commit("docs", `discussion complete: ${task.substring(0, 50)}`, [
      discussionDir,
    ]);

    return result;
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

  private stageCommitPrefix(stage: BuildPipelineStage): string {
    const prefixes: Record<BuildPipelineStage, string> = {
      analysis: "analysis",
      design: "design",
      implement: "feat",
      review: "fix",
      verify: "test",
    };
    return prefixes[stage];
  }

  private shouldPause(stage: BuildPipelineStage, result: StageResult): boolean {
    if (
      stage === "design" &&
      this.config.pipeline.gates.buildBeforeImplement
    ) {
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
    }

    return false;
  }
}
