import Anthropic from "@anthropic-ai/sdk";

export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

export class LLMProvider {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;

  constructor(model: string, maxTokens: number, apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY,
    });
    this.model = model;
    this.maxTokens = maxTokens;
  }

  async chat(
    systemPrompt: string,
    messages: LLMMessage[],
  ): Promise<LLMResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const content = textBlock ? textBlock.text : "";

    return {
      content,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  }

  getModel(): string {
    return this.model;
  }
}
