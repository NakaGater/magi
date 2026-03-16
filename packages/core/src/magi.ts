import { resolve, join } from "path";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import yaml from "js-yaml";
import type {
  MagiConfig,
  TaskResult,
  SpecResult,
  MagiEventHandler,
} from "./types.js";
import { DEFAULT_CONFIG } from "./types.js";
import { LLMProvider } from "./llm/provider.js";
import { RoleEngine } from "./roles/engine.js";
import { PipelineRunner } from "./pipeline/runner.js";
import { SpecPipeline } from "./pipeline/spec.js";
import { GitManager } from "./git/manager.js";
import { DiscussionLogger } from "./logger/writer.js";

export class Magi {
  private config: MagiConfig;
  private llm: LLMProvider;
  private roleEngine: RoleEngine;
  private buildPipeline: PipelineRunner;
  private specPipeline: SpecPipeline;
  private git: GitManager;
  private logger: DiscussionLogger;
  private eventHandlers: MagiEventHandler[] = [];
  private activePipeline: SpecPipeline | PipelineRunner | null = null;

  constructor(
    config: Partial<MagiConfig> = {},
    workDir: string = process.cwd(),
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.llm = new LLMProvider(
      this.config.llm.model,
      this.config.llm.maxTokens,
    );
    this.roleEngine = new RoleEngine(this.llm);
    this.git = new GitManager(workDir);

    const discussionsDir = resolve(workDir, this.config.discussionsDir);
    this.logger = new DiscussionLogger(discussionsDir);

    this.buildPipeline = new PipelineRunner(
      this.config,
      this.roleEngine,
      this.git,
      this.logger,
    );

    this.specPipeline = new SpecPipeline(
      this.config,
      this.roleEngine,
      this.llm,
      this.git,
      this.logger,
    );
  }

  /** Register an event handler for pipeline events */
  onEvent(handler: MagiEventHandler): void {
    this.eventHandlers.push(handler);
    this.buildPipeline.onEvent(handler);
    this.specPipeline.onEvent(handler);
  }

  /** Initialize Magi for a project */
  async init(rolesDir?: string): Promise<void> {
    const resolvedRolesDir =
      rolesDir ?? resolve(process.cwd(), this.config.rolesDir);
    await this.roleEngine.loadRoles(this.config.roles, resolvedRolesDir);
    await this.git.initMagiDir();
  }

  /** Run Spec mode: discuss → generate spec artifacts */
  async spec(task: string): Promise<SpecResult> {
    const taskId = this.generateTaskId(task);
    this.activePipeline = this.specPipeline;
    try {
      return await this.specPipeline.run(task, taskId);
    } finally {
      this.activePipeline = null;
    }
  }

  /** Run Build mode: discuss → implement → review → verify */
  async build(task: string): Promise<TaskResult> {
    const taskId = this.generateTaskId(task);
    this.activePipeline = this.buildPipeline;
    try {
      return await this.buildPipeline.run(task, taskId);
    } finally {
      this.activePipeline = null;
    }
  }

  /** Inject a user message into the active discussion */
  injectMessage(message: string): void {
    if (!this.activePipeline) {
      throw new Error("No active pipeline to inject message into");
    }
    this.activePipeline.injectMessage(message);
  }

  /** Get configuration */
  getConfig(): MagiConfig {
    return { ...this.config };
  }

  /** Load config from .magi/config.yaml if present */
  static async loadConfig(
    workDir: string = process.cwd(),
  ): Promise<Partial<MagiConfig>> {
    const configPath = join(workDir, ".magi", "config.yaml");
    if (!existsSync(configPath)) {
      return {};
    }

    const content = await readFile(configPath, "utf-8");
    return yaml.load(content) as Partial<MagiConfig>;
  }

  private generateTaskId(task: string): string {
    const slug = task
      .toLowerCase()
      .replace(/[^a-z0-9\u3000-\u9fff]+/g, "-")
      .substring(0, 30)
      .replace(/-+$/, "");
    const ts = Date.now().toString(36);
    return `${slug}-${ts}`;
  }
}
