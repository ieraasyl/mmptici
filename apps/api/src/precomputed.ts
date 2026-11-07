import {
  answerOptions,
  type Checklist,
  type PrecomputedEvaluations,
  type Rating,
  type Turn,
} from "@app/contracts";
import { and, eq, type createDb } from "@app/db";
import { cqaConversations, cqaEvaluations } from "@app/db/schema";

// Evaluations that were produced outside the app (other models, hand scoring) and ship with the DEV data,
// so they can be browsed without re-running the model. See data/evaluations-dev.json.
//
// A bundled score is attached only to a conversation in the DEV group whose transcript is the one it
// was produced from, and only under the checklist it was produced with. Each (workspace, conversation,
// model) gets a deterministic evaluation ID, so repeated or concurrent imports insert nothing twice.

export const PRECOMPUTED_GROUP = "DEV";

/** Throws when a stored rating does not fit the checklist or the transcript it cites. */
export function checkRatings(checklist: Checklist, ratings: Rating[], transcript: readonly Turn[]) {
  const byId = new Map(ratings.map((rating) => [rating.criterionId, rating]));
  if (byId.size !== ratings.length || byId.size !== checklist.criteria.length)
    throw new Error("Ratings must cover each criterion exactly once.");
  for (const criterion of checklist.criteria) {
    const rating = byId.get(criterion.id);
    if (!rating) throw new Error(`Missing rating for ${criterion.id}.`);
    if (!answerOptions(criterion).includes(rating.answer))
      throw new Error(`${criterion.id}: answer ${rating.answer} is not allowed.`);
    if (rating.evidence.some((number) => number > transcript.length))
      throw new Error(`${criterion.id}: evidence points past the end of the transcript.`);
  }
}

/** A UUID-shaped ID derived from its parts, the same on every import. */
export async function precomputedEvaluationId(
  workspaceId: string,
  conversationId: string,
  model: string,
): Promise<string> {
  const bytes = new TextEncoder().encode(
    ["precomputed", workspaceId, conversationId, model].join("\0"),
  );
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const hex = Array.from(hash.subarray(0, 16), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export type PrecomputedTarget = {
  id: string;
  group: string;
  sourceId: string;
  transcript: Turn[];
};

export type PrecomputedMismatch = { conversation_id: string; model: string; reason: string };

export type PrecomputedPlan = {
  rows: { conversationId: string; model: string; ratings: Rating[]; createdAt: Date }[];
  /** Bundled entries that were not attached, with the reason. */
  mismatched: PrecomputedMismatch[];
  /** Entries whose conversation is not in the workspace. */
  skipped: number;
};

function sameTranscript(a: readonly Turn[], b: readonly Turn[]) {
  return (
    a.length === b.length &&
    a.every(
      (turn, index) =>
        turn.speaker === b[index].speaker &&
        turn.text === b[index].text &&
        turn.timestamp === b[index].timestamp,
    )
  );
}

/**
 * Decides which bundled evaluations may be attached. `sources` holds the transcripts the bundled
 * scores were produced from, keyed by conversation ID; a workspace conversation gets a score only
 * when it is in the DEV group and its transcript equals that source.
 */
export function planPrecomputedImport(input: {
  checklist: Checklist;
  data: PrecomputedEvaluations;
  conversations: readonly PrecomputedTarget[];
  sources: ReadonlyMap<string, readonly Turn[]>;
  now?: number;
}): PrecomputedPlan {
  const { checklist, data } = input;
  if (data.checklistId !== checklist.id) {
    throw new Error(
      `The bundled evaluations were made with checklist ${data.checklistId}, not ${checklist.id}.`,
    );
  }
  const targets = new Map(
    input.conversations
      .filter((conversation) => conversation.group === PRECOMPUTED_GROUP)
      .map((conversation) => [conversation.sourceId, conversation]),
  );
  // Keep the file's order: later entries get later timestamps, so the last model is the "latest" one.
  const start = (input.now ?? Date.now()) - data.evaluations.length;
  const plan: PrecomputedPlan = { rows: [], mismatched: [], skipped: 0 };
  for (const [index, item] of data.evaluations.entries()) {
    const target = targets.get(item.conversation_id);
    if (!target) {
      plan.skipped += 1;
      continue;
    }
    const source = input.sources.get(item.conversation_id);
    const reject = (reason: string) =>
      plan.mismatched.push({ conversation_id: item.conversation_id, model: item.model, reason });
    if (!source) {
      reject("The bundled dataset has no transcript for this conversation.");
      continue;
    }
    if (!sameTranscript(target.transcript, source)) {
      reject(
        "The transcript in this workspace differs from the one the scores were produced from.",
      );
      continue;
    }
    try {
      checkRatings(checklist, item.ratings, target.transcript);
    } catch (error) {
      reject(error instanceof Error ? error.message : String(error));
      continue;
    }
    plan.rows.push({
      conversationId: target.id,
      model: item.model,
      ratings: item.ratings,
      createdAt: new Date(start + index),
    });
  }
  return plan;
}

export async function importPrecomputed(
  db: ReturnType<typeof createDb>,
  workspaceId: string,
  checklist: Checklist,
  data: PrecomputedEvaluations,
  sources: ReadonlyMap<string, readonly Turn[]>,
) {
  const conversations = await db
    .select({
      id: cqaConversations.id,
      group: cqaConversations.group,
      sourceId: cqaConversations.sourceId,
      transcript: cqaConversations.transcript,
    })
    .from(cqaConversations)
    .where(
      and(
        eq(cqaConversations.workspaceId, workspaceId),
        eq(cqaConversations.group, PRECOMPUTED_GROUP),
      ),
    );
  const plan = planPrecomputedImport({ checklist, data, conversations, sources });

  const rows = await Promise.all(
    plan.rows.map(async (row) => ({
      ...row,
      id: await precomputedEvaluationId(workspaceId, row.conversationId, row.model),
    })),
  );
  let imported = 0;
  for (let from = 0; from < rows.length; from += 25) {
    const [first, ...rest] = rows
      .slice(from, from + 25)
      .map(({ id, conversationId, model, ratings, createdAt }) =>
        db
          .insert(cqaEvaluations)
          .values({ id, conversationId, checklist, ratings, model, origin: "imported", createdAt })
          .onConflictDoNothing()
          .returning({ id: cqaEvaluations.id }),
      );
    const results = await db.batch([first, ...rest]);
    imported += results.reduce((count, inserted) => count + inserted.length, 0);
  }
  return {
    imported,
    // Entries that were already present count as skipped, like a repeated dataset import.
    skipped: plan.skipped + (rows.length - imported),
    mismatched: plan.mismatched,
  };
}
