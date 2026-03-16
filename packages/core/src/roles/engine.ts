import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join, resolve } from "path";
import yaml from "js-yaml";
import type { RoleDefinition, Statement, RoundResult, ConsensusStatus } from "../types.js";
import type { LLMProvider, LLMMessage } from "../llm/provider.js";
import { normalizeStatement } from "../spec/validator.js";

export class RoleEngine {
  private roles: Map<string, RoleDefinition> = new Map();
  private llm: LLMProvider;

  constructor(llm: LLMProvider) {
    this.llm = llm;
  }

  /** Load roles from a directory of YAML files */
  async loadRoles(roleNames: string[], rolesDir: string): Promise<void> {
    const resolvedDir = resolve(rolesDir);

    for (const name of roleNames) {
      const filePath = join(resolvedDir, `${name}.yaml`);
      if (!existsSync(filePath)) {
        throw new Error(`Role definition not found: ${filePath}`);
      }

      const content = await readFile(filePath, "utf-8");
      const role = yaml.load(content) as RoleDefinition;
      this.roles.set(name, role);
    }
  }

  /** Get a loaded role definition */
  getRole(name: string): RoleDefinition | undefined {
    return this.roles.get(name);
  }

  /** Get all loaded role names */
  getRoleNames(): string[] {
    return Array.from(this.roles.keys());
  }

  /** Get all loaded role definitions */
  getRoles(): RoleDefinition[] {
    return Array.from(this.roles.values());
  }

  /** Run a discussion round where each role responds to the topic */
  async runRound(
    topic: string,
    context: string,
    roundNumber: number,
    previousStatements: Statement[],
  ): Promise<RoundResult> {
    const statements: Statement[] = [];

    for (const [, role] of this.roles) {
      const messages = this.buildMessages(
        topic,
        context,
        roundNumber,
        previousStatements,
        statements,
      );

      const response = await this.llm.chat(role.system_prompt, messages);

      statements.push({
        role: role.name,
        content: normalizeStatement(role.name, response.content),
        timestamp: new Date(),
        round: roundNumber,
      });
    }

    const consensus = this.evaluateConsensus(statements);
    const summary = this.summarizeRound(statements);

    return {
      round: roundNumber,
      statements,
      consensus,
      summary,
    };
  }

  private buildMessages(
    topic: string,
    context: string,
    roundNumber: number,
    previousStatements: Statement[],
    currentStatements: Statement[],
  ): LLMMessage[] {
    const messages: LLMMessage[] = [];

    let userContent = `# 議題\n${topic}\n`;
    if (context) {
      userContent += `\n# コンテキスト\n${context}\n`;
    }
    userContent += `\n# ラウンド ${roundNumber}\n`;

    if (previousStatements.length > 0) {
      userContent += "\n## これまでの議論\n";
      for (const stmt of previousStatements) {
        userContent += `\n【${stmt.role}】${stmt.content}\n`;
      }
    }

    if (currentStatements.length > 0) {
      userContent += "\n## このラウンドの発言\n";
      for (const stmt of currentStatements) {
        userContent += `\n【${stmt.role}】${stmt.content}\n`;
      }
    }

    if (roundNumber > 1) {
      userContent +=
        "\n上記の議論を踏まえて、あなたの視点から意見を述べてください。合意できる場合は明確に表明してください。";
    } else {
      userContent +=
        "\nこの議題について、あなたの視点から意見を述べてください。";
    }

    messages.push({ role: "user", content: userContent });

    return messages;
  }

  /** Evaluate consensus by checking for agreement markers */
  evaluateConsensus(statements: Statement[]): ConsensusStatus {
    let agreeCount = 0;
    for (const s of statements) {
      if (/❌\s*却下/.test(s.content)) continue;
      if (/⚠️\s*懸念/.test(s.content) && !/✅\s*合意/.test(s.content)) continue;
      if (/✅\s*合意/.test(s.content)) agreeCount++;
    }

    if (agreeCount === statements.length) return "agreed";
    if (agreeCount > 0) return "partial";
    return "disagreed";
  }

  /** Create a brief summary of the round */
  private summarizeRound(statements: Statement[]): string {
    return statements
      .map((s) => {
        const firstLine = s.content.split("\n")[0];
        return `${s.role}: ${firstLine}`;
      })
      .join(" | ");
  }
}
