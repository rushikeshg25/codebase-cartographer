import { RepoTools } from "./tools.js";
import type { LlmTool } from "./providers/types.js";

/** Neutral, JSON-Schema tool definitions shared by the agent and chat loops. */
export const toolSpecs: LlmTool[] = [
  {
    name: "list_files",
    description:
      "List files and directories inside a repository directory. Directories end with '/'.",
    parameters: {
      type: "object",
      properties: {
        dir: {
          type: "string",
          description: "Repo-relative directory path. Defaults to the repo root.",
        },
      },
    },
  },
  {
    name: "read_file",
    description:
      "Read a file's contents with 1-based line numbers. Optionally restrict to a line range.",
    parameters: {
      type: "object",
      properties: {
        file: { type: "string", description: "Repo-relative file path." },
        start: { type: "number", description: "First line (1-based, optional)." },
        end: { type: "number", description: "Last line (1-based, optional)." },
      },
      required: ["file"],
    },
  },
  {
    name: "grep",
    description:
      "Regex-search the repository. Returns 'path:line: text' hits. Optionally filter by file extension.",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "JavaScript regular expression." },
        ext: { type: "string", description: "Optional file extension filter, e.g. '.ts'." },
      },
      required: ["pattern"],
    },
  },
];

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

/** Execute a tool call against the repo and return its textual result. */
export async function dispatch(
  tools: RepoTools,
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  switch (name) {
    case "list_files":
      return (await tools.listFiles(str(args.dir) ?? ".")).join("\n");
    case "read_file": {
      const file = str(args.file);
      if (!file) throw new Error("read_file requires a 'file' argument.");
      return await tools.readFile(file, num(args.start), num(args.end));
    }
    case "grep": {
      const pattern = str(args.pattern);
      if (!pattern) throw new Error("grep requires a 'pattern' argument.");
      return (await tools.grep(pattern, str(args.ext))).join("\n");
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
