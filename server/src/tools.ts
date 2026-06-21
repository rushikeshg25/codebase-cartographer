import { promises as fs } from "node:fs";
import path from "node:path";
import ignore, { type Ignore } from "ignore";

const SKIP_DIRS = new Set([".git", "node_modules", "dist", "build", ".next", "vendor"]);
const MAX_READ_BYTES = 200_000;
const MAX_GREP_HITS = 100;
const MAX_LIST_ENTRIES = 500;

/**
 * A repository-scoped toolset. Every path argument is resolved against `root`
 * and rejected if it escapes the root, so the agent can never read outside the
 * repo it was given.
 */
export class RepoTools {
  private ig: Ignore | null = null;

  constructor(public readonly root: string) {}

  /** Resolve a repo-relative path safely, throwing on escape attempts. */
  private resolve(relPath: string): string {
    const abs = path.resolve(this.root, relPath || ".");
    const rel = path.relative(this.root, abs);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      throw new Error(`Path escapes repository root: ${relPath}`);
    }
    return abs;
  }

  /** Lazily load and cache the repo's .gitignore rules. */
  private async ignorer(): Promise<Ignore> {
    if (this.ig) return this.ig;
    const ig = ignore();
    const gitignore = await fs
      .readFile(path.join(this.root, ".gitignore"), "utf8")
      .catch(() => "");
    if (gitignore) ig.add(gitignore);
    this.ig = ig;
    return ig;
  }

  private async isIgnored(abs: string): Promise<boolean> {
    const rel = path.relative(this.root, abs);
    if (!rel || rel.startsWith("..")) return false;
    const ig = await this.ignorer();
    return ig.ignores(rel);
  }

  /** List entries of a directory, skipping noise and gitignored files. */
  async listFiles(dir = "."): Promise<string[]> {
    const abs = this.resolve(dir);
    const entries = await fs.readdir(abs, { withFileTypes: true });
    const out: string[] = [];
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const childAbs = path.join(abs, entry.name);
      if (await this.isIgnored(childAbs)) continue;
      const rel = path.relative(this.root, childAbs);
      out.push(entry.isDirectory() ? `${rel}/` : rel);
      if (out.length >= MAX_LIST_ENTRIES) break;
    }
    return out.sort();
  }

  /** Read a file with 1-based line numbers, for citable output. */
  async readFile(file: string, start?: number, end?: number): Promise<string> {
    const abs = this.resolve(file);
    const stat = await fs.stat(abs);
    if (stat.isDirectory()) throw new Error(`${file} is a directory, not a file.`);
    if (stat.size > MAX_READ_BYTES) {
      throw new Error(
        `${file} is ${stat.size} bytes (limit ${MAX_READ_BYTES}). Read a line range instead.`,
      );
    }
    const lines = (await fs.readFile(abs, "utf8")).split("\n");
    const from = Math.max(1, start ?? 1);
    const to = Math.min(lines.length, end ?? lines.length);
    return lines
      .slice(from - 1, to)
      .map((line, i) => `${from + i}\t${line}`)
      .join("\n");
  }

  /** Regex search across files, returning `path:line: text` hits. */
  async grep(pattern: string, globExt?: string): Promise<string[]> {
    let re: RegExp;
    try {
      re = new RegExp(pattern);
    } catch {
      throw new Error(`Invalid regular expression: ${pattern}`);
    }
    const hits: string[] = [];
    const walk = async (dir: string): Promise<void> => {
      if (hits.length >= MAX_GREP_HITS) return;
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (hits.length >= MAX_GREP_HITS) return;
        if (SKIP_DIRS.has(entry.name)) continue;
        const childAbs = path.join(dir, entry.name);
        if (await this.isIgnored(childAbs)) continue;
        if (entry.isDirectory()) {
          await walk(childAbs);
          continue;
        }
        if (globExt && !entry.name.endsWith(globExt)) continue;
        const rel = path.relative(this.root, childAbs);
        const content = await fs.readFile(childAbs, "utf8").catch(() => null);
        if (content === null) continue; // skip binary / unreadable
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (re.test(lines[i])) {
            hits.push(`${rel}:${i + 1}: ${lines[i].trim().slice(0, 200)}`);
            if (hits.length >= MAX_GREP_HITS) return;
          }
        }
      }
    };
    await walk(this.root);
    return hits;
  }
}
