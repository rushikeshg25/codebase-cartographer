import { Type } from "@google/genai";
import { ai } from "./gemini.js";
import { config } from "./config.js";
import type { ArchitectureMap } from "./types.js";

const MAP_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: "One-paragraph overview of what the project is and does.",
    },
    nodes: {
      type: Type.ARRAY,
      description: "Top-level modules/components of the architecture.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Short stable id, e.g. 'api' or 'auth'." },
          label: { type: Type.STRING, description: "Human-readable module name." },
          description: { type: Type.STRING, description: "What this module is responsible for." },
          keyFiles: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "A few representative repo-relative file paths.",
          },
        },
        required: ["id", "label", "description", "keyFiles"],
      },
    },
    edges: {
      type: Type.ARRAY,
      description: "Directed dependencies between nodes (from depends on / calls to).",
      items: {
        type: Type.OBJECT,
        properties: {
          from: { type: Type.STRING },
          to: { type: Type.STRING },
          label: { type: Type.STRING, description: "Optional relationship label." },
        },
        required: ["from", "to"],
      },
    },
    tour: {
      type: Type.STRING,
      description: "A markdown guided tour of the codebase for a new contributor.",
    },
  },
  required: ["summary", "nodes", "edges", "tour"],
};

/**
 * Turn the agent's free-text findings into a structured architecture map
 * suitable for rendering as a diagram plus a written tour.
 */
export async function synthesizeMap(findings: string): Promise<ArchitectureMap> {
  const response = await ai.models.generateContent({
    model: config.synthModel,
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              "Based on the following exploration notes of a codebase, produce a structured " +
              "architecture map. Node ids must be unique and edges must only reference existing " +
              "node ids.\n\n--- EXPLORATION NOTES ---\n" +
              findings,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: MAP_SCHEMA,
    },
  });

  const map = JSON.parse(response.text ?? "{}") as ArchitectureMap;
  // Drop any edges that point at non-existent nodes (model occasionally drifts).
  const ids = new Set(map.nodes.map((n) => n.id));
  map.edges = (map.edges ?? []).filter((e) => ids.has(e.from) && ids.has(e.to));
  return map;
}
