// Helpers for run.ts: dialog selection, sample aggregation, cost and request accounting,
// retry, concurrency, and evaluation of one dialog. The model client is passed in and no
// files are read here, so tests can use a fake client.

import { createHash } from "node:crypto";
import { scoreEvaluation } from "../../apps/api/src/evaluation.ts";
import {
  evaluateConversation,
  EvaluationError,
  type ConversationInput,
  type LlmClient,
  type ModelUsage,
} from "../../apps/api/src/inference/index.ts";
import type { Checklist } from "../../packages/contracts/src/cqa.ts";

export type Answer = "yes" | "no" | "na" | number;

export type SampleRating = {
  criterionId: string;
  answer: Answer;
  explanation: string;
  evidence: number[];
};

export type AggregatedRating = SampleRating & {
  confidence: number;
  votes: Answer[];
};

export type Sets = { tuning: string[]; heldout: string[] };

/** Cerebras list price for Qwen3.8-27B, USD per million tokens. */
export const PRICE_PER_M = { input: 0.99, output: 1.49 };

export function costUsd(usage: { promptTokens: number; completionTokens: number }): number {
  return (
    (usage.promptTokens * PRICE_PER_M.input + usage.completionTokens * PRICE_PER_M.output) / 1e6
  );
}

/**
 * Resolves --set into conversation IDs: tuning, heldout, all20 (both), dev (every DEV dialog
 * except held-out), all (every DEV dialog), or comma-separated IDs. Held-out dialogs are
 * refused unless a frozen prompt version is given, so they cannot leak into prompt tuning.
 */
export function selectIds(spec: string, sets: Sets, allIds: string[], frozen?: string): string[] {
  const heldout = new Set(sets.heldout);
  let ids: string[];
  if (spec === "tuning") ids = sets.tuning;
  else if (spec === "dev") ids = allIds.filter((id) => !heldout.has(id));
  else if (spec === "heldout") ids = sets.heldout;
  else if (spec === "all20") ids = [...sets.tuning, ...sets.heldout];
  else if (spec === "all") ids = allIds;
  else {
    ids = spec
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    const known = new Set(allIds);
    const unknown = ids.filter((id) => !known.has(id));
    if (unknown.length) throw new Error(`Unknown conversation IDs: ${unknown.join(", ")}`);
  }
  if (!frozen && ids.some((id) => heldout.has(id))) {
    throw new Error(
      "This selection includes held-out dialogs. Pass --frozen <prompt-version> once the prompt is frozen.",
    );
  }
  return ids;
}

/**
 * Interim vote: plurality per criterion, ties go to the earliest valid sample.
 * Confidence is winning votes divided by requested samples, so failed samples lower it.
 * Replaced by vote.ts (ML C) once it lands.
 */
export function aggregate(
  samples: (SampleRating[] | null)[],
  criterionIds: string[],
): AggregatedRating[] | null {
  const valid = samples.filter((s): s is SampleRating[] => s !== null);
  if (valid.length === 0) return null;

  return criterionIds.map((criterionId) => {
    const picks = valid.map((sample) => sample.find((r) => r.criterionId === criterionId)!);
    const votes = picks.map((r) => r.answer);
    const counts = new Map<string, number>();
    for (const vote of votes) counts.set(String(vote), (counts.get(String(vote)) ?? 0) + 1);
    const best = Math.max(...counts.values());
    const winner = picks.find((r) => counts.get(String(r.answer)) === best)!;
    return { ...winner, confidence: best / samples.length, votes };
  });
}

export function isRetryable(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /Inference API error (429|5\d\d)|TimeoutError|AbortError|fetch failed|ECONNRESET/i.test(
    message,
  );
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { tries?: number; baseMs?: number; retryable?: (error: unknown) => boolean } = {},
): Promise<T> {
  const tries = options.tries ?? 4;
  const baseMs = options.baseMs ?? 1000;
  const retryable = options.retryable ?? isRetryable;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= tries || !retryable(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, baseMs * 2 ** (attempt - 1)));
    }
  }
}

/** Runs fn over items with at most `limit` in flight; results keep input order. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Short content hash used as the prompt version when none is given. */
export function contentVersion(...parts: string[]): string {
  const hash = createHash("sha256");
  for (const part of parts) hash.update(part);
  return `p-${hash.digest("hex").slice(0, 8)}`;
}

/** Token and request accounting for one or more evaluations. */
export type Accounting = {
  /** Requests sent to the model, including ones that failed before a reply. */
  requests: number;
  /** Replies received, whether or not they passed validation. */
  responses: number;
  /** Replies that passed validation and produced ratings. */
  parsedResponses: number;
  /** Replies that reported no token usage; when above 0, usage and cost are lower bounds. */
  responsesWithoutUsage: number;
  usage: ModelUsage;
  costUsd: number;
};

export function emptyAccounting(): Accounting {
  return {
    requests: 0,
    responses: 0,
    parsedResponses: 0,
    responsesWithoutUsage: 0,
    usage: { promptTokens: 0, completionTokens: 0 },
    costUsd: 0,
  };
}

export function sumAccounting(items: Accounting[]): Accounting {
  const sum = emptyAccounting();
  for (const a of items) {
    sum.requests += a.requests;
    sum.responses += a.responses;
    sum.parsedResponses += a.parsedResponses;
    sum.responsesWithoutUsage += a.responsesWithoutUsage;
    sum.usage.promptTokens += a.usage.promptTokens;
    sum.usage.completionTokens += a.usage.completionTokens;
  }
  sum.costUsd = costUsd(sum.usage);
  return sum;
}

