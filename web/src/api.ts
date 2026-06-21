import type { AgentEvent, ChatAnswer } from "./types";

/** Create a session from a GitHub URL or local path. */
export async function createSession(input: string): Promise<string> {
  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "Failed to create session");
  return (await res.json()).sessionId as string;
}

/**
 * Open the SSE stream for a session and invoke `onEvent` for each agent event.
 * Returns a function to close the stream.
 */
export function streamSession(
  sessionId: string,
  onEvent: (event: AgentEvent) => void,
): () => void {
  const source = new EventSource(`/api/sessions/${sessionId}/stream`);
  source.onmessage = (e) => {
    const event = JSON.parse(e.data) as AgentEvent;
    onEvent(event);
    if (event.type === "done" || event.type === "error") source.close();
  };
  source.onerror = () => source.close();
  return () => source.close();
}

/** Ask a grounded question about the mapped repo. */
export async function askQuestion(sessionId: string, question: string): Promise<ChatAnswer> {
  const res = await fetch(`/api/sessions/${sessionId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "Chat failed");
  return (await res.json()) as ChatAnswer;
}
