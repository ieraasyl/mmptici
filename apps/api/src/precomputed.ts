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

export async function importPrecomputed(
  db: ReturnType<typeof createDb>,
  workspaceId: string,
  group: string,
  checklist: Checklist,
  data: PrecomputedEvaluations,
) {
  const scope = and(
    eq(cqaConversations.workspaceId, workspaceId),
    eq(cqaConversations.group, group),
  );
  const conversations = await db
    .select({
      id: cqaConversations.id,
      sourceId: cqaConversations.sourceId,
      transcript: cqaConversations.transcript,
    })
    .from(cqaConversations)
    .where(scope);
  const existing = await db
    .select({ conversationId: cqaEvaluations.conversationId, model: cqaEvaluations.model })
    .from(cqaEvaluations)
    .innerJoin(cqaConversations, eq(cqaEvaluations.conversationId, cqaConversations.id))
    .where(scope);
  const done = new Set(existing.map(({ conversationId, model }) => `${conversationId}\n${model}`));
  const bySource = new Map(
    conversations.map((conversation) => [conversation.sourceId, conversation]),
  );

  // Keep the file's order: later entries get later timestamps, so the last model is the "latest" one.
  const start = Date.now() - data.evaluations.length;
  const rows = [];
  let skipped = 0;
  for (const [index, item] of data.evaluations.entries()) {
    const conversation = bySource.get(item.conversation_id);
    if (!conversation || done.has(`${conversation.id}\n${item.model}`)) {
      skipped += 1;
      continue;
    }
    checkRatings(checklist, item.ratings, conversation.transcript);
    rows.push(
      db.insert(cqaEvaluations).values({
        id: crypto.randomUUID(),
        conversationId: conversation.id,
        checklist,
        ratings: item.ratings,
        model: item.model,
        createdAt: new Date(start + index),
      }),
    );
  }
  for (let from = 0; from < rows.length; from += 25) {
    const [first, ...rest] = rows.slice(from, from + 25);
    await db.batch([first, ...rest]);
  }
  return { imported: rows.length, skipped };
}
