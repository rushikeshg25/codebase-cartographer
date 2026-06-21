import "dotenv/config";

function required(name: "GEMINI_API_KEY" | "OPENROUTER_API_KEY"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required env var ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

const provider = process.env.LLM_PROVIDER ?? "gemini";
if (provider !== "gemini" && provider !== "openrouter") {
  throw new Error(`Invalid LLM_PROVIDER "${provider}". Use "gemini" or "openrouter".`);
}

// Per-provider model defaults; override with AGENT_MODEL / SYNTH_MODEL.
const defaults =
  provider === "openrouter"
    ? { agent: "google/gemini-2.5-flash", synth: "anthropic/claude-sonnet-4-6" }
    : { agent: "gemini-2.5-flash", synth: "gemini-2.5-pro" };

export const config = {
  provider,
  // Only the active provider's key is required.
  geminiApiKey: provider === "gemini" ? required("GEMINI_API_KEY") : "",
  openrouterApiKey: provider === "openrouter" ? required("OPENROUTER_API_KEY") : "",
  agentModel: process.env.AGENT_MODEL ?? defaults.agent,
  synthModel: process.env.SYNTH_MODEL ?? defaults.synth,
  port: Number(process.env.PORT ?? 8787),
  // Hard cap on agent tool-calling iterations, to bound cost.
  maxAgentSteps: Number(process.env.MAX_AGENT_STEPS ?? 25),
};
