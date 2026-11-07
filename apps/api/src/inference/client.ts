// LLM client for the Hugging Face Inference Providers router (OpenAI-compatible).
// The ":cerebras" suffix in the model name picks Cerebras as the provider.

export const HF_ROUTER_URL = "https://router.huggingface.co/v1/chat/completions";
export const DEFAULT_MODEL = "Qwen/Qwen3.8-27B:cerebras";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ModelUsage = {
  promptTokens: number;
  completionTokens: number;
};

export type ModelReply = {
  content: string;
  model: string;
  usage?: ModelUsage;
};

/** Anything that can answer a chat. The app uses Hugging Face; tests plug in a fake. */
export interface LlmClient {
  readonly model: string;
  complete(messages: ChatMessage[], signal?: AbortSignal): Promise<ModelReply>;
}

export type HfClientOptions = {
  apiKey: string;
  model?: string;
  /** Qwen is a reasoning model: below ~6000 the answer can be cut off inside its reasoning. */
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
};

export function createHfClient(options: HfClientOptions): LlmClient {
  const model = options.model || DEFAULT_MODEL;

  return {
    model,
    async complete(messages, signal) {
      const res = await fetch(HF_ROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: options.maxTokens ?? 8000,
          temperature: options.temperature ?? 0,
        }),
        signal: signal ?? AbortSignal.timeout(options.timeoutMs ?? 90_000),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Inference API error ${res.status}: ${body.slice(0, 300)}`);
      }

      const data = (await res.json()) as {
        choices?: { finish_reason?: string; message?: { content?: string | null } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const choice = data.choices?.[0];
      const content = choice?.message?.content;
      if (!content) {
        const reason = choice?.finish_reason === "length" ? " (hit max_tokens)" : "";
        throw new Error(`Inference API returned an empty answer${reason}.`);
      }

      return {
        content,
        model,
        usage: data.usage && {
          promptTokens: data.usage.prompt_tokens ?? 0,
          completionTokens: data.usage.completion_tokens ?? 0,
        },
      };
    },
  };
}
