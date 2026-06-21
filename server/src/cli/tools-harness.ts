// Manual harness: exercise the repo tools against a directory.
// Usage: npm run tools -w server -- <repo-path>
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { RepoTools } from "../tools.js";

async function expectBlocked(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    console.log(`!! ${label}: NOT blocked - bug`);
  } catch (err) {
    console.log(`${label}: blocked as expected (${(err as Error).message})`);
  }
}

async function main() {
  const root = process.argv[2] ?? process.cwd();
  const tools = new RepoTools(root);
  console.log(`# Tools harness on ${root}\n`);

  console.log("## list_files('.')");
  console.log((await tools.listFiles(".")).slice(0, 20).join("\n"));

  const first = (await tools.listFiles(".")).find((f) => !f.endsWith("/"));
  if (first) {
    console.log(`\n## read_file('${first}', 1, 5)`);
    console.log(await tools.readFile(first, 1, 5));
  }

  console.log("\n## grep('import', '.ts')");
  console.log((await tools.grep("import", ".ts")).slice(0, 5).join("\n"));

  console.log("\n## security checks");
  await expectBlocked("path escape  ", () => tools.readFile("../../etc/passwd"));
  await expectBlocked("git access   ", () => tools.readFile(".git/config"));
  await expectBlocked("long pattern ", () => tools.grep("a".repeat(500)));

  // Create a symlink inside the repo pointing outside it, then try to read it.
  const linkPath = path.join(root, ".cartographer-escape-test");
  const outside = path.join(os.tmpdir(), `cartographer-secret-${Date.now()}.txt`);
  await fs.writeFile(outside, "top secret");
  await fs.symlink(outside, linkPath).catch(() => {});
  await expectBlocked("symlink escape", () => tools.readFile(".cartographer-escape-test"));
  await fs.rm(linkPath, { force: true });
  await fs.rm(outside, { force: true });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
