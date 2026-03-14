import { resolve, join } from "path";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import yaml from "js-yaml";
import type { MagiConfig, TaskResult, MagiEventHandler } from "./types.js";
import { DEFAULT_CONFIG } from "./types.js";
import { LLMProvider } from "./llm/provider.js";
import { RoleEngine } from "./roles/engine.js";
import { PipelineRunner } from "./pipeline/runner.js";
import { GitManager } from "./git/manager.js";
import { DiscussionLogger } from "./logger/writer.js";

export class Magi {
  private config: MagiConfig;
  private llm: LLMProvider;
  private roleEngine: RoleEngine;
  private pipeline: PipelineRunner;
  private git: GitManager;
  private logger: DiscussionLogger;
  private eventHandlers: MagiEventHandler[] = [];

  constructor(config: Partial<MagiConfig> = {}, workDir: string = process.cwd()) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.llm = new LLMProvider(this.config.llm.model, this.config.llm.maxTokens);
    this.roleEngine = new RoleEngine(this.llm);
    this.git = new GitManager(workDir);

    const discussionsDir = resolve(workDir, this.config.discussionsDir);
    this.logger = new DiscussionLogger(discussionsDir);

    this.pipeline = new PipelineRunner(
      this.config,
      this.roleEngine,
      this.git,
      this.logger,
    );
  }

  /** Register an event handler for pipeline events */
  onEvent(handler: MagiEventHandler): void {
    this.eventHandlers.push(handler);
    this.pipeline.onEvent(handler);
  }

  /** Initialize Magi for a project */
  async init(rolesDir?: string): Promise<void> {
    const resolvedRolesDir = rolesDir ?? resolve(process.cwd(), this.config.rolesDir);
    await this.roleEngine.loadRoles(this.config.roles, resolvedRolesDir);
    await this.git.initMagiDir();
  }

  /** Run a task through the full pipeline */
  async run(task: string): Promise<TaskResult> {
    const taskId = this.generateTaskId(task);
    return this.pipeline.run(task, taskId);
  }

  /** Get configuration */
  getConfig(): MagiConfig {
    return { ...this.config };
  }

  /** Load config from .magi/config.yaml if present */
  static async loadConfig(workDir: string = process.cwd()): Promise<Partial<MagiConfig>> {
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
