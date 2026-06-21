import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required env var ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

export const config = {
  geminiApiKey: required("GEMINI_API_KEY"),
  agentModel: process.env.AGENT_MODEL ?? "gemini-2.5-flash",
  synthModel: process.env.SYNTH_MODEL ?? "gemini-2.5-pro",
  port: Number(process.env.PORT ?? 8787),
  // Hard cap on agent tool-calling iterations, to bound cost.
  maxAgentSteps: Number(process.env.MAX_AGENT_STEPS ?? 25),
};
