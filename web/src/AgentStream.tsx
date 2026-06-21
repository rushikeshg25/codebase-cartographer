import { useEffect, useRef } from "react";
import type { AgentEvent } from "./types";

interface Props {
  events: AgentEvent[];
}

const TOOL_BADGE: Record<string, string> = {
  list_files: "LIST",
  read_file: "READ",
  grep: "GREP",
};

/** Live, scrolling feed of the agent's thoughts and tool calls. */
export default function AgentStream({ events }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length]);

  return (
    <div className="stream">
      {events.map((event, i) => (
        <div key={i} className={`event event-${event.type}`}>
          {event.type === "status" && <span className="status">&gt; {event.message}</span>}
          {event.type === "thought" && <p className="thought">{event.text}</p>}
          {event.type === "tool_call" && (
            <div className="tool-call">
              <span className="tool-badge">{TOOL_BADGE[event.tool] ?? "TOOL"}</span>
              <span className="tool-name">{event.tool}</span>
              <code className="tool-args">{JSON.stringify(event.args)}</code>
            </div>
          )}
          {event.type === "tool_result" && <div className="tool-result">{event.summary}</div>}
          {event.type === "error" && <div className="error">Error: {event.message}</div>}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
