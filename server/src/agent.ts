import type { Content, Part } from "@google/genai";
import { ai, toolDeclarations } from "./gemini.js";
import { config } from "./config.js";
import { RepoTools } from "./tools.js";
import type { AgentEvent } from "./types.js";

const SYSTEM_INSTRUCTION = `You are Cartographer, an expert software archaeologist.
You are given access to a code repository through three tools: list_files, read_file, and grep.
Your goal is to understand how the repository is structured: its top-level modules/components,
what each is responsible for, the key files, and how they depend on one another.

Work methodically:
1. Start by listing the root to get the lay of the land.
2. Read manifest/config files (package.json, pyproject, go.mod, README) to learn the stack and entry points.
3. Drill into the important directories; read representative files; grep for how pieces connect.
4. Stop exploring once you can confidently describe the architecture — do not read every file.

When you are done, STOP calling tools and reply with a concise prose summary of the architecture:
the main modules, their responsibilities, and how they fit together. Be specific and cite real paths.`;

export type EmitFn = (event: AgentEvent) => void;

/** Run a short text from a tool result for the live stream. */
function summarize(result: string): string {
  const lines = result.split("\n");
  const head = lines.slice(0, 3).join(" ⏎ ");
  return lines.length > 3 ? `${head} … (+${lines.length - 3} more lines)` : head;
}

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

/**
 * Drive the Gemini agent over the repository, emitting events as it works.
 * Returns the agent's final free-text architecture summary.
 */
export async function exploreRepo(root: string, emit: EmitFn): Promise<string> {
  const tools = new RepoTools(root);
  const contents: Content[] = [
    { role: "user", parts: [{ text: "Explore this repository and describe its architecture." }] },
  ];

  emit({ type: "status", message: "Agent starting exploration…" });

  for (let step = 0; step < config.maxAgentSteps; step++) {
    const response = await ai.models.generateContent({
      model: config.agentModel,
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ functionDeclarations: toolDeclarations }],
      },
    });

    const calls = response.functionCalls ?? [];
    const text = response.text?.trim();

    // No tool calls => the agent has finished and produced its summary.
    if (calls.length === 0) {
      if (text) emit({ type: "thought", text });
      return text ?? "(no summary produced)";
    }

    if (text) emit({ type: "thought", text });

    // Record the model's tool-call turn.
    contents.push({
      role: "model",
      parts: calls.map((c) => ({ functionCall: c })) as Part[],
    });

    // Execute every requested call and feed results back.
    const responseParts: Part[] = [];
    for (const call of calls) {
      const name = call.name ?? "";
      const args = (call.args ?? {}) as Record<string, any>;
      emit({ type: "tool_call", tool: name, args });
      try {
        const result = await dispatch(tools, name, args);
        emit({ type: "tool_result", tool: name, summary: summarize(result) || "(empty)" });
        responseParts.push({ functionResponse: { name, response: { result } } });
      } catch (err) {
        const message = (err as Error).message;
        emit({ type: "tool_result", tool: name, summary: `error: ${message}` });
        responseParts.push({ functionResponse: { name, response: { error: message } } });
      }
    }
    contents.push({ role: "user", parts: responseParts });
  }

  emit({ type: "status", message: "Reached step limit; summarizing what was found." });
  const wrapUp = await ai.models.generateContent({
    model: config.agentModel,
    contents: [
      ...contents,
      { role: "user", parts: [{ text: "Stop exploring. Summarize the architecture now." }] },
    ],
    config: { systemInstruction: SYSTEM_INSTRUCTION },
  });
  return wrapUp.text?.trim() ?? "(no summary produced)";
}
