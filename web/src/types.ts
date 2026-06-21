// Mirrors the backend event/map shapes (server/src/types.ts).

export interface MapNode {
  id: string;
  label: string;
  description: string;
  keyFiles: string[];
}

export interface MapEdge {
  from: string;
  to: string;
  label?: string;
}

export interface ArchitectureMap {
  summary: string;
  nodes: MapNode[];
  edges: MapEdge[];
  tour: string;
}

export type AgentEvent =
  | { type: "status"; message: string }
  | { type: "thought"; text: string }
  | { type: "tool_call"; tool: string; args: Record<string, unknown> }
  | { type: "tool_result"; tool: string; summary: string }
  | { type: "map"; map: ArchitectureMap }
  | { type: "done" }
  | { type: "error"; message: string };

export interface ChatAnswer {
  answer: string;
  citations: string[];
}
