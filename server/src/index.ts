import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { ingest } from "./ingest.js";
import { exploreRepo } from "./agent.js";
import { synthesizeMap } from "./synthesize.js";
import { answerQuestion } from "./chat.js";
import { createSession, getSession } from "./session.js";
import type { AgentEvent } from "./types.js";

const app = express();
// This server exposes filesystem-reading tools, so only allow same-machine use:
// bind to loopback (below) and accept browser requests only from localhost origins.
app.use(
  cors({
    origin: (origin, cb) => {
      const ok = !origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      cb(ok ? null : new Error("Cross-origin request blocked"), ok);
    },
  }),
);
app.use(express.json());

// Create a session from a GitHub URL or local path.
app.post("/api/sessions", async (req, res) => {
  try {
    const input = String(req.body?.input ?? "");
    const { root, source, cloned } = await ingest(input);
    const session = createSession({ root, source, cloned });
    res.json({ sessionId: session.id, source });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// Stream the agent's exploration, then the synthesized map, over SSE.
app.get("/api/sessions/:id/stream", async (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    res.status(404).end();
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const send = (event: AgentEvent) => res.write(`data: ${JSON.stringify(event)}\n\n`);

  try {
    const findings = await exploreRepo(session.root, send);
    session.findings = findings;
    send({ type: "status", message: "Synthesizing architecture map…" });
    const map = await synthesizeMap(findings);
    session.map = map;
    send({ type: "map", map });
    send({ type: "done" });
  } catch (err) {
    send({ type: "error", message: (err as Error).message });
  } finally {
    res.end();
  }
});

// Ask a grounded question about the mapped repo.
app.post("/api/sessions/:id/chat", async (req, res) => {
  const session = getSession(req.params.id);
  if (!session?.map) {
    res.status(409).json({ error: "Session not ready — map the repo first." });
    return;
  }
  try {
    const answer = await answerQuestion(session.root, session.map, String(req.body?.question ?? ""));
    res.json(answer);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.listen(config.port, "127.0.0.1", () => {
  console.log(`Cartographer server listening on http://127.0.0.1:${config.port}`);
});
