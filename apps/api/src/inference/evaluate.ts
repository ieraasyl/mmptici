import type { Checklist, Rating } from "@app/contracts";
import type { ChatMessage, LlmClient, ModelUsage } from "./client.ts";
import { buildPrompt, type ConversationInput } from "./prompt.ts";
import { extractJson, validateRatings } from "./validate.ts";

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
  const maxAttempts = 1 + (options.maxRetries ?? 1);

  for (let i = 0; i < maxAttempts; i++) {
    const reply = await llm.complete(messages, options.signal);
    usage.promptTokens += reply.usage?.promptTokens ?? 0;
    usage.completionTokens += reply.usage?.completionTokens ?? 0;

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

  throw new EvaluationError("The model did not return a valid evaluation.", attempts);
}
