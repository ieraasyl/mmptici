import { asc, createDb, desc, eq } from "@app/db";
import { cqaAppeals, cqaConversations, cqaEvaluations } from "@app/db/schema";
import { scoreEvaluation } from "./evaluation.ts";

export async function readDashboard(db: ReturnType<typeof createDb>, workspaceId: string) {
  const latest = db
    .select({ id: cqaEvaluations.id })
    .from(cqaEvaluations)
    .where(eq(cqaEvaluations.conversationId, cqaConversations.id))
    .orderBy(desc(cqaEvaluations.createdAt), desc(cqaEvaluations.id))
    .limit(1);

  const [rows, appeals] = await Promise.all([
    db
      .select({
        id: cqaConversations.id,
        sourceId: cqaConversations.sourceId,
        group: cqaConversations.group,
        language: cqaConversations.language,
        channel: cqaConversations.channel,
        evaluation: cqaEvaluations,
      })
      .from(cqaConversations)
      .leftJoin(cqaEvaluations, eq(cqaEvaluations.id, latest))
      .where(eq(cqaConversations.workspaceId, workspaceId))
      .orderBy(asc(cqaConversations.group), asc(cqaConversations.sourceId)),
    db
      .select({
        conversationId: cqaEvaluations.conversationId,
        evaluationId: cqaAppeals.evaluationId,
        criterionId: cqaAppeals.criterionId,
        decision: cqaAppeals.decision,
      })
      .from(cqaAppeals)
      .innerJoin(cqaEvaluations, eq(cqaAppeals.evaluationId, cqaEvaluations.id))
      .innerJoin(cqaConversations, eq(cqaEvaluations.conversationId, cqaConversations.id))
      .where(eq(cqaConversations.workspaceId, workspaceId)),
  ]);

  const byEvaluation = new Map<string, typeof appeals>();
  const pendingByConversation = new Map<string, number>();
  for (const appeal of appeals) {
    const items = byEvaluation.get(appeal.evaluationId) ?? [];
    items.push(appeal);
    byEvaluation.set(appeal.evaluationId, items);
    if (!appeal.decision) {
      pendingByConversation.set(
        appeal.conversationId,
        (pendingByConversation.get(appeal.conversationId) ?? 0) + 1,
      );
    }
  }

  return rows.map(({ evaluation, ...conversation }) => {
    const summary = {
      ...conversation,
      pendingAppeals: pendingByConversation.get(conversation.id) ?? 0,
    };
    if (!evaluation) return { ...summary, evaluation: null };
    const { total, seriousViolation } = scoreEvaluation(
      evaluation.checklist,
      evaluation.ratings,
      byEvaluation.get(evaluation.id) ?? [],
    );
    return {
      ...summary,
      evaluation: {
        id: evaluation.id,
        createdAt: evaluation.createdAt,
        checklistName: evaluation.checklist.name,
        revision: evaluation.checklist.revision,
        total,
        seriousViolation,
      },
    };
  });
}
