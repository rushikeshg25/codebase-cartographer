import { useState } from "react";
import { createSession, streamSession } from "./api";
import AgentStream from "./AgentStream";
import DiagramView from "./DiagramView";
import Chat from "./Chat";
import type { AgentEvent, ArchitectureMap } from "./types";

type Phase = "idle" | "running" | "done" | "error";

export default function App() {
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [map, setMap] = useState<ArchitectureMap | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  async function start() {
    const value = input.trim();
    if (!value || phase === "running") return;
    setEvents([]);
    setMap(null);
    setSelected(null);
    setPhase("running");
    try {
      const id = await createSession(value);
      setSessionId(id);
      streamSession(id, (event) => {
        setEvents((prev) => [...prev, event]);
        if (event.type === "map") setMap(event.map);
        if (event.type === "done") setPhase("done");
        if (event.type === "error") setPhase("error");
      });
    } catch (err) {
      setEvents([{ type: "error", message: (err as Error).message }]);
      setPhase("error");
    }
  }

  const selectedNode = map?.nodes.find((n) => n.id === selected);

  return (
    <div className="app">
      <header className="header">
        <h1>Codebase Cartographer</h1>
        <div className="input-row">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && start()}
            placeholder="GitHub URL or local path…"
            disabled={phase === "running"}
          />
          <button onClick={start} disabled={phase === "running"}>
            {phase === "running" ? "Mapping…" : "Map it"}
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="panel">
          <h2>Agent</h2>
          <AgentStream events={events} />
        </section>

        <section className="panel">
          <h2>Architecture</h2>
          {map ? (
            <DiagramView map={map} onSelect={setSelected} />
          ) : (
            <div className="placeholder">The diagram appears once exploration completes.</div>
          )}
          {selectedNode && (
            <div className="node-detail">
              <strong>{selectedNode.label}</strong>
              <p>{selectedNode.description}</p>
              <ul>
                {selectedNode.keyFiles.map((f) => (
                  <li key={f}>
                    <code>{f}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="panel">
          <h2>Chat</h2>
          {sessionId && phase === "done" ? (
            <Chat sessionId={sessionId} />
          ) : (
            <div className="placeholder">Chat unlocks after the map is built.</div>
          )}
        </section>
      </main>
    </div>
  );
}
