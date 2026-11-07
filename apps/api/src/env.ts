import type { Ai, D1Database } from "@cloudflare/workers-types";
import type { LlmClient } from "./inference/client.ts";

export type Bindings = {
  DB: D1Database;
  AI?: Ai;
  /** Hugging Face token for the evaluation model (secret). */
  HF_TOKEN?: string;
  /** Optional model override, e.g. "openai/gpt-oss-120b:cerebras". */
  CQA_MODEL?: string;
  /** Test hook: replaces the Hugging Face client. Never set in production. */
  LLM?: LlmClient;
};
