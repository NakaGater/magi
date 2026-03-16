import yaml from "js-yaml";
import type { LLMProvider, LLMMessage } from "../llm/provider.js";
import type { MagiEventHandler } from "../types.js";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// --- Validators ---

export function validateRequirements(content: string): ValidationResult {
  const errors: string[] = [];
  const required = ["## 概要", "## ユーザーストーリー", "## 機能要件", "## 非機能要件", "## スコープ外"];
  for (const section of required) {
    if (!content.includes(section)) {
      errors.push(`必須セクション「${section}」が見つかりません`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function validateSpec(content: string): ValidationResult {
  const errors: string[] = [];
  const required = ["## 概要", "## API仕様", "## データモデル"];
  for (const section of required) {
    if (!content.includes(section)) {
      errors.push(`必須セクション「${section}」が見つかりません`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function validateADR(content: string): ValidationResult {
  const errors: string[] = [];
  if (!/^#\s+ADR-\d+:/m.test(content)) {
    errors.push("ADRタイトル（# ADR-N: タイトル）が見つかりません");
  }
  const required = ["## ステータス", "## コンテキスト", "## 決定", "## 理由"];
  for (const section of required) {
    if (!content.includes(section)) {
      errors.push(`必須セクション「${section}」が見つかりません`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function validateTasks(content: string): ValidationResult {
  const errors: string[] = [];

  let parsed: unknown;
  try {
    parsed = yaml.load(content);
  } catch (e) {
    errors.push(`YAMLパースエラー: ${(e as Error).message}`);
    return { valid: false, errors };
  }

  if (!parsed || typeof parsed !== "object") {
    errors.push("YAMLがオブジェクトではありません");
    return { valid: false, errors };
  }

  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.tasks)) {
    errors.push("`tasks` 配列が見つかりません");
    return { valid: false, errors };
  }

  for (let i = 0; i < obj.tasks.length; i++) {
    const task = obj.tasks[i] as Record<string, unknown>;
    if (!task.id) errors.push(`tasks[${i}]: id が必要です`);
    if (!task.title) errors.push(`tasks[${i}]: title が必要です`);
  }

  return { valid: errors.length === 0, errors };
}

// --- Normalizers ---

export function normalizeMarkdown(content: string): string {
  let text = content.trim();
  // Remove leading code fences
  text = text.replace(/^```[\w-]*\s*\n/, "");
  text = text.replace(/\n\s*```\s*$/, "");
  // Remove preamble text before the first heading
  const headingIndex = text.search(/^#\s/m);
  if (headingIndex > 0) {
    text = text.substring(headingIndex);
  }
  return text.trim();
}

export function normalizeYaml(content: string): string {
  let text = content.trim();
  // Remove code fences
  text = text.replace(/^```(?:ya?ml)?\s*\n/, "");
  text = text.replace(/\n\s*```\s*$/, "");
  // Remove preamble before first YAML key
  const firstKey = text.search(/^\w[\w_-]*:/m);
  if (firstKey > 0) {
    text = text.substring(firstKey);
  }
  return text.trim();
}

/** Normalize a statement to ensure 【Role】 marker is present */
export function normalizeStatement(role: string, content: string): string {
  // Remove any malformed role markers and ensure consistent format
  let text = content.trim();
  // Remove duplicate or malformed role markers like 【PM】 at the start
  text = text.replace(/^【[^】]+】\s*/, "");
  return text;
}

// --- Retry helper ---

export async function withRetry(
  llm: LLMProvider,
  systemPrompt: string,
  initialMessages: LLMMessage[],
  normalize: (content: string) => string,
  validate: (content: string) => ValidationResult,
  eventHandler?: MagiEventHandler,
  maxAttempts: number = 3,
): Promise<string> {
  let messages = [...initialMessages];
  let lastContent = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await llm.chat(systemPrompt, messages);
    lastContent = normalize(response.content);
    const result = validate(lastContent);

    if (result.valid) {
      return lastContent;
    }

    if (attempt === maxAttempts) {
      // Best effort: emit warning and return what we have
      if (eventHandler) {
        eventHandler({
          type: "validation_warning",
          data: {
            message: `バリデーション失敗（${maxAttempts}回試行）: ${result.errors.join(", ")}`,
            errors: result.errors,
            attempt,
          },
          timestamp: new Date(),
        });
      }
      return lastContent;
    }

    // Build retry messages: include assistant's previous output + correction instructions
    messages = [
      ...initialMessages,
      { role: "assistant" as const, content: response.content },
      {
        role: "user" as const,
        content: `## 修正指示\n出力に以下の問題があります。修正して再出力してください:\n${result.errors.map((e) => `- ${e}`).join("\n")}\n\n元の指示に忠実に、不足しているセクションを追加して完全な成果物を出力してください。`,
      },
    ];
  }

  return lastContent;
}
