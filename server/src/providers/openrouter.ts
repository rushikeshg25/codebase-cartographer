import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { config } from "../config.js";
import type {
  GenerateJsonOptions,
  GenerateOptions,
  GenerateResult,
  LlmMessage,
  LlmProvider,
  LlmTool,
  ToolCall,
} from "./types.js";

function toOpenAiMessages(system: string, messages: LlmMessage[]): ChatCompletionMessageParam[] {
  const out: ChatCompletionMessageParam[] = [{ role: "system", content: system }];
  for (const message of messages) {
    if (message.role === "system") continue; // folded into the leading system message
    if (message.role === "user") {
      out.push({ role: "user", content: message.content });
    } else if (message.role === "assistant") {
      out.push({
        role: "assistant",
        content: message.content ?? null,
        ...(message.toolCalls && message.toolCalls.length > 0
          ? {
              tool_calls: message.toolCalls.map((call) => ({
                id: call.id,
                type: "function" as const,
                function: { name: call.name, arguments: JSON.stringify(call.args) },
              })),
            }
          : {}),
      });
    } else {
      out.push({ role: "tool", tool_call_id: message.toolCallId, content: message.content });
    }
  }
  return out;
}

function toOpenAiTools(tools: LlmTool[]): ChatCompletionTool[] {
  return tools.map((tool) => ({
    type: "function",
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  }));
}

export class OpenRouterProvider implements LlmProvider {
  private client = new OpenAI({
    apiKey: config.openrouterApiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: { "X-Title": "Codebase Cartographer" },
  });

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const completion = await this.client.chat.completions.create({
      model: options.model,
      messages: toOpenAiMessages(options.system, options.messages),
      ...(options.tools ? { tools: toOpenAiTools(options.tools) } : {}),
    });

    const message = completion.choices[0]?.message;
    const toolCalls: ToolCall[] = (message?.tool_calls ?? []).flatMap((call) => {
      if (call.type !== "function") return [];
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        args = {};
      }
      return [{ id: call.id, name: call.function.name, args }];
    });

    return { text: message?.content?.trim() ?? "", toolCalls };
  }

  async generateJson<T>(options: GenerateJsonOptions): Promise<T> {
    const completion = await this.client.chat.completions.create({
      model: options.model,
      messages: [
        {
          role: "system",
          content:
            "Respond with a single JSON object only, with no markdown fences. " +
            "It must conform to this JSON Schema:\n" +
            JSON.stringify(options.schema),
        },
        { role: "user", content: options.prompt },
      ],
      response_format: { type: "json_object" },
    });
    return JSON.parse(completion.choices[0]?.message?.content ?? "{}") as T;
  }
}
