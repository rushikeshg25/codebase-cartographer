// Manual harness: run the full explore + synthesize pipeline from the terminal.
// Usage: GEMINI_API_KEY=... npm run agent -w server -- <repo-path-or-url>
import { ingest } from "../ingest.js";
import { exploreRepo } from "../agent.js";
import { synthesizeMap } from "../synthesize.js";

async function main() {
  const input = process.argv[2] ?? process.cwd();
  const { root, source } = await ingest(input);
  console.log(`# Cartographer on ${source}\n`);

  const findings = await exploreRepo(root, (event) => {
    if (event.type === "tool_call") {
      console.log(`  -> ${event.tool}(${JSON.stringify(event.args)})`);
    } else if (event.type === "tool_result") {
      console.log(`    ${event.summary}`);
    } else if (event.type === "thought") {
      console.log(`\n[thought] ${event.text}\n`);
    } else if (event.type === "status") {
      console.log(`[status] ${event.message}`);
    }
  });

  console.log("\n=== Synthesizing map ===\n");
  const map = await synthesizeMap(findings);
  console.log(`Summary: ${map.summary}\n`);
  console.log(`Nodes: ${map.nodes.map((n) => n.label).join(", ")}`);
  console.log(`Edges: ${map.edges.map((e) => `${e.from}->${e.to}`).join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
