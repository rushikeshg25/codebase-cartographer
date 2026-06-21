// Manual harness: exercise the repo tools against a directory.
// Usage: npm run tools -w server -- <repo-path>
import { RepoTools } from "../tools.js";

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

  console.log("\n## sandbox check: read_file('../../etc/passwd')");
  try {
    await tools.readFile("../../etc/passwd");
    console.log("!! ESCAPE NOT BLOCKED — bug");
  } catch (err) {
    console.log(`blocked as expected: ${(err as Error).message}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
