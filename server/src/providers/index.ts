import { config } from "../config.js";
import { GeminiProvider } from "./gemini.js";
import { OpenRouterProvider } from "./openrouter.js";
import type { LlmProvider } from "./types.js";

let cached: LlmProvider | null = null;

/** Return the configured LLM provider (singleton). */
export function getProvider(): LlmProvider {
  if (cached) return cached;
  cached = config.provider === "openrouter" ? new OpenRouterProvider() : new GeminiProvider();
  return cached;
}

export type { LlmProvider } from "./types.js";
