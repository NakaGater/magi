import { readFile } from "fs/promises";
import { mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import type {
  SpecPipelineStage,
  StageResult,
  SpecResult,
  SpecArtifacts,
  MagiConfig,
  MagiEvent,
  MagiEventHandler,
} from "../types.js";
import type { RoleEngine } from "../roles/engine.js";
import type { GitManager } from "../git/manager.js";
import type { DiscussionLogger } from "../logger/writer.js";
import { DiscussionProtocol } from "../discussion/protocol.js";
import { SpecWriter } from "../spec/writer.js";
import { SpecPlanner } from "../spec/planner.js";
import { ContextLoader } from "../context/loader.js";
import { ContextReferenceEngine } from "../context/reference.js";
import { ContextSyncer } from "../context/syncer.js";
import type { LLMProvider } from "../llm/provider.js";

const SPEC_STAGES: SpecPipelineStage[] = [
  "elaborate",
  "specify",
  "decide",
  "plan",
  "sync",
];

const SPEC_STAGE_PROMPTS: Record<SpecPipelineStage, string> = {
  elaborate:
    "この課題の要件を精緻化してください。ビジネス要件、ユーザー要件、技術的制約を明確にし、ユーザーストーリーと受入基準を定義してください。",
  specify:
    "合意した要件から機能仕様書を策定してください。画面仕様、API仕様、データモデル、エラーハンドリングを含めてください。",
  decide:
    "技術選定とアーキテクチャの判断を行ってください。選択した方針の理由と、却下した代替案の理由を明確にしてください。",
  plan:
    "仕様をタスクに分割してください。各タスクに見積り、依存関係、優先度、担当ロールを付与してください。",
  sync:
    "生成された成果物（要件定義、仕様書、ADR、タスクリスト）を確認し、最終的な合意を形成してください。",
};

export class SpecPipeline {
  private config: MagiConfig;
  private roleEngine: RoleEngine;
  private llm: LLMProvider;
  private git: GitManager;
  private logger: DiscussionLogger;
  private discussion: DiscussionProtocol;
  private specWriter: SpecWriter;
  private planner: SpecPlanner;
  private contextLoader: ContextLoader;
  private referenceEngine: ContextReferenceEngine;
  private eventHandlers: MagiEventHandler[] = [];

  constructor(
    config: MagiConfig,
    roleEngine: RoleEngine,
    llm: LLMProvider,
    git: GitManager,
    logger: DiscussionLogger,
  ) {
    this.config = config;
    this.roleEngine = roleEngine;
    this.llm = llm;
    this.git = git;
    this.logger = logger;

    this.discussion = new DiscussionProtocol(roleEngine);
    const emitEvent: import("../types.js").MagiEventHandler = (event) => {
      for (const handler of this.eventHandlers) {
        handler(event);
      }
    };
    this.specWriter = new SpecWriter(llm, emitEvent);
    this.planner = new SpecPlanner(llm, emitEvent);

    const workDir = process.cwd();
    this.contextLoader = new ContextLoader(
      join(workDir, config.contextDir),
    );
    this.referenceEngine = new ContextReferenceEngine(
      join(workDir, config.discussionsDir),
      join(workDir, config.specsDir),
    );
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

  /** Run the full Spec pipeline */
  async run(task: string, taskId: string): Promise<SpecResult> {
    const startedAt = new Date();
    const stages: StageResult[] = [];
    const artifacts: SpecArtifacts = {};

    // Create output directory
    const date = new Date().toISOString().split("T")[0];
    const slug = taskId.replace(/[^a-z0-9\u3000-\u9fff-]/g, "").substring(0, 30);
    const outputDir = join(process.cwd(), this.config.specsDir, `${date}_${slug}`);
    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true });
    }

    // Create discussion dir for logs
    const discussionDir = await this.logger.createDiscussionDir(taskId);

    // Sync context files if code has changed
    const workDir = process.cwd();
    const syncer = new ContextSyncer(
      join(workDir, this.config.contextDir),
      workDir,
      this.llm,
      this.git,
    );
    const syncResult = await syncer.syncIfNeeded();
    if (syncResult.synced) {
      this.emit({
        type: "context_synced",
        mode: "spec",
        data: {
          updatedFiles: syncResult.updatedFiles,
          reason: syncResult.reason,
          elapsedMs: syncResult.elapsedMs,
        },
      });
    }

    // Load context
    const projectContext = await this.contextLoader.buildCombinedContext();
    const referenceContext = await this.referenceEngine.buildReferenceContext(task);
    const codebaseContext = await this.contextLoader.buildCodebaseContext(
      process.cwd(),
    );
    const baseContext = [projectContext, referenceContext, codebaseContext]
      .filter(Boolean)
      .join("\n\n");

    // Track artifacts content for accumulating context
    let requirementsContent = "";
    let specContent = "";
    const adrContents: string[] = [];
    let discussionAccumulator = "";

    for (let i = 0; i < SPEC_STAGES.length; i++) {
      const stage = SPEC_STAGES[i];

      // Skip sync for now (gate handling)
      if (stage === "sync") {
        const syncResult = await this.runSyncStage(
          task,
          outputDir,
          discussionDir,
          stages,
          artifacts,
        );
        stages.push(syncResult);
        continue;
      }

      this.emit({
        type: "stage_start",
        stage,
        mode: "spec",
        data: { task },
      });

      // Build stage-specific context
      let stageContext = baseContext;
      if (requirementsContent) {
        stageContext += `\n\n## 合意済み要件\n${requirementsContent}`;
      }
      if (specContent) {
        stageContext += `\n\n## 合意済み仕様\n${specContent}`;
      }
      if (adrContents.length > 0) {
        stageContext += `\n\n## 合意済みADR\n${adrContents.join("\n\n---\n\n")}`;
      }

      const stagePrompt = `${task}\n\n## 現在のフェーズ: ${stage}\n${SPEC_STAGE_PROMPTS[stage]}`;

      // Run discussion
      const discussionResult = await this.discussion.discuss({
        topic: stagePrompt,
        context: stageContext,
        stage,
        maxRounds: this.config.pipeline.maxRounds,
      });

      const stageDiscussion = this.discussion.extractKeyPoints(
        discussionResult.allStatements,
      );
      discussionAccumulator += `\n\n### ${stage}\n${stageDiscussion}`;

      // Generate artifacts based on stage
      const artifactPaths: string[] = [];

      if (stage === "elaborate") {
        const reqPath = await this.specWriter.writeRequirements(
          outputDir,
          task,
          stageDiscussion,
        );
        artifactPaths.push(reqPath);
        requirementsContent = await readFile(reqPath, "utf-8");
        artifacts.requirements = requirementsContent;

        this.emit({
          type: "artifact",
          stage,
          mode: "spec",
          data: { type: "requirements", path: reqPath },
        });
      }

      if (stage === "specify") {
        const specPath = await this.specWriter.writeSpec(
          outputDir,
          task,
          stageDiscussion,
          requirementsContent,
        );
        artifactPaths.push(specPath);
        specContent = await readFile(specPath, "utf-8");
        artifacts.spec = specContent;

        this.emit({
          type: "artifact",
          stage,
          mode: "spec",
          data: { type: "spec", path: specPath },
        });

        // Generate Mermaid diagram
        const mermaidPath = await this.specWriter.writeMermaid(
          outputDir,
          task,
          specContent,
        );
        if (mermaidPath) {
          artifactPaths.push(mermaidPath);
          artifacts.mermaid = await readFile(mermaidPath, "utf-8");

          this.emit({
            type: "artifact",
            stage,
            mode: "spec",
            data: { type: "mermaid", path: mermaidPath },
          });
        }
      }

      if (stage === "decide") {
        const adrPaths = await this.specWriter.writeADR(
          outputDir,
          1,
          stageDiscussion,
        );
        artifactPaths.push(...adrPaths);

        for (const adrPath of adrPaths) {
          const adrContent = await readFile(adrPath, "utf-8");
          adrContents.push(adrContent);
        }
        artifacts.adrs = adrContents;

        this.emit({
          type: "artifact",
          stage,
          mode: "spec",
          data: { type: "adrs", paths: adrPaths },
        });
      }

      if (stage === "plan") {
        const tasksPath = await this.planner.writeTasks(
          outputDir,
          task,
          requirementsContent,
          specContent,
          adrContents,
          stageDiscussion,
        );
        artifactPaths.push(tasksPath);
        artifacts.tasks = await readFile(tasksPath, "utf-8");

        this.emit({
          type: "artifact",
          stage,
          mode: "spec",
          data: { type: "tasks", path: tasksPath },
        });

        // Reconciliation: re-generate artifacts with full discussion context
        const reconciledReqPath = await this.specWriter.writeRequirements(
          outputDir,
          task,
          discussionAccumulator,
          adrContents,
        );
        requirementsContent = await readFile(reconciledReqPath, "utf-8");
        artifacts.requirements = requirementsContent;

        const reconciledSpecPath = await this.specWriter.writeSpec(
          outputDir,
          task,
          discussionAccumulator,
          requirementsContent,
          adrContents,
        );
        specContent = await readFile(reconciledSpecPath, "utf-8");
        artifacts.spec = specContent;

        const reconciledMermaidPath = await this.specWriter.writeMermaid(
          outputDir,
          task,
          specContent,
          adrContents,
        );
        if (reconciledMermaidPath) {
          artifacts.mermaid = await readFile(reconciledMermaidPath, "utf-8");
          artifactPaths.push(reconciledMermaidPath);
        }

        this.emit({
          type: "artifact",
          stage,
          mode: "spec",
          data: {
            type: "reconciled",
            paths: [reconciledReqPath, reconciledSpecPath],
          },
        });
      }

      // Write stage log
      const stageResult: StageResult = {
        stage,
        rounds: discussionResult.rounds,
        artifacts: artifactPaths,
        commits: [],
      };

      const logPath = await this.logger.writeStageLog(
        discussionDir,
        stage,
        i,
        stageResult,
      );

      // Auto-commit
      const commitFiles = [logPath, ...artifactPaths];
      const commitHash = await this.git.commit(
        "spec",
        `${stage}: ${task.substring(0, 50)}`,
        commitFiles,
      );
      if (commitHash) {
        stageResult.commits.push(commitHash);
        this.emit({
          type: "commit",
          stage,
          mode: "spec",
          data: { hash: commitHash, message: `${stage}: ${task.substring(0, 50)}` },
        });
      }

      stages.push(stageResult);

      this.emit({
        type: "stage_end",
        stage,
        mode: "spec",
        data: { consensus: discussionResult.finalConsensus },
      });
    }

    // Write combined discussion log
    await this.logger.writeDiscussionLog(outputDir, stages, task);

    const completedAt = new Date();
    const result: SpecResult = {
      id: taskId,
      task,
      startedAt,
      completedAt,
      stages,
      artifacts,
      outputDir,
      totalTokens: 0,
      totalCost: 0,
    };

    // Write metadata and summary
    await this.logger.writeMetadata(discussionDir, result);
    await this.logger.writeSummary(discussionDir, result);

    // Final commit
    await this.git.commit("spec", `complete: ${task.substring(0, 50)}`, [
      discussionDir,
      outputDir,
    ]);

    return result;
  }

  private async runSyncStage(
    task: string,
    outputDir: string,
    discussionDir: string,
    previousStages: StageResult[],
    artifacts: SpecArtifacts,
  ): Promise<StageResult> {
    const stage: SpecPipelineStage = "sync";

    this.emit({
      type: "stage_start",
      stage,
      mode: "spec",
      data: { task },
    });

    // Gate: emit gate event for human approval
    if (this.config.pipeline.gates.specBeforeSync) {
      this.emit({
        type: "gate",
        stage,
        mode: "spec",
        data: {
          message: "成果物の確認を待っています。承認してください。",
          outputDir,
          artifacts: {
            requirements: !!artifacts.requirements,
            spec: !!artifacts.spec,
            adrs: artifacts.adrs?.length ?? 0,
            tasks: !!artifacts.tasks,
            mermaid: !!artifacts.mermaid,
          },
        },
      });
    }

    // In CLI mode, we auto-approve for now (gate is informational)
    // In server mode, this would wait for approval

    this.emit({
      type: "stage_end",
      stage,
      mode: "spec",
      data: { consensus: "agreed", autoApproved: true },
    });

    return {
      stage,
      rounds: [],
      artifacts: [],
      commits: [],
    };
  }
}
