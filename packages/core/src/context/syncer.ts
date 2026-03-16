import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import type { LLMProvider } from "../llm/provider.js";
import type { GitManager } from "../git/manager.js";

export interface SyncResult {
  synced: boolean;
  reason: "no_changes" | "first_sync" | "changes_detected" | "error";
  updatedFiles: string[];
  elapsedMs: number;
}

interface SyncState {
  headHash: string;
  contextHashes: Record<string, string>;
  lastSyncedAt: string;
}

/** Mapping of source files → which context files they affect */
const FILE_CONTEXT_MAP: Record<string, string[]> = {
  "packages/server/src/index.ts": ["tech-stack.md", "current-status.md"],
  "packages/core/src/types.ts": ["tech-stack.md"],
  "package.json": ["tech-stack.md"],
  "pnpm-lock.yaml": ["tech-stack.md"],
};

/** Glob-style prefix patterns */
const PREFIX_CONTEXT_MAP: Record<string, string[]> = {
  "packages/web/src/app/": ["design-system.md"],
  "packages/web/src/components/": ["design-system.md"],
};

/** Context files that should never be auto-updated */
const MANUAL_ONLY = new Set(["product.md", "glossary.md"]);

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

function getAffectedContextFiles(changedFiles: string[]): Set<string> {
  const affected = new Set<string>();
  for (const file of changedFiles) {
    // Exact match
    if (FILE_CONTEXT_MAP[file]) {
      for (const ctx of FILE_CONTEXT_MAP[file]) {
        if (!MANUAL_ONLY.has(ctx)) affected.add(ctx);
      }
    }
    // Prefix match
    for (const [prefix, ctxFiles] of Object.entries(PREFIX_CONTEXT_MAP)) {
      if (file.startsWith(prefix)) {
        for (const ctx of ctxFiles) {
          if (!MANUAL_ONLY.has(ctx)) affected.add(ctx);
        }
      }
    }
  }
  return affected;
}

export class ContextSyncer {
  private contextDir: string;
  private workDir: string;
  private llm: LLMProvider;
  private git: GitManager;

  constructor(
    contextDir: string,
    workDir: string,
    llm: LLMProvider,
    git: GitManager,
  ) {
    this.contextDir = contextDir;
    this.workDir = workDir;
    this.llm = llm;
    this.git = git;
  }

  async syncIfNeeded(): Promise<SyncResult> {
    const start = Date.now();
    const stateFile = join(this.contextDir, ".sync-state.json");

    try {
      const currentHash = await this.git.getHeadHashFull();
      if (!currentHash) {
        return { synced: false, reason: "error", updatedFiles: [], elapsedMs: Date.now() - start };
      }

      // Load sync state
      let state: SyncState | null = null;
      if (existsSync(stateFile)) {
        try {
          state = JSON.parse(await readFile(stateFile, "utf-8"));
        } catch {
          state = null;
        }
      }

      // First sync
      if (!state) {
        const result = await this.fullSync(currentHash);
        return { ...result, reason: "first_sync", elapsedMs: Date.now() - start };
      }

      // No changes
      if (state.headHash === currentHash) {
        return { synced: false, reason: "no_changes", updatedFiles: [], elapsedMs: Date.now() - start };
      }

      // Detect changes
      const changedFiles = await this.git.getDiffFiles(state.headHash, currentHash);
      const affectedContextFiles = getAffectedContextFiles(changedFiles);

      if (affectedContextFiles.size === 0) {
        // No relevant changes, just update the hash
        await this.saveSyncState(currentHash, state.contextHashes);
        return { synced: false, reason: "no_changes", updatedFiles: [], elapsedMs: Date.now() - start };
      }

      // Check for manual edits (skip files that were manually edited)
      const toUpdate: string[] = [];
      for (const ctxFile of affectedContextFiles) {
        const ctxPath = join(this.contextDir, ctxFile);
        if (!existsSync(ctxPath)) {
          toUpdate.push(ctxFile);
          continue;
        }
        const currentContent = await readFile(ctxPath, "utf-8");
        const currentCtxHash = sha256(currentContent);
        const recordedHash = state.contextHashes[ctxFile];
        if (recordedHash && recordedHash !== currentCtxHash) {
          // File was manually edited since last sync — skip
          continue;
        }
        toUpdate.push(ctxFile);
      }

      if (toUpdate.length === 0) {
        await this.saveSyncState(currentHash, state.contextHashes);
        return { synced: false, reason: "no_changes", updatedFiles: [], elapsedMs: Date.now() - start };
      }

      // Update context files using LLM
      const updatedFiles: string[] = [];
      const newHashes = { ...state.contextHashes };

      for (const ctxFile of toUpdate) {
        const updated = await this.updateContextFile(ctxFile, changedFiles);
        if (updated) {
          updatedFiles.push(ctxFile);
          newHashes[ctxFile] = sha256(updated);
        }
      }

      await this.saveSyncState(currentHash, newHashes);
      return {
        synced: updatedFiles.length > 0,
        reason: "changes_detected",
        updatedFiles,
        elapsedMs: Date.now() - start,
      };
    } catch {
      return { synced: false, reason: "error", updatedFiles: [], elapsedMs: Date.now() - start };
    }
  }

