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
- **Model:** Gemini via `@google/genai`

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
