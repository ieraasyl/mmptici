// LLM client for the Hugging Face Inference Providers router (OpenAI-compatible).
// The ":cerebras" suffix in the model name picks Cerebras as the provider.

export const HF_ROUTER_URL = "https://router.huggingface.co/v1/chat/completions";
export const DEFAULT_MODEL = "Qwen/Qwen3.8-27B:cerebras";
/** Qwen is a reasoning model: below ~6000 the answer can be cut off inside its reasoning. */
export const DEFAULT_MAX_TOKENS = 16_000;

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

export type CompleteOptions = {
  signal?: AbortSignal;
  /** Overrides the client's output token budget for this call. */
  maxTokens?: number;
};

/** Anything that can answer a chat. The app uses Hugging Face; tests plug in a fake. */
export interface LlmClient {
  readonly model: string;
  /** Default output token budget, if the client has one. */
  readonly maxTokens?: number;
  complete(messages: ChatMessage[], options?: CompleteOptions): Promise<ModelReply>;
}

/** The provider answered with an HTTP error, e.g. 401 for a bad token. Not retried. */
export class InferenceApiError extends Error {
  readonly status: number;

  constructor(status: number, body: string) {
    super(`Inference API error ${status}: ${body.slice(0, 300)}`);
    this.name = "InferenceApiError";
    this.status = status;
  }

  get isAuthError() {
    return this.status === 401 || this.status === 403;
  }
}

/**
 * The provider answered, but with no text. With finish_reason "length" the model used its
 * whole token budget on reasoning before writing the answer. The evaluator retries these.
 */
export class EmptyReplyError extends Error {
  readonly finishReason: string | undefined;
  readonly maxTokens: number | undefined;
  readonly usage: ModelUsage | undefined;

  constructor(finishReason: string | undefined, maxTokens?: number, usage?: ModelUsage) {
    super(
      finishReason === "length"
        ? `The reply was cut off at the ${maxTokens ?? "max"} token limit before the answer.`
        : "The model returned an empty reply.",
    );
    this.name = "EmptyReplyError";
    this.finishReason = finishReason;
    this.maxTokens = maxTokens;
    this.usage = usage;
  }

  get hitTokenLimit() {
    return this.finishReason === "length";
  }
}

export type HfClientOptions = {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
};

export function createHfClient(options: HfClientOptions): LlmClient {
  const model = options.model || DEFAULT_MODEL;
  const defaultMaxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;

  return {
    model,
    maxTokens: defaultMaxTokens,
    async complete(messages, { signal, maxTokens = defaultMaxTokens } = {}) {
      // Always keep the timeout, and also stop when the caller cancels.
      const timeout = AbortSignal.timeout(options.timeoutMs ?? 90_000);
      const res = await fetch(HF_ROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: maxTokens,
          temperature: options.temperature ?? 0,
        }),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });

      if (!res.ok) throw new InferenceApiError(res.status, await res.text());

      const data = (await res.json()) as {
        choices?: { finish_reason?: string; message?: { content?: string | null } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const usage = data.usage && {
        promptTokens: data.usage.prompt_tokens ?? 0,
        completionTokens: data.usage.completion_tokens ?? 0,
      };
      const choice = data.choices?.[0];
      const content = choice?.message?.content;
      if (!content?.trim()) throw new EmptyReplyError(choice?.finish_reason, maxTokens, usage);

      return { content, model, usage };
    },
  };
}
