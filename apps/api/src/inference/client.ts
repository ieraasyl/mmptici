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

/**
 * The provider answered with an HTTP error, e.g. 401 for a bad token. The client retries
 * rate limits and server errors (see `isTransient`) before throwing one of these.
 */
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

  /** A rate limit or a server error, which may pass if the request is sent again. */
  get isTransient() {
    return this.status === 429 || this.status >= 500;
  }
}

/** Waits before each retry of a rate-limited or failed request. Two retries in about 8 s. */
export const DEFAULT_RETRY_DELAYS_MS = [2_000, 6_000];
/** A Retry-After header is honoured up to this long. */
const MAX_RETRY_AFTER_MS = 10_000;

function retryAfterMs(res: Response): number | undefined {
  const seconds = Number(res.headers.get("retry-after"));
  return Number.isFinite(seconds) && seconds > 0
    ? Math.min(seconds * 1000, MAX_RETRY_AFTER_MS)
    : undefined;
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal!.reason);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
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
  /** Delays before retrying a 429 or 5xx reply. Defaults to DEFAULT_RETRY_DELAYS_MS; [] disables retries. */
  retryDelaysMs?: readonly number[];
};

export function createHfClient(options: HfClientOptions): LlmClient {
  const model = options.model || DEFAULT_MODEL;
  const defaultMaxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;

  return {
    model,
    maxTokens: defaultMaxTokens,
    async complete(messages, { signal, maxTokens = defaultMaxTokens } = {}) {
      const body = JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature: options.temperature ?? 0,
      });
      const delays = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
      let res: Response;
      for (let attempt = 0; ; attempt++) {
        // Each attempt gets its own timeout, and also stops when the caller cancels.
        const timeout = AbortSignal.timeout(options.timeoutMs ?? 90_000);
        res = await fetch(HF_ROUTER_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            "Content-Type": "application/json",
          },
          body,
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        });
        if (res.ok) break;
        const error = new InferenceApiError(res.status, await res.text());
        if (!error.isTransient || attempt >= delays.length) throw error;
        await sleep(retryAfterMs(res) ?? delays[attempt]!, signal);
      }

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
