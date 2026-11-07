import type { DashboardData, DashboardChecklistResult, DashboardConversation } from "./cqa";

export function checklistVersionKey(evaluation: DashboardChecklistResult["evaluation"]) {
  return `${evaluation.checklistId}:${evaluation.revision}`;
}

export function checklistOptions(results: DashboardChecklistResult[]) {
  const versions = new Map<string, { value: string; label: string }>();
  for (const { evaluation } of results) {
    const value = checklistVersionKey(evaluation);
    if (!versions.has(value)) {
      versions.set(value, {
        value,
        label: `${evaluation.checklistName} · v${evaluation.revision} · ${evaluation.checklistId.slice(0, 8)}`,
      });
    }
  }
  return [{ value: "", label: "All checklists" }, ...versions.values()];
}

export function selectDashboardRows(data: DashboardData, checklist: string) {
  if (!checklist) return data.conversations;
  const results = new Map(
    data.checklistResults
      .filter((row) => checklistVersionKey(row.evaluation) === checklist)
      .map((row) => [row.id, row]),
  );
  return data.conversations.map(
    (row) => results.get(row.id) ?? { ...row, evaluation: null, pendingAppeals: 0 },
  );
}

export function criterionKey(
  evaluation: DashboardChecklistResult["evaluation"],
  criterionId: string,
) {
  return `${checklistVersionKey(evaluation)}:${criterionId}`;
}

function criterionBreakdown(conversations: DashboardConversation[]) {
  type Row = {
    key: string;
    id: string;
    checklistLabel: string;
    title: string;
    weight: number;
    applied: number;
    na: number;
    points: number;
    belowFullScore: number;
  };
  const rows = new Map<string, Row>();
  for (const { evaluation } of conversations) {
    if (!evaluation) continue;
    const failures = new Set(evaluation.failures.map(({ criterionId }) => criterionId));
    for (const item of evaluation.criteria) {
      if (item.kind === "flag") continue;
      const key = criterionKey(evaluation, item.criterionId);
      const row = rows.get(key) ?? {
        key,
        id: item.criterionId,
        checklistLabel: `${evaluation.checklistName} · v${evaluation.revision}`,
        title: item.title,
        weight: item.weight,
        applied: 0,
        na: 0,
        points: 0,
        belowFullScore: 0,
      };
      if (item.answer === "na") row.na += 1;
      else {
        row.applied += 1;
        row.points += item.points ?? 0;
        if (failures.has(item.criterionId)) row.belowFullScore += 1;
      }
      rows.set(key, row);
    }
  }
  return [...rows.values()]
    .map((row) => ({
      ...row,
      average:
        row.applied && row.weight > 0 ? (row.points / (row.applied * row.weight)) * 100 : null,
      belowFullScoreRate: row.applied ? (row.belowFullScore / row.applied) * 100 : null,
    }))
    .toSorted((a, b) => {
      if (a.average === null || b.average === null) {
        return (
          Number(a.average === null) - Number(b.average === null) || a.title.localeCompare(b.title)
        );
      }
      return (
        a.average - b.average ||
        b.belowFullScore - a.belowFullScore ||
        a.title.localeCompare(b.title)
      );
    });
}

export function dashboardFailures(conversation: DashboardConversation, criterion = "") {
  const { evaluation } = conversation;
  if (!evaluation) return [];
  return evaluation.failures.filter(
    ({ criterionId }) => !criterion || criterionKey(evaluation, criterionId) === criterion,
  );
}

export function sortDashboardConversations(conversations: DashboardConversation[], sort: string) {
  return conversations.toSorted((a, b) => {
    const byDate =
      (b.evaluation?.createdAt ?? "").localeCompare(a.evaluation?.createdAt ?? "") ||
      (b.evaluation?.id ?? "").localeCompare(a.evaluation?.id ?? "");
    if (sort === "latest") return byDate;
    if (sort === "review") {
      const attention = (row: DashboardConversation) =>
        Number(!!row.evaluation?.seriousViolation) + Number(row.pendingAppeals > 0);
      const priority = attention(b) - attention(a);
      if (priority) return priority;
    }
    const left = a.evaluation?.total ?? null;
    const right = b.evaluation?.total ?? null;
    if (left === null || right === null) {
      return Number(left === null) - Number(right === null) || byDate;
    }
    return (sort === "desc" ? right - left : left - right) || byDate;
  });
}

function filterDashboardResults(
  conversations: DashboardConversation[],
  {
    criterion,
    violation,
    reviewOnly,
    appealOnly,
  }: { criterion: string; violation: string; reviewOnly: boolean; appealOnly?: boolean },
) {
  return conversations.filter(({ evaluation, pendingAppeals }) => {
    if (!evaluation) return false;
    if (reviewOnly && !evaluation.seriousViolation && !pendingAppeals) return false;
    if (appealOnly && !pendingAppeals) return false;
    if (violation && evaluation.seriousViolation !== (violation === "yes")) return false;
    return (
      !criterion ||
      evaluation.failures.some(
        ({ criterionId }) => criterionKey(evaluation, criterionId) === criterion,
      )
    );
  });
}

export function dashboardView(
  conversations: DashboardConversation[],
  filters: Parameters<typeof filterDashboardResults>[1],
) {
  return {
    breakdown: criterionBreakdown(conversations),
    results: filterDashboardResults(conversations, filters),
  };
}
