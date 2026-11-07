// Pure helpers for run.ts: dialog selection, sample aggregation, cost, retry, concurrency.
// Kept free of I/O so they can be unit-tested.

import { createHash } from "node:crypto";

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
