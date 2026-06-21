import { config } from "./config.js";
import { getProvider } from "./providers/index.js";
import type { JsonSchema } from "./providers/types.js";
import type { ArchitectureMap } from "./types.js";

const MAP_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "One-paragraph overview of what the project is and does.",
    },
    nodes: {
      type: "array",
      description: "Top-level modules/components of the architecture.",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "Short stable id, e.g. 'api' or 'auth'." },
          label: { type: "string", description: "Human-readable module name." },
          description: { type: "string", description: "What this module is responsible for." },
          keyFiles: {
            type: "array",
            items: { type: "string" },
            description: "A few representative repo-relative file paths.",
          },
        },
        required: ["id", "label", "description", "keyFiles"],
      },
    },
    edges: {
      type: "array",
      description: "Directed dependencies between nodes (from depends on / calls to).",
      items: {
        type: "object",
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          label: { type: "string", description: "Optional relationship label." },
        },
        required: ["from", "to"],
      },
    },
    tour: {
      type: "string",
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
  const map = await getProvider().generateJson<ArchitectureMap>({
    model: config.synthModel,
    prompt:
      "Based on the following exploration notes of a codebase, produce a structured " +
      "architecture map. Node ids must be unique and edges must only reference existing " +
      "node ids.\n\n--- EXPLORATION NOTES ---\n" +
      findings,
    schema: MAP_SCHEMA,
  });

  map.nodes ??= [];
  // Drop any edges that point at non-existent nodes (model occasionally drifts).
  const ids = new Set(map.nodes.map((n) => n.id));
  map.edges = (map.edges ?? []).filter((e) => ids.has(e.from) && ids.has(e.to));
  return map;
}
