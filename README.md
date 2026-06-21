# Codebase Cartographer

An AI agent that explores any codebase — a GitHub URL or a local folder — and produces a
live, watchable map of how it's built. You see the agent reason and use tools in real time,
get an interactive architecture diagram, and can chat with the repository (answers cite
real `file:line` locations).

Powered by the **Gemini API** (`@google/genai`).

## How it works

1. **Ingest** — clone a public GitHub URL or point at a local folder.
2. **Explore** — a Gemini agent loops over real tools (`list_files`, `read_file`, `grep`),
   streaming each thought and tool call to the UI.
3. **Synthesize** — findings are turned into a structured architecture diagram + a guided tour.
4. **Chat** — ask questions; the agent re-reads files on demand and cites sources.

## Stack

- **Backend:** Node + TypeScript, Express, Server-Sent Events
- **Frontend:** Vite + React, React Flow (diagram)
- **Model:** Gemini (`@google/genai`) or OpenRouter (`openai` SDK), behind one interface

## Providers

The LLM backend is selected with `LLM_PROVIDER` (default `gemini`):

| Provider | Env | Default agent / synth models |
| -------- | --- | ---------------------------- |
| `gemini` | `GEMINI_API_KEY` | `gemini-2.5-flash` / `gemini-2.5-pro` |
| `openrouter` | `OPENROUTER_API_KEY` | `google/gemini-2.5-flash` / `anthropic/claude-sonnet-4-6` |

Override models with `AGENT_MODEL` / `SYNTH_MODEL`. Only the active provider's key is required.
Both go through a provider-neutral interface (`server/src/providers/`), so the agent, chat, and
synthesis code is identical regardless of backend.

```bash
LLM_PROVIDER=openrouter OPENROUTER_API_KEY=... npm run dev
```

## Security

This server exposes filesystem-reading tools, so it is built to run on your own machine only:
it binds to `127.0.0.1`, restricts CORS to localhost origins, confines all tool access to the
target repo (rejecting `..`, symlink escapes, and `.git`), and caps regex/read sizes.

## Quick start

```bash
npm install
cp .env.example .env   # add your GEMINI_API_KEY
npm run dev            # starts backend (:8787) and frontend (:5173)
```

Open http://localhost:5173, paste a GitHub URL (or a local path) and watch it map.

## Project layout

```
server/   Express API, agent loop, tools, synthesis, chat
web/      React UI: input form, live agent stream, diagram, chat
```

## Development & verification

Terminal harnesses let you exercise the backend without the UI:

```bash
# Tools only — lists files, reads, greps, and checks the path-escape sandbox
npm run tools -w server -- <repo-path>

# Full pipeline — explore + synthesize, streaming steps to stdout (needs GEMINI_API_KEY)
GEMINI_API_KEY=... npm run agent -w server -- <repo-path-or-url>
```

Typecheck: `npx tsc -p server/tsconfig.json --noEmit` and `npm run build -w web`.

### API

| Method | Route | Purpose |
| ------ | ----- | ------- |
| POST | `/api/sessions` | Ingest a URL/path, returns `sessionId` |
| GET  | `/api/sessions/:id/stream` | SSE: live agent events, then the map |
| POST | `/api/sessions/:id/chat` | Grounded Q&A over the mapped repo |
