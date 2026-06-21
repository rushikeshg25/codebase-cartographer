import type { Content, Part } from "@google/genai";
import { ai, toolDeclarations } from "./gemini.js";
import { config } from "./config.js";
import { RepoTools } from "./tools.js";
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

async function dispatch(tools: RepoTools, name: string, args: Record<string, any>) {
  switch (name) {
    case "list_files":
      return (await tools.listFiles(args.dir ?? ".")).join("\n");
    case "read_file":
      return await tools.readFile(args.file, args.start, args.end);
    case "grep":
      return (await tools.grep(args.pattern, args.ext)).join("\n");
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

/** Answer a question about the repo, letting the model re-read files as needed. */
export async function answerQuestion(
  root: string,
  map: ArchitectureMap,
  question: string,
): Promise<ChatAnswer> {
  const tools = new RepoTools(root);
  const contents: Content[] = [{ role: "user", parts: [{ text: question }] }];

  for (let step = 0; step < MAX_CHAT_STEPS; step++) {
    const response = await ai.models.generateContent({
      model: config.agentModel,
      contents,
      config: {
        systemInstruction: systemFor(map),
        tools: [{ functionDeclarations: toolDeclarations }],
      },
    });

    const calls = response.functionCalls ?? [];
    if (calls.length === 0) {
      const answer = response.text?.trim() ?? "(no answer)";
      const citations = [...new Set(answer.match(CITE) ?? [])];
      return { answer, citations };
    }

    contents.push({ role: "model", parts: calls.map((c) => ({ functionCall: c })) as Part[] });
    const parts: Part[] = [];
    for (const call of calls) {
      const name = call.name ?? "";
      try {
        const result = await dispatch(tools, name, (call.args ?? {}) as Record<string, any>);
        parts.push({ functionResponse: { name, response: { result } } });
      } catch (err) {
        parts.push({ functionResponse: { name, response: { error: (err as Error).message } } });
      }
    }
    contents.push({ role: "user", parts });
  }

  return { answer: "I couldn't resolve that within the step budget.", citations: [] };
}
