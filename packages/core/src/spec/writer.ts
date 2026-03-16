import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import type { LLMProvider, LLMMessage } from "../llm/provider.js";

export class SpecWriter {
  private llm: LLMProvider;

  constructor(llm: LLMProvider) {
    this.llm = llm;
  }

  /** Generate requirements.md from elaboration discussion */
  async writeRequirements(
    outputDir: string,
    task: string,
    discussionContent: string,
  ): Promise<string> {
    const filePath = join(outputDir, "requirements.md");

    const prompt = `以下の議論に基づいて、要件定義書（requirements.md）を生成してください。

## 課題
${task}

## 議論内容
${discussionContent}

## 出力形式
以下のフォーマットで出力してください（Markdownのみ、説明不要）:

# 要件定義: [課題名]

## 概要
[1-2文の概要]

## ユーザーストーリー
- US-1: [ストーリー] / 受入基準: [基準]
- US-2: ...

## 機能要件
- FR-1: [要件]
- FR-2: ...

## 非機能要件
- NFR-1: [要件]
- NFR-2: ...

## スコープ外
- [除外項目]

## 前提条件
- [前提]`;

    const response = await this.llm.chat(
      "あなたは要件定義の専門家です。議論の内容を正確に要件定義書にまとめてください。",
      [{ role: "user", content: prompt }],
    );

    await this.ensureDir(outputDir);
    await writeFile(filePath, response.content, "utf-8");
    return filePath;
  }

  /** Generate spec.md from specification discussion */
  async writeSpec(
    outputDir: string,
    task: string,
    discussionContent: string,
    requirements: string,
  ): Promise<string> {
    const filePath = join(outputDir, "spec.md");

    const prompt = `以下の議論と要件に基づいて、機能仕様書（spec.md）を生成してください。

## 課題
${task}

## 要件
${requirements}

## 議論内容
${discussionContent}

## 出力形式
以下のフォーマットで出力してください（Markdownのみ、説明不要）:

# 機能仕様書: [課題名]

## 概要
[概要説明]

## 画面仕様
### [画面名]
- 目的: [目的]
- 構成要素: [要素]
- 振る舞い: [振る舞い]

## API仕様
### [エンドポイント]
- メソッド: [GET/POST/...]
- リクエスト: [パラメータ]
- レスポンス: [レスポンス]

## データモデル
[テーブル/モデル定義]

## エラーハンドリング
[エラーケースと対応]

## セキュリティ考慮
[セキュリティ要件]`;

    const response = await this.llm.chat(
      "あなたは機能仕様書の専門家です。議論と要件の内容を正確に仕様書にまとめてください。",
      [{ role: "user", content: prompt }],
    );

    await this.ensureDir(outputDir);
    await writeFile(filePath, response.content, "utf-8");
    return filePath;
  }

  /** Generate ADR (Architecture Decision Record) from design decisions */
  async writeADR(
    outputDir: string,
    adrNumber: number,
    discussionContent: string,
  ): Promise<string[]> {
    const prompt = `以下の設計議論に基づいて、ADR（Architecture Decision Record）を生成してください。

## 議論内容
${discussionContent}

## 指示
議論から重要な設計判断を抽出し、それぞれをADRとして出力してください。
複数の判断がある場合は、---（3つのハイフン）で区切ってください。

## 各ADRのフォーマット（Markdownのみ、説明不要）:

# ADR-[番号]: [タイトル]

## ステータス
承認済み

## コンテキスト
[この判断が必要になった背景]

## 決定
[採用した方針]

## 理由
[なぜこの方針を選んだか]

## 却下した代替案
- [代替案1]: [却下理由]
- [代替案2]: [却下理由]

## 影響
[この決定がもたらす影響]`;

    const response = await this.llm.chat(
      "あなたはソフトウェアアーキテクトです。設計判断を正確にADRとして記録してください。",
      [{ role: "user", content: prompt }],
    );

    // Split multiple ADRs
    const adrTexts = response.content
      .split(/^---$/m)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const filePaths: string[] = [];
    await this.ensureDir(outputDir);

    for (let i = 0; i < adrTexts.length; i++) {
      const num = String(adrNumber + i).padStart(3, "0");
      // Extract title slug from ADR content
      const titleMatch = adrTexts[i].match(/^#\s+ADR-\d+:\s*(.+)$/m);
      const slug = titleMatch
        ? titleMatch[1]
            .toLowerCase()
            .replace(/[^a-z0-9\u3000-\u9fff]+/g, "-")
            .substring(0, 30)
            .replace(/-+$/, "")
        : `decision-${num}`;

      const filename = `adr-${num}-${slug}.md`;
      const filePath = join(outputDir, filename);
      await writeFile(filePath, adrTexts[i], "utf-8");
      filePaths.push(filePath);
    }

    return filePaths;
  }

  /** Generate a Mermaid flow diagram from spec discussion */
  async writeMermaid(
    outputDir: string,
    task: string,
    specContent: string,
  ): Promise<string | null> {
    const prompt = `以下の仕様に基づいて、ユーザーフローまたは画面遷移のMermaidダイアグラムを生成してください。

## 課題
${task}

## 仕様
${specContent}

## 指示
- UI/UXに関する仕様がある場合のみMermaid図を生成してください
- UI/UX仕様がない場合は「NO_DIAGRAM」とだけ出力してください
- Mermaidコードのみを出力してください（コードフェンスなし）

例:
graph TD
    A[画面A] --> B[画面B]
    B --> C{条件}
    C -->|Yes| D[画面C]
    C -->|No| E[画面D]`;

    const response = await this.llm.chat(
      "あなたはUXデザイナーです。仕様からフロー図を生成してください。",
      [{ role: "user", content: prompt }],
    );

    if (response.content.trim() === "NO_DIAGRAM") {
      return null;
    }

    const filePath = join(outputDir, "flow.mermaid");
    await this.ensureDir(outputDir);
    await writeFile(filePath, response.content.trim(), "utf-8");
    return filePath;
  }

  private async ensureDir(dir: string): Promise<void> {
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }
}
