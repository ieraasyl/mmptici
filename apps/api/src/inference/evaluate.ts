import type { Checklist, Rating } from "@app/contracts";
import { EmptyReplyError, type ChatMessage, type LlmClient, type ModelUsage } from "./client.ts";
import { buildPrompt, type ConversationInput } from "./prompt.ts";
import { extractJson, validateRatings } from "./validate.ts";

/** After a reply is cut off at the token limit, the next attempt gets this much more room. */
const TOKEN_BUDGET_GROWTH = 1.5;
const MAX_TOKEN_BUDGET = 16_000;

export type Attempt = {
  raw: string;
  errors: string[];
  warnings: string[];
};

export type EvaluationRun = {
  ratings: Rating[];
  model: string;
  /** Summed over all attempts, for cost reporting. */
  usage: ModelUsage;
  attempts: Attempt[];
};

export class EvaluationError extends Error {
  readonly attempts: Attempt[];

  constructor(message: string, attempts: Attempt[]) {
    super(message);
    this.name = "EvaluationError";
    this.attempts = attempts;
  }
}

function retryMessage(errors: string[]) {
  return [
    "Your answer has these problems:",
    ...errors.map((error) => `- ${error}`),
    "",
    "Return the complete corrected JSON for all criteria, in the same format. JSON only.",
  ].join("\n");
}

/**
 * Builds the prompt from the conversation and checklist, asks the model, checks the reply
 * against the checklist, and retries with the list of problems when the reply is unusable.
 */
export async function evaluateConversation(
  llm: LlmClient,
  conversation: ConversationInput,
  checklist: Checklist,
  options: { maxRetries?: number; signal?: AbortSignal } = {},
): Promise<EvaluationRun> {
  const messages: ChatMessage[] = buildPrompt(conversation, checklist);
  const attempts: Attempt[] = [];
  const usage: ModelUsage = { promptTokens: 0, completionTokens: 0 };
  const addUsage = (used?: ModelUsage) => {
    usage.promptTokens += used?.promptTokens ?? 0;
    usage.completionTokens += used?.completionTokens ?? 0;
  };
  const maxAttempts = 1 + (options.maxRetries ?? 1);
  let maxTokens = llm.maxTokens;

  for (let i = 0; i < maxAttempts; i++) {
    options.signal?.throwIfAborted();

    let reply;
    try {
      reply = await llm.complete(messages, { signal: options.signal, maxTokens });
    } catch (cause) {
      // Only an empty reply is worth retrying. API errors (e.g. a bad token), network
      // failures, and cancellation stop the evaluation right away.
      if (!(cause instanceof EmptyReplyError)) throw cause;
      addUsage(cause.usage);
      attempts.push({ raw: "", errors: [cause.message], warnings: [] });
      if (cause.hitTokenLimit && maxTokens) {
        maxTokens = Math.min(Math.round(maxTokens * TOKEN_BUDGET_GROWTH), MAX_TOKEN_BUDGET);
      }
      continue;
    }
    addUsage(reply.usage);

    let result;
    try {
      result = validateRatings(
        extractJson(reply.content),
        checklist,
        conversation.transcript.length,
      );
    } catch (cause) {
      result = { ratings: [], warnings: [], errors: [`Invalid JSON: ${(cause as Error).message}`] };
    }
    attempts.push({ raw: reply.content, errors: result.errors, warnings: result.warnings });

    if (result.errors.length === 0) {
      return { ratings: result.ratings, model: reply.model, usage, attempts };
    }

    messages.push({ role: "assistant", content: reply.content });
    messages.push({ role: "user", content: retryMessage(result.errors) });
  }

  const allEmpty = attempts.every((attempt) => attempt.raw === "");
  throw new EvaluationError(
    allEmpty
      ? `The model returned no answer in ${attempts.length} attempt(s): ${attempts.at(-1)?.errors[0]}`
      : "The model did not return a valid evaluation.",
    attempts,
  );
}
