import { readFile, readdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import type { ContextFile } from "../types.js";

/** Default mapping of context files to roles */
const ROLE_CONTEXT_MAP: Record<string, string[]> = {
  pm: ["product.md", "competitors.md", "glossary.md"],
  pd: ["product.md", "design-system.md", "glossary.md"],
  dev: ["tech-stack.md", "glossary.md"],
};

export class ContextLoader {
  private contextDir: string;

  constructor(contextDir: string) {
    this.contextDir = contextDir;
  }

  /** Load all context files from .magi/context/ */
  async loadAll(): Promise<ContextFile[]> {
    if (!existsSync(this.contextDir)) {
      return [];
    }

    const files = await readdir(this.contextDir);
    const mdFiles = files.filter((f) => f.endsWith(".md"));
    const results: ContextFile[] = [];

    for (const filename of mdFiles) {
      const filePath = join(this.contextDir, filename);
      const content = await readFile(filePath, "utf-8");
      const relevantRoles = this.getRolesForFile(filename);

      results.push({
        path: filePath,
        content,
        relevantRoles,
      });
    }

    return results;
  }

  /** Load context files relevant to a specific role */
  async loadForRole(roleName: string): Promise<ContextFile[]> {
    const all = await this.loadAll();
    const lowerRole = roleName.toLowerCase();
    return all.filter(
      (f) =>
        f.relevantRoles.length === 0 ||
        f.relevantRoles.includes(lowerRole),
    );
  }

  /** Build a context string for a specific role */
  async buildContextForRole(roleName: string): Promise<string> {
    const files = await this.loadForRole(roleName);
    if (files.length === 0) return "";

    let context = "## プロジェクトコンテキスト\n\n";
    for (const file of files) {
      const filename = file.path.split("/").pop() ?? "";
      context += `### ${filename}\n\n${file.content}\n\n`;
    }
    return context;
  }

  /** Build a combined context string for all roles */
  async buildCombinedContext(): Promise<string> {
    const files = await this.loadAll();
    if (files.length === 0) return "";

    let context = "## プロジェクトコンテキスト\n\n";
    for (const file of files) {
      const filename = file.path.split("/").pop() ?? "";
      context += `### ${filename}\n\n${file.content}\n\n`;
    }
    return context;
  }

  private getRolesForFile(filename: string): string[] {
    const roles: string[] = [];
    for (const [role, files] of Object.entries(ROLE_CONTEXT_MAP)) {
      if (files.includes(filename)) {
        roles.push(role);
      }
    }
    // If no specific mapping, it's relevant to all roles
    return roles;
  }
}
