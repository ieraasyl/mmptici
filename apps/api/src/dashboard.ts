import { asc, createDb, desc, eq } from "@app/db";
import { cqaAppeals, cqaConversations, cqaEvaluations } from "@app/db/schema";
import { scoreEvaluation } from "./evaluation.ts";

export async function readDashboard(db: ReturnType<typeof createDb>, workspaceId: string) {
  const [rows, appeals] = await Promise.all([
    db
      .select({
        id: cqaConversations.id,
        sourceId: cqaConversations.sourceId,
        group: cqaConversations.group,
        language: cqaConversations.language,
        channel: cqaConversations.channel,
        transcript: cqaConversations.transcript,
        evaluation: cqaEvaluations,
      })
      .from(cqaConversations)
      .leftJoin(cqaEvaluations, eq(cqaEvaluations.conversationId, cqaConversations.id))
      .where(eq(cqaConversations.workspaceId, workspaceId))
      .orderBy(
        asc(cqaConversations.group),
        asc(cqaConversations.sourceId),
        desc(cqaEvaluations.createdAt),
        desc(cqaEvaluations.id),
      ),
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

  // The dashboard needs the latest result per conversation and checklist revision.
  // Older individual runs remain available on the conversation's history page.
  const seenVersions = new Set<string>();
  const latestRows = rows.filter(({ id, evaluation }) => {
    if (!evaluation) return true;
    const key = `${id}:${evaluation.checklist.id}:${evaluation.checklist.revision}`;
    if (seenVersions.has(key)) return false;
    seenVersions.add(key);
    return true;
  });
  const summaries = latestRows.map(({ evaluation, transcript, ...conversation }) => {
    const summary = {
      ...conversation,
      pendingAppeals: pendingByConversation.get(conversation.id) ?? 0,
    };
    if (!evaluation) return { ...summary, evaluation: null };
    const evaluationAppeals = byEvaluation.get(evaluation.id) ?? [];
    const { total, seriousViolation, criteria } = scoreEvaluation(
      evaluation.checklist,
      evaluation.ratings,
      evaluationAppeals,
    );
    const decisions = new Map(
      evaluationAppeals.flatMap(({ criterionId, decision }) =>
        decision ? [[criterionId, decision] as const] : [],
      ),
    );
    return {
      ...summary,
      evaluation: {
        id: evaluation.id,
        createdAt: evaluation.createdAt,
        checklistId: evaluation.checklist.id,
        checklistName: evaluation.checklist.name,
        revision: evaluation.checklist.revision,
        model: evaluation.model,
        origin: evaluation.origin,
        total,
        seriousViolation,
        criteria: criteria.map(({ criterion, finalAnswer, finalPoints }) => ({
          criterionId: criterion.id,
          title: criterion.title,
          kind: criterion.kind,
          weight: criterion.weight,
          answer: finalAnswer,
          points: finalPoints,
        })),
        failures: criteria
          .filter(isFailure)
          .map(({ criterion, original, finalAnswer, finalPoints }) => {
            const decision = decisions.get(criterion.id) ?? null;
            return {
              criterionId: criterion.id,
              title: criterion.title,
              kind: criterion.kind,
              answer: finalAnswer,
              lost: criterion.kind === "flag" ? null : criterion.weight - (finalPoints ?? 0),
              weight: criterion.weight,
              // The reviewer's reason explains a reviewed verdict; the model's explanation stays under `model`.
              reviewed: decision !== null,
              explanation: decision?.reason ?? original.explanation,
              model: { answer: original.answer, explanation: original.explanation },
              evidence: original.evidence.flatMap((number) => {
                const turn = transcript[number - 1];
                return turn ? [{ number, speaker: turn.speaker, text: turn.text }] : [];
              }),
            };
          }),
      },
    };
  });

  const latest = new Map<string, (typeof summaries)[number]>();
  for (const summary of summaries) {
    if (!latest.has(summary.id)) latest.set(summary.id, summary);
  }
  const checklistResults = summaries.flatMap((summary) =>
    summary.evaluation
      ? [
          {
            ...summary,
            evaluation: summary.evaluation,
            pendingAppeals:
              byEvaluation.get(summary.evaluation.id)?.filter((appeal) => !appeal.decision)
                .length ?? 0,
          },
        ]
      : [],
  );
  return { conversations: [...latest.values()], checklistResults };
}

/** A criterion the operator did not meet: "No", a scale value below the top, or a flagged violation. N/A is not a failure. */
function isFailure({
  criterion,
  finalAnswer,
}: ReturnType<typeof scoreEvaluation>["criteria"][number]) {
  if (finalAnswer === "na") return false;
  if (criterion.kind === "flag") return finalAnswer === "yes";
  if (criterion.kind === "numeric") return finalAnswer !== Math.max(...criterion.scale);
  return finalAnswer === "no";
}