  private async fullSync(currentHash: string): Promise<Omit<SyncResult, "elapsedMs" | "reason">> {
    // Record current state of all context files
    const hashes: Record<string, string> = {};
    const contextFiles = ["tech-stack.md", "current-status.md", "design-system.md"];

    for (const file of contextFiles) {
      const filePath = join(this.contextDir, file);
      if (existsSync(filePath)) {
        const content = await readFile(filePath, "utf-8");
        hashes[file] = sha256(content);
      }
    }

    await this.saveSyncState(currentHash, hashes);
    return { synced: false, updatedFiles: [] };
  }

  private async updateContextFile(
    ctxFile: string,
    changedFiles: string[],
  ): Promise<string | null> {
    const ctxPath = join(this.contextDir, ctxFile);
    let existingContent = "";
    if (existsSync(ctxPath)) {
      existingContent = await readFile(ctxPath, "utf-8");
    }

    // Read relevant source files for context
    const sourceExcerpts: string[] = [];
    for (const file of changedFiles) {
      const fullPath = join(this.workDir, file);
      if (existsSync(fullPath)) {
        try {
          const content = await readFile(fullPath, "utf-8");
          // Limit to first 200 lines to avoid overloading
          const lines = content.split("\n").slice(0, 200).join("\n");
          sourceExcerpts.push(`### ${file}\n\`\`\`\n${lines}\n\`\`\``);
        } catch {
          continue;
        }
      }
    }

    if (sourceExcerpts.length === 0 && !existingContent) {
      return null;
    }

    const prompt = `以下の情報を元に、プロジェクトのコンテキストファイル「${ctxFile}」を更新してください。

## 現在のコンテキストファイル
${existingContent || "（空）"}

## 変更のあったソースファイル
${sourceExcerpts.join("\n\n")}

## 指示
- 変更のあるセクションのみ更新してください
- 既存の内容を極力維持し、新しい情報を追加・更新してください
- 不確かな情報は追加しないでください
- Markdown形式で出力してください（説明不要、コンテンツのみ）`;

    try {
      const response = await this.llm.chat(
        "あなたはプロジェクトのドキュメント管理者です。ソースコードの変更に基づいてコンテキストファイルを正確に更新してください。",
        [{ role: "user", content: prompt }],
      );

      const newContent = response.content.trim();

      // Safety check: reject if new content is < 60% of original length
      if (existingContent && newContent.length < existingContent.length * 0.6) {
        return null;
      }

      await writeFile(ctxPath, newContent, "utf-8");
      return newContent;
    } catch {
      return null;
    }
  }

  private async saveSyncState(
    headHash: string,
    contextHashes: Record<string, string>,
  ): Promise<void> {
    const stateFile = join(this.contextDir, ".sync-state.json");
    const state: SyncState = {
      headHash,
      contextHashes,
      lastSyncedAt: new Date().toISOString(),
    };
    await writeFile(stateFile, JSON.stringify(state, null, 2), "utf-8");
  }
}
