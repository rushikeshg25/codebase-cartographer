import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { askQuestion } from "./api";
import type { ChatAnswer } from "./types";

interface Message {
  role: "user" | "agent";
  text: string;
  citations?: string[];
}

interface Props {
  sessionId: string;
}

/** Grounded chat over the mapped repository. */
export default function Chat({ sessionId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    const question = input.trim();
    if (!question || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: question }]);
    setBusy(true);
    try {
      const answer: ChatAnswer = await askQuestion(sessionId, question);
      setMessages((m) => [
        ...m,
        { role: "agent", text: answer.answer, citations: answer.citations },
      ]);
    } catch (err) {
      setMessages((m) => [...m, { role: "agent", text: `Error: ${(err as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chat">
      <div className="chat-log">
        {messages.length === 0 && (
          <p className="hint">Ask anything about this repo — e.g. "How does auth work?"</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg msg-${m.role}`}>
            <ReactMarkdown>{m.text}</ReactMarkdown>
            {m.citations && m.citations.length > 0 && (
              <div className="citations">
                {m.citations.map((c) => (
                  <code key={c} className="citation">
                    {c}
                  </code>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && <div className="msg msg-agent thinking">thinking…</div>}
      </div>
      <div className="chat-input">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask about the codebase…"
          disabled={busy}
        />
        <button onClick={send} disabled={busy}>
          Send
        </button>
      </div>
    </div>
  );
}