/**
 * Wraps a client so every request and reply is counted, including replies that later fail
 * validation and attempts that end in a transient error and are retried.
 */
export function meteredClient(llm: LlmClient): { client: LlmClient; accounting: Accounting } {
  const accounting = emptyAccounting();
  const client: LlmClient = {
    model: llm.model,
    async complete(messages, signal) {
      accounting.requests++;
      const reply = await llm.complete(messages, signal);
      accounting.responses++;
      if (reply.usage) {
        accounting.usage.promptTokens += reply.usage.promptTokens;
        accounting.usage.completionTokens += reply.usage.completionTokens;
      } else accounting.responsesWithoutUsage++;
      accounting.costUsd = costUsd(accounting.usage);
      return reply;
    },
  };
  return { client, accounting };
}

export type Pass = Accounting & { latencyMs: number; failedSamples: number; errors: string[] };

/**
 * Accounting kept on each dialog. The totals cover every pass over the dialog, so rerunning
 * a failed dialog keeps the cost of the failed attempts; latency, failed samples, and errors
 * describe the latest pass.
 */
export type DialogRun = Pass & { passes: Pass[] };

export function dialogRun(passes: Pass[]): DialogRun {
  const latest = passes.at(-1)!;
  return {
    ...sumAccounting(passes),
    latencyMs: latest.latencyMs,
    failedSamples: latest.failedSamples,
    errors: latest.errors,
    passes,
  };
}

/** Passes recorded on a dialog, including run files written before passes were kept. */
export function priorPasses(run: Record<string, any> | null | undefined): Pass[] {
  if (!run) return [];
  if (Array.isArray(run.passes)) return run.passes;
  // Older files counted replies as calls and saved zero usage for failed samples, so a
  // failed dialog's replies are counted as replies without usage.
  const calls = run.calls ?? 0;
  const usage = run.usage ?? { promptTokens: 0, completionTokens: 0 };
  const measured = usage.promptTokens + usage.completionTokens > 0;
  return [
    {
      requests: calls,
      responses: calls,
      parsedResponses: 0,
      responsesWithoutUsage: measured ? 0 : calls,
      usage,
      costUsd: run.costUsd ?? 0,
      latencyMs: run.latencyMs ?? 0,
      failedSamples: run.failedSamples ?? 0,
      errors: run.errors ?? [],
    },
  ];
}

export type BatchRecord = ConversationInput & { conversation_id: string; language: string };

type SampleResult = { ratings: SampleRating[] | null; accounting: Accounting; errors: string[] };

export type BatchOptions = {
  llm: LlmClient;
  checklist: Checklist;
  samples: number;
  retry?: { tries?: number; baseMs?: number };
};

async function sample(record: BatchRecord, options: BatchOptions): Promise<SampleResult> {
  const { client, accounting } = meteredClient(options.llm);
  try {
    const run = await withRetry(
      () => evaluateConversation(client, record, options.checklist),
      options.retry,
    );
    accounting.parsedResponses++;
    return { ratings: run.ratings as SampleRating[], accounting, errors: [] };
  } catch (error) {
    const attempts = error instanceof EvaluationError ? error.attempts : [];
    return {
      ratings: null,
      accounting,
      errors: attempts.length
        ? attempts.flatMap((a) => a.errors)
        : [error instanceof Error ? error.message : String(error)],
    };
  }
}

/** Evaluates one dialog with the app's evaluator and scorer; earlier passes are kept. */
export async function evaluateDialog(
  record: BatchRecord & { channel: string },
  options: BatchOptions,
  previous: Pass[] = [],
) {
  const t0 = Date.now();
  const results = await Promise.all(
    Array.from({ length: options.samples }, () => sample(record, options)),
  );
  const latencyMs = Date.now() - t0;
  const criterionIds = options.checklist.criteria.map((c) => c.id);
  const ratings = aggregate(
    results.map((r) => r.ratings),
    criterionIds,
  );
  const scored = ratings ? scoreEvaluation(options.checklist, ratings, []) : null;
  const pass: Pass = {
    ...sumAccounting(results.map((r) => r.accounting)),
    latencyMs,
    failedSamples: results.filter((r) => r.ratings === null).length,
    errors: results.flatMap((r) => r.errors),
  };
  return {
    conversationId: record.conversation_id,
    language: record.language,
    channel: record.channel,
    ratings: ratings ?? [],
    total: scored?.total ?? null,
    seriousViolation: scored?.seriousViolation ?? null,
    run: dialogRun([...previous, pass]),
  };
}

/**
 * Checks the prompt fingerprint computed from the current code. A --frozen version must match
 * it, and a run being resumed must have been made with it.
 */
export function checkPromptVersion(
  current: string,
  options: { frozen?: string; prior?: { promptVersion: string }; priorPath?: string },
) {
  if (options.frozen !== undefined && options.frozen !== current) {
    throw new Error(
      `--frozen ${options.frozen} does not match the current prompt version ${current}. ` +
        "The prompt, validation, evaluator, client, or checklist changed since it was frozen.",
    );
  }
  if (options.prior && options.prior.promptVersion !== current) {
    throw new Error(
      `${options.priorPath ?? "The run"} was made with prompt ${options.prior.promptVersion}, ` +
        `but the current prompt is ${current}. Start a new run instead.`,
    );
  }
}
