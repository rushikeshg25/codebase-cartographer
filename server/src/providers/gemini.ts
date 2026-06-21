import {
  GoogleGenAI,
  Type,
  type Content,
  type FunctionDeclaration,
  type Part,
  type Schema,
} from "@google/genai";
import { config } from "../config.js";
import type {
  GenerateJsonOptions,
  GenerateOptions,
  GenerateResult,
  JsonSchema,
  LlmMessage,
  LlmProvider,
  LlmTool,
  ToolCall,
} from "./types.js";

const TYPE_MAP: Record<string, Type> = {
  object: Type.OBJECT,
  array: Type.ARRAY,
  string: Type.STRING,
  number: Type.NUMBER,
  boolean: Type.BOOLEAN,
  integer: Type.INTEGER,
};

/** Convert a neutral JSON Schema into Gemini's Type-based Schema. */
function toGeminiSchema(schema: JsonSchema): Schema {
  const out: Schema = {};
  const type = schema.type as string | undefined;
  if (type) out.type = TYPE_MAP[type] ?? Type.STRING;
  if (typeof schema.description === "string") out.description = schema.description;
  if (schema.properties) {
    const props = schema.properties as Record<string, JsonSchema>;
    out.properties = Object.fromEntries(
      Object.entries(props).map(([key, value]) => [key, toGeminiSchema(value)]),
    );
  }
  if (schema.items) out.items = toGeminiSchema(schema.items as JsonSchema);
  if (Array.isArray(schema.required)) out.required = schema.required as string[];
  return out;
}

function toFunctionDeclarations(tools: LlmTool[]): FunctionDeclaration[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: toGeminiSchema(tool.parameters),
  }));
}

/** Translate neutral history into Gemini Content turns. */
function toContents(messages: LlmMessage[]): Content[] {
  const contents: Content[] = [];
  for (const message of messages) {
    if (message.role === "system") continue; // passed via systemInstruction
    if (message.role === "user") {
      contents.push({ role: "user", parts: [{ text: message.content }] });
    } else if (message.role === "assistant") {
      const parts: Part[] = [];
      if (message.content) parts.push({ text: message.content });
      for (const call of message.toolCalls ?? []) {
        parts.push({ functionCall: { name: call.name, args: call.args } });
      }
      contents.push({ role: "model", parts });
    } else {
      // Gemini matches tool results to calls by function name.
      contents.push({
        role: "user",
        parts: [{ functionResponse: { name: message.name, response: { result: message.content } } }],
      });
    }
  }
  return contents;
}

export class GeminiProvider implements LlmProvider {
  private ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const response = await this.ai.models.generateContent({
      model: options.model,
      contents: toContents(options.messages),
      config: {
        systemInstruction: options.system,
        ...(options.tools
          ? { tools: [{ functionDeclarations: toFunctionDeclarations(options.tools) }] }
          : {}),
      },
    });

    const toolCalls: ToolCall[] = (response.functionCalls ?? []).map((call, i) => ({
      id: `${call.name ?? "call"}-${i}`,
      name: call.name ?? "",
      args: (call.args ?? {}) as Record<string, unknown>,
    }));

    return { text: response.text?.trim() ?? "", toolCalls };
  }

  async generateJson<T>(options: GenerateJsonOptions): Promise<T> {
    const response = await this.ai.models.generateContent({
      model: options.model,
      contents: [{ role: "user", parts: [{ text: options.prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: toGeminiSchema(options.schema),
      },
    });
    return JSON.parse(response.text ?? "{}") as T;
  }
}
