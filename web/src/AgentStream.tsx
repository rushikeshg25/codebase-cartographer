import { useEffect, useRef } from "react";
import type { AgentEvent } from "./types";

interface Props {
  events: AgentEvent[];
}

const TOOL_ICON: Record<string, string> = {
  list_files: "📂",
  read_file: "📄",
  grep: "🔎",
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
          {event.type === "status" && <span className="status">› {event.message}</span>}
          {event.type === "thought" && <p className="thought">{event.text}</p>}
          {event.type === "tool_call" && (
            <div className="tool-call">
              <span className="tool-name">
                {TOOL_ICON[event.tool] ?? "🛠"} {event.tool}
              </span>
              <code className="tool-args">{JSON.stringify(event.args)}</code>
            </div>
          )}
          {event.type === "tool_result" && <div className="tool-result">{event.summary}</div>}
          {event.type === "error" && <div className="error">⚠ {event.message}</div>}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
