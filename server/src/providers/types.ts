// Provider-neutral LLM types. Agent/chat/synthesis depend only on these, so the
// concrete backend (Gemini or OpenRouter) can be swapped behind getProvider().

/** A JSON-Schema fragment describing tool parameters or a structured response. */
export type JsonSchema = Record<string, unknown>;

/** A tool the model may call. */
export interface LlmTool {
  name: string;
  description: string;
  parameters: JsonSchema;
}

/** A single tool invocation requested by the model. */
export interface ToolCall {
  /** Stable id linking a call to its result (required by OpenAI-style APIs). */
  id: string;
  name: string;
  args: Record<string, unknown>;
}

/** A message in the neutral conversation history. */
export type LlmMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content?: string; toolCalls?: ToolCall[] }
  | { role: "tool"; toolCallId: string; name: string; content: string };

/** The model's reply for one turn. */
export interface GenerateResult {
  text: string;
  toolCalls: ToolCall[];
}

export interface GenerateOptions {
  model: string;
  system: string;
  messages: LlmMessage[];
  tools?: LlmTool[];
}

export interface GenerateJsonOptions {
  model: string;
  prompt: string;
  schema: JsonSchema;
}

/** A concrete LLM backend. */
export interface LlmProvider {
  /** One agentic turn: returns assistant text and/or tool calls. */
  generate(options: GenerateOptions): Promise<GenerateResult>;
  /** A one-shot call that must return JSON matching `schema`. */
  generateJson<T>(options: GenerateJsonOptions): Promise<T>;
}
