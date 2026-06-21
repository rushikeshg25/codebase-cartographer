import { useMemo } from "react";
import ReactFlow, { Background, Controls, MarkerType, type Edge, type Node } from "reactflow";
import "reactflow/dist/style.css";
import type { ArchitectureMap } from "./types";

interface Props {
  map: ArchitectureMap;
  onSelect: (nodeId: string) => void;
}

/** Lay nodes out on a simple grid; good enough for a readable diagram. */
function layout(count: number, index: number): { x: number; y: number } {
  const cols = Math.ceil(Math.sqrt(count));
  return { x: (index % cols) * 260, y: Math.floor(index / cols) * 160 };
}

export default function DiagramView({ map, onSelect }: Props) {
  const nodes: Node[] = useMemo(
    () =>
      map.nodes.map((n, i) => ({
        id: n.id,
        position: layout(map.nodes.length, i),
        data: { label: n.label },
        style: {
          border: "1px solid #3b82f6",
          borderRadius: 8,
          padding: 10,
          background: "#0f172a",
          color: "#e2e8f0",
          fontSize: 13,
          width: 200,
        },
      })),
    [map.nodes],
  );

  const edges: Edge[] = useMemo(
    () =>
      map.edges.map((e, i) => ({
        id: `e${i}`,
        source: e.from,
        target: e.to,
        label: e.label,
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: "#64748b" },
        labelStyle: { fill: "#94a3b8", fontSize: 11 },
      })),
    [map.edges],
  );

  return (
    <div className="diagram">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={(_, node) => onSelect(node.id)}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1e293b" />
        <Controls />
      </ReactFlow>
    </div>
  );
}
