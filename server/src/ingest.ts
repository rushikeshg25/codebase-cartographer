import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);

export interface IngestResult {
  root: string;
  source: string;
  cloned: boolean;
}

const GITHUB_URL = /^(https?:\/\/github\.com\/|git@github\.com:)/i;

/** True when the input looks like a remote GitHub URL rather than a local path. */
export function isGitHubUrl(input: string): boolean {
  return GITHUB_URL.test(input.trim());
}

/**
 * Resolve a user input to a local repo root.
 * - GitHub URL  -> shallow clone into a temp dir.
 * - Local path  -> validate it exists and is a directory.
 */
export async function ingest(input: string): Promise<IngestResult> {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Empty repository input.");

  if (isGitHubUrl(trimmed)) {
    const root = await cloneRepo(trimmed);
    return { root, source: trimmed, cloned: true };
  }

  const abs = path.resolve(trimmed);
  const stat = await fs.stat(abs).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    throw new Error(`Local path is not a directory: ${abs}`);
  }
  return { root: abs, source: abs, cloned: false };
}

async function cloneRepo(url: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cartographer-"));
  await execFileAsync(
    "git",
    ["clone", "--depth", "1", "--single-branch", "--no-tags", "--quiet", url, dir],
    { timeout: 120_000 },
  );
  return dir;
}
