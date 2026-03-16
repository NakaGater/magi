import { readFile, readdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { resolve } from "path";
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

  /** Build a context string describing the existing codebase */
  async buildCodebaseContext(workDir: string): Promise<string> {
    const sections: string[] = [];

    // 1. Extract API endpoints from server entry point
    const serverEntry = join(workDir, "packages", "server", "src", "index.ts");
    if (existsSync(serverEntry)) {
      try {
        const serverCode = await readFile(serverEntry, "utf-8");
        const routePattern = /app\.(get|post|put|delete|patch)\s*\(\s*["'`]([^"'`]+)["'`]/g;
        const routes: string[] = [];
        let match;
        while ((match = routePattern.exec(serverCode)) !== null) {
          routes.push(`- ${match[1].toUpperCase()} ${match[2]}`);
        }
        if (routes.length > 0) {
          sections.push(`### 既存APIエンドポイント\n${routes.join("\n")}`);
        }
      } catch {
        // ignore read errors
      }
    }

    // 2. Check config file format
    const configYaml = join(workDir, ".magi", "config.yaml");
    const configJson = join(workDir, ".magi", "config.json");
    if (existsSync(configYaml)) {
      sections.push("### 設定ファイル形式\n- `.magi/config.yaml`（YAML形式）");
    } else if (existsSync(configJson)) {
      sections.push("### 設定ファイル形式\n- `.magi/config.json`（JSON形式）");
    }

    // 3. Identify LLM provider from package.json
    const pkgPath = join(workDir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        const providers: string[] = [];
        if (allDeps["@anthropic-ai/sdk"]) providers.push("Anthropic (Claude)");
        if (allDeps["openai"]) providers.push("OpenAI");
        if (allDeps["@google/generative-ai"]) providers.push("Google Gemini");
        if (providers.length > 0) {
          sections.push(`### LLMプロバイダー\n- ${providers.join(", ")}`);
        }
      } catch {
        // ignore parse errors
      }
    }

    if (sections.length === 0) return "";
    return `## 既存コードベース\n\n${sections.join("\n\n")}`;
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
