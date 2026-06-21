import { randomUUID } from "node:crypto";
import type { ArchitectureMap } from "./types.js";

export interface Session {
  id: string;
  source: string;
  root: string;
  cloned: boolean;
  findings?: string;
  map?: ArchitectureMap;
  createdAt: number;
}

// In-memory session store. Sufficient for a single-process demo; swap for a
// real store if this ever needs to survive restarts or scale out.
const sessions = new Map<string, Session>();

export function createSession(input: Omit<Session, "id" | "createdAt">): Session {
  const session: Session = { ...input, id: randomUUID(), createdAt: Date.now() };
  sessions.set(session.id, session);
  return session;
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}
