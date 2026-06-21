import { config } from "./config.js";
import { RepoTools } from "./tools.js";
import { getProvider } from "./providers/index.js";
import { dispatch, toolSpecs } from "./tools-spec.js";
import type { LlmMessage } from "./providers/types.js";
import type { AgentEvent } from "./types.js";

const SYSTEM_INSTRUCTION = `You are Cartographer, an expert software archaeologist.
You are given access to a code repository through three tools: list_files, read_file, and grep.
Your goal is to understand how the repository is structured: its top-level modules/components,
what each is responsible for, the key files, and how they depend on one another.

Work methodically:
1. Start by listing the root to get the lay of the land.
2. Read manifest/config files (package.json, pyproject, go.mod, README) to learn the stack and entry points.
3. Drill into the important directories; read representative files; grep for how pieces connect.
4. Stop exploring once you can confidently describe the architecture; do not read every file.

When you are done, STOP calling tools and reply with a concise prose summary of the architecture:
the main modules, their responsibilities, and how they fit together. Be specific and cite real paths.`;

export type EmitFn = (event: AgentEvent) => void;

/** Build a short one-line summary of a tool result for the live stream. */
function summarize(result: string): string {
  const lines = result.split("\n");
  const head = lines.slice(0, 3).join(" | ");
  return lines.length > 3 ? `${head} (+${lines.length - 3} more lines)` : head;
}

/**
 * Drive the agent over the repository, emitting events as it works.
 * Returns the agent's final free-text architecture summary.
 */
export async function exploreRepo(root: string, emit: EmitFn): Promise<string> {
  const tools = new RepoTools(root);
  const provider = getProvider();
  const messages: LlmMessage[] = [
    { role: "user", content: "Explore this repository and describe its architecture." },
  ];

  emit({ type: "status", message: "Agent starting exploration..." });

  for (let step = 0; step < config.maxAgentSteps; step++) {
    const { text, toolCalls } = await provider.generate({
      model: config.agentModel,
      system: SYSTEM_INSTRUCTION,
      messages,
      tools: toolSpecs,
    });

    // No tool calls => the agent has finished and produced its summary.
    if (toolCalls.length === 0) {
      if (text) emit({ type: "thought", text });
      return text || "(no summary produced)";
    }

    if (text) emit({ type: "thought", text });
    messages.push({ role: "assistant", content: text || undefined, toolCalls });

    // Execute every requested call and feed results back.
    for (const call of toolCalls) {
      emit({ type: "tool_call", tool: call.name, args: call.args });
      try {
        const result = await dispatch(tools, call.name, call.args);
        emit({ type: "tool_result", tool: call.name, summary: summarize(result) || "(empty)" });
        messages.push({ role: "tool", toolCallId: call.id, name: call.name, content: result });
      } catch (err) {
        const message = (err as Error).message;
        emit({ type: "tool_result", tool: call.name, summary: `error: ${message}` });
        messages.push({
          role: "tool",
          toolCallId: call.id,
          name: call.name,
          content: `error: ${message}`,
        });
      }
    }
  }

  emit({ type: "status", message: "Reached step limit; summarizing what was found." });
  messages.push({ role: "user", content: "Stop exploring. Summarize the architecture now." });
  const { text } = await provider.generate({
    model: config.agentModel,
    system: SYSTEM_INSTRUCTION,
    messages,
  });
  return text || "(no summary produced)";
}
