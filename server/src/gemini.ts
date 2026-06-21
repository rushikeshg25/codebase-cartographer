import { GoogleGenAI, Type, type FunctionDeclaration } from "@google/genai";
import { config } from "./config.js";

export const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

/**
 * Function declarations exposed to the agent. These mirror the methods on
 * RepoTools and are what Gemini decides to call during exploration.
 */
export const toolDeclarations: FunctionDeclaration[] = [
  {
    name: "list_files",
    description:
      "List files and directories inside a repository directory. Directories end with '/'.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        dir: {
          type: Type.STRING,
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
      type: Type.OBJECT,
      properties: {
        file: { type: Type.STRING, description: "Repo-relative file path." },
        start: { type: Type.NUMBER, description: "First line (1-based, optional)." },
        end: { type: Type.NUMBER, description: "Last line (1-based, optional)." },
      },
      required: ["file"],
    },
  },
  {
    name: "grep",
    description:
      "Regex-search the repository. Returns 'path:line: text' hits. Optionally filter by file extension.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        pattern: { type: Type.STRING, description: "JavaScript regular expression." },
        ext: {
          type: Type.STRING,
          description: "Optional file extension filter, e.g. '.ts'.",
        },
      },
      required: ["pattern"],
    },
  },
];
