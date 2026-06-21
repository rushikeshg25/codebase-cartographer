// Shared types for the Cartographer backend.

/** A single event streamed from the agent loop to the client over SSE. */
export type AgentEvent =
  | { type: "status"; message: string }
  | { type: "thought"; text: string }
  | { type: "tool_call"; tool: string; args: Record<string, unknown> }
  | { type: "tool_result"; tool: string; summary: string }
  | { type: "map"; map: ArchitectureMap }
  | { type: "done" }
  | { type: "error"; message: string };

/** A module/component node in the architecture diagram. */
export interface MapNode {
  id: string;
  label: string;
  description: string;
  keyFiles: string[];
}

/** A directed dependency edge between two nodes. */
export interface MapEdge {
  from: string;
  to: string;
  label?: string;
}

/** The synthesized architecture: diagram data plus a written tour. */
export interface ArchitectureMap {
  summary: string;
  nodes: MapNode[];
  edges: MapEdge[];
  tour: string;
}

/** A grounded chat answer with the source locations it cites. */
export interface ChatAnswer {
  answer: string;
  citations: string[];
}
