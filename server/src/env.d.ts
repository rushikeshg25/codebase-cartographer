// Typed environment variables for the server. Augments process.env so config
// reads are checked and autocompleted.
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      LLM_PROVIDER?: "gemini" | "openrouter";
      GEMINI_API_KEY?: string;
      OPENROUTER_API_KEY?: string;
      AGENT_MODEL?: string;
      SYNTH_MODEL?: string;
      PORT?: string;
      MAX_AGENT_STEPS?: string;
    }
  }
}

export {};
