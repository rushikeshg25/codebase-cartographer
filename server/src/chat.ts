import { config } from "./config.js";
import { RepoTools } from "./tools.js";
import { getProvider } from "./providers/index.js";
import { dispatch, toolSpecs } from "./tools-spec.js";
import type { LlmMessage } from "./providers/types.js";
import type { ArchitectureMap, ChatAnswer } from "./types.js";

const MAX_CHAT_STEPS = 8;

function systemFor(map: ArchitectureMap): string {
  return `You are answering questions about a codebase you have already mapped.
Use the list_files, read_file and grep tools to verify details before answering.
Always ground claims in real code and cite locations as 'path:line' inline.

Architecture summary:
${map.summary}

Modules:
${map.nodes.map((n) => `- ${n.label} (${n.id}): ${n.description}`).join("\n")}`;
}

const CITE = /[\w./-]+\.[A-Za-z]+:\d+/g;

/** Answer a question about the repo, letting the model re-read files as needed. */
export async function answerQuestion(
  root: string,
  map: ArchitectureMap,
  question: string,
): Promise<ChatAnswer> {
  const tools = new RepoTools(root);
  const provider = getProvider();
  const system = systemFor(map);
  const messages: LlmMessage[] = [{ role: "user", content: question }];

  for (let step = 0; step < MAX_CHAT_STEPS; step++) {
    const { text, toolCalls } = await provider.generate({
      model: config.agentModel,
      system,
      messages,
      tools: toolSpecs,
    });

    if (toolCalls.length === 0) {
      const answer = text || "(no answer)";
      const citations = [...new Set(answer.match(CITE) ?? [])];
      return { answer, citations };
    }

    messages.push({ role: "assistant", content: text || undefined, toolCalls });
    for (const call of toolCalls) {
      try {
        const result = await dispatch(tools, call.name, call.args);
        messages.push({ role: "tool", toolCallId: call.id, name: call.name, content: result });
      } catch (err) {
        messages.push({
          role: "tool",
          toolCallId: call.id,
          name: call.name,
          content: `error: ${(err as Error).message}`,
        });
      }
    }
  }

  return { answer: "I couldn't resolve that within the step budget.", citations: [] };
}
