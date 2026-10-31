import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";

const configSource = readFileSync(new URL("../src/config.ts", import.meta.url), "utf8");
const nodeModules = fileURLToPath(new URL("../../node_modules", import.meta.url));
const tsx = import.meta.resolve("tsx");
const envKeys = [
  "LLM_PROVIDER", "GEMINI_API_KEY", "OPENROUTER_API_KEY", "AGENT_MODEL", "SYNTH_MODEL",
  "PORT", "MAX_AGENT_STEPS",
];

function loadConfig(t, { provider = "gemini", models = "", cwd = "server", overrides = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), "cartographer-config-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "server/src"), { recursive: true });
  writeFileSync(join(root, "server/package.json"), '{"type":"module"}');
  symlinkSync(nodeModules, join(root, "node_modules"), "dir");
  writeFileSync(join(root, "server/src/config.ts"), configSource);
  writeFileSync(join(root, ".env"),
    `LLM_PROVIDER=${provider}\nGEMINI_API_KEY=test-key\nOPENROUTER_API_KEY=test-key\n${models}`);
  // Reproduce a stale workspace .env masking the configured root .env.
  writeFileSync(join(root, "server/.env"),
    "LLM_PROVIDER=gemini\nGEMINI_API_KEY=stale-test-key\nAGENT_MODEL=\nSYNTH_MODEL=\n");
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (envKeys.includes(key) || key.startsWith("DOTENV_CONFIG_")) delete env[key];
  }
  Object.assign(env, overrides);
  const url = pathToFileURL(join(root, "server/src/config.ts")).href;
  return JSON.parse(execFileSync(process.execPath, ["--import", tsx, "--input-type=module", "-e",
    `const { config } = await import(${JSON.stringify(url)}); console.log(JSON.stringify({
      provider: config.provider, agent: config.agentModel, synth: config.synthModel
    }));`,
  ], { cwd: join(root, cwd), env, encoding: "utf8" }));
}

for (const cwd of [".", "server"]) {
  test(`loads root .env overrides when launched from ${cwd}`, (t) => {
    assert.deepEqual(loadConfig(t, { cwd, models: "AGENT_MODEL=custom-agent\nSYNTH_MODEL=custom-synth\n" }),
      { provider: "gemini", agent: "custom-agent", synth: "custom-synth" });
  });
}

for (const provider of ["gemini", "openrouter"]) {
  for (const [label, models] of [
    ["missing", ""],
    ["empty", "AGENT_MODEL=\nSYNTH_MODEL=\n"],
    ["whitespace", 'AGENT_MODEL="   "\nSYNTH_MODEL="   "\n'],
  ]) {
    test(`${provider}: ${label} model overrides use provider defaults`, (t) => {
      assert.deepEqual(loadConfig(t, { provider, models, cwd: "." }), provider === "gemini"
        ? { provider, agent: "gemini-2.5-flash", synth: "gemini-2.5-pro" }
        : { provider, agent: "google/gemini-2.5-flash", synth: "anthropic/claude-sonnet-4.6" });
    });
  }
}

test("shell environment takes precedence and model overrides are trimmed", (t) => {
  assert.deepEqual(loadConfig(t, {
    models: "AGENT_MODEL=file-agent\nSYNTH_MODEL=file-synth\n",
    overrides: { LLM_PROVIDER: "openrouter", AGENT_MODEL: " shell-agent ", SYNTH_MODEL: " shell-synth " },
  }), { provider: "openrouter", agent: "shell-agent", synth: "shell-synth" });
});
