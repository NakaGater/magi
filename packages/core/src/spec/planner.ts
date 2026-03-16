import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import type { LLMProvider, LLMMessage } from "../llm/provider.js";
import type { MagiEventHandler } from "../types.js";
import { normalizeYaml, validateTasks, withRetry } from "./validator.js";

export class SpecPlanner {
  private llm: LLMProvider;
  private eventHandler?: MagiEventHandler;

  constructor(llm: LLMProvider, eventHandler?: MagiEventHandler) {
    this.llm = llm;
    this.eventHandler = eventHandler;
  }

  /** Generate tasks.yaml from spec, requirements, and ADRs */
  async writeTasks(
    outputDir: string,
    task: string,
    requirements: string,
    spec: string,
    adrs: string[],
    discussionContent: string,
  ): Promise<string> {
    const filePath = join(outputDir, "tasks.yaml");

    const adrContent = adrs.length > 0
      ? adrs.join("\n\n---\n\n")
      : "（ADRなし）";

    const prompt = `以下の要件・仕様・設計判断に基づいて、タスクリスト（tasks.yaml）を生成してください。

## 課題
${task}

## 要件
${requirements}

## 仕様
${spec}

## ADR（設計判断）
${adrContent}

## 議論内容
${discussionContent}

## 出力形式（YAMLのみ、説明不要）:

tasks:
  - id: T-001
    title: "[タスクタイトル]"
    description: "[詳細説明]"
    story_ref: "US-1"  # 対応するユーザーストーリー
    assignee: "Dev"    # PM, PD, or Dev
    priority: high     # high, medium, low
    estimate: "2h"     # 見積り時間
    depends_on: []     # 依存タスクID
    acceptance_criteria:
      - "[受入基準1]"
      - "[受入基準2]"

  - id: T-002
    title: "[タスクタイトル]"
    ...

## ルール
- タスクは実装可能な粒度に分割する（1タスク = 1-4時間目安）
- 依存関係を明確にする
- ユーザーストーリーへのトレーサビリティを保つ
- 優先度と見積りを付ける`;

    const systemPrompt =
      "あなたはプロジェクト計画の専門家です。仕様を実装可能なタスクに分割してください。";
    const messages: LLMMessage[] = [{ role: "user", content: prompt }];

    const content = await withRetry(
      this.llm,
      systemPrompt,
      messages,
      normalizeYaml,
      validateTasks,
      this.eventHandler,
    );

    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true });
    }

    await writeFile(filePath, content, "utf-8");
    return filePath;
  }
}
