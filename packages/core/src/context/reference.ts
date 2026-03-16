import { readFile, readdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import type { ContextReference } from "../types.js";

export class ContextReferenceEngine {
  private discussionsDir: string;
  private specsDir: string;

  constructor(discussionsDir: string, specsDir: string) {
    this.discussionsDir = discussionsDir;
    this.specsDir = specsDir;
  }

  /** Find past discussions and specs related to a task description */
  async findRelated(
    taskDescription: string,
    maxResults: number = 5,
  ): Promise<ContextReference[]> {
    const keywords = this.extractKeywords(taskDescription);
    if (keywords.length === 0) return [];

    const references: ContextReference[] = [];

    // Scan discussions
    const discussionRefs = await this.scanDirectory(
      this.discussionsDir,
      keywords,
    );
    references.push(...discussionRefs);

    // Scan specs
    const specRefs = await this.scanDirectory(this.specsDir, keywords);
    references.push(...specRefs);

    // Sort by relevance and return top results
    references.sort((a, b) => b.relevance - a.relevance);
    return references.slice(0, maxResults);
  }

  /** Build a context string from related references */
  async buildReferenceContext(taskDescription: string): Promise<string> {
    const refs = await this.findRelated(taskDescription);
    if (refs.length === 0) return "";

    let context = "## 関連する過去の議論・仕様\n\n";
    for (const ref of refs) {
      context += `### ${ref.title}\n`;
      context += `_Source: ${ref.path}_\n\n`;
      context += `${ref.excerpt}\n\n`;
    }
    return context;
  }

  private async scanDirectory(
    dir: string,
    keywords: string[],
  ): Promise<ContextReference[]> {
    if (!existsSync(dir)) return [];

    const results: ContextReference[] = [];
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        // Scan markdown files inside subdirectories
        const subRefs = await this.scanSubDirectory(entryPath, keywords);
        results.push(...subRefs);
      } else if (entry.name.endsWith(".md")) {
        const ref = await this.scoreFile(entryPath, keywords);
        if (ref) results.push(ref);
      }
    }

    return results;
  }

  private async scanSubDirectory(
    dir: string,
    keywords: string[],
  ): Promise<ContextReference[]> {
    const results: ContextReference[] = [];
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        const filePath = join(dir, entry.name);
        const ref = await this.scoreFile(filePath, keywords);
        if (ref) results.push(ref);
      }
    }

    return results;
  }

  private async scoreFile(
    filePath: string,
    keywords: string[],
  ): Promise<ContextReference | null> {
    const content = await readFile(filePath, "utf-8");
    const lowerContent = content.toLowerCase();

    let matchCount = 0;
    for (const keyword of keywords) {
      const regex = new RegExp(keyword.toLowerCase(), "g");
      const matches = lowerContent.match(regex);
      if (matches) {
        matchCount += matches.length;
      }
    }

    if (matchCount === 0) return null;

    // Extract title from first heading or filename
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch
      ? titleMatch[1]
      : filePath.split("/").pop() ?? filePath;

    // Extract a relevant excerpt (first 300 chars after a keyword match)
    const excerpt = this.extractExcerpt(content, keywords);

    return {
      path: filePath,
      title,
      excerpt,
      relevance: matchCount / keywords.length,
    };
  }

  private extractExcerpt(content: string, keywords: string[]): string {
    const lowerContent = content.toLowerCase();

    for (const keyword of keywords) {
      const idx = lowerContent.indexOf(keyword.toLowerCase());
      if (idx !== -1) {
        const start = Math.max(0, idx - 50);
        const end = Math.min(content.length, idx + 250);
        let excerpt = content.substring(start, end).trim();
        if (start > 0) excerpt = "..." + excerpt;
        if (end < content.length) excerpt += "...";
        return excerpt;
      }
    }

    // Fallback: first 300 chars
    return content.substring(0, 300).trim() + (content.length > 300 ? "..." : "");
  }

  /** Extract meaningful keywords from a task description */
  private extractKeywords(text: string): string[] {
    // Remove common Japanese particles and short words
    const stopWords = new Set([
      "の", "に", "は", "を", "が", "で", "と", "も", "や", "へ",
      "から", "まで", "より", "する", "した", "して", "したい",
      "ある", "いる", "できる", "なる", "ない",
      "この", "その", "あの", "これ", "それ", "あれ",
      "the", "a", "an", "is", "are", "was", "were", "be",
      "to", "of", "in", "for", "on", "with", "at", "by",
      "and", "or", "but", "not", "no", "if", "then",
    ]);

    // Split on whitespace and common delimiters
    const words = text
      .split(/[\s、。,.\-_/\\]+/)
      .filter((w) => w.length >= 2)
      .filter((w) => !stopWords.has(w));

    return [...new Set(words)];
  }
}
