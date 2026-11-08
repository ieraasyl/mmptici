import { expect, test } from "vite-plus/test";
import type { DashboardData, DashboardChecklistResult } from "./cqa";
import {
  checklistOptions,
  checklistVersionKey,
  criterionKey,
  dashboardExplanations,
  dashboardFailures,
  failureExplanation,
  dashboardView,
  selectDashboardRows,
  sortDashboardConversations,
} from "./dashboard";

function savedRun(id: string, revision: number, createdAt: string): DashboardChecklistResult {
  return {
    id: "conversation-a",
    sourceId: "chat-a",
    group: "DEV",
    channel: "agent chat",
    language: "EN",
    pendingAppeals: 0,
    evaluation: {
      id,
      createdAt,
      checklistId: "checklist-a",
      checklistName: `Checklist name at v${revision}`,
      revision,
      model: "test-model",
      origin: "live",
      total: 75,
      seriousViolation: false,
      criteria: [],
      failures: [],
    },
  };
}

const first = savedRun("11111111-first", 1, "2026-11-07T17:00:00.000Z");
const second = savedRun("22222222-second", 2, "2026-11-07T17:00:10.000Z");
const third = savedRun("33333333-third", 2, "2026-11-07T17:00:20.000Z");
const data: DashboardData = {
  conversations: [
    { ...third, pendingAppeals: 1 },
    { ...third, id: "conversation-b", sourceId: "chat-b", evaluation: null },
  ],
  checklistResults: [first, third],
};

test("checklist choices preserve each saved revision and its original name", () => {
  expect(checklistOptions(data.checklistResults)).toEqual([
    { value: "", label: "All checklists" },
    { value: "checklist-a:1", label: "Checklist name at v1 · v1 · checklis" },
    { value: "checklist-a:2", label: "Checklist name at v2 · v2 · checklis" },
  ]);
});

test("selects historical checklist results even after a newer revision was evaluated", () => {
  expect(selectDashboardRows(data, checklistVersionKey(first.evaluation))[0]).toEqual(first);
  expect(selectDashboardRows(data, checklistVersionKey(second.evaluation))[0]).toEqual(third);
});

test("default view retains unevaluated conversations and conversation-wide appeal counts", () => {
  expect(selectDashboardRows(data, "")).toEqual(data.conversations);
});

test("keeps different checklists with the same revision separate", () => {
  const other = {
    ...third,
    evaluation: { ...third.evaluation, checklistId: "checklist-b" },
  };
  const combined = { ...data, checklistResults: [first, third, other] };
  expect(checklistOptions(combined.checklistResults)).toHaveLength(4);
  expect(selectDashboardRows(combined, "checklist-b:2")[0]).toEqual(other);
  expect(
    selectDashboardRows(combined, "checklist-a:3").every((row) => row.evaluation === null),
  ).toBe(true);
});

test("checklist coverage includes conversations without a run of that version", () => {
  const selected = selectDashboardRows(data, "checklist-a:1");
  expect(selected).toHaveLength(2);
  expect(selected.filter((row) => row.evaluation)).toHaveLength(1);
  expect(selected[1]).toMatchObject({ id: "conversation-b", evaluation: null, pendingAppeals: 0 });
  const neverEvaluated = selectDashboardRows(data, "checklist-b:1");
  expect(neverEvaluated).toHaveLength(2);
  expect(neverEvaluated.every((row) => row.evaluation === null && row.pendingAppeals === 0)).toBe(
    true,
  );
});

function scoredConversation(
  id: string,
  verification: "yes" | "no" | "na",
  guidance: number,
  violation = false,
) {
  const row = savedRun(id, 1, first.evaluation.createdAt);
  row.id = `conversation-${id}`;
  row.evaluation.seriousViolation = violation;
  row.evaluation.criteria = [
    {
      criterionId: "verification",
      title: "Verification",
      kind: "binary",
      weight: 20,
      answer: verification,
      points: verification === "na" ? null : verification === "yes" ? 20 : 0,
    },
    {
      criterionId: "guidance",
      title: "Guidance",
      kind: "numeric",
      weight: 20,
      answer: guidance,
      points: guidance,
    },
    {
      criterionId: "violations",
      title: "Serious violations",
      kind: "flag",
      weight: 0,
      answer: violation ? "yes" : "no",
      points: null,
    },
  ];
  row.evaluation.failures = row.evaluation.criteria.flatMap((item) => {
    const failed =
      item.kind === "flag"
        ? item.answer === "yes"
        : item.answer === "no" || (typeof item.answer === "number" && item.answer < 20);
    return failed
      ? [
          {
            criterionId: item.criterionId,
            title: item.title,
            kind: item.kind,
            answer: item.answer,
            weight: item.weight,
            lost: item.kind === "flag" ? null : item.weight - (item.points ?? 0),
            reviewed: false,
            explanation: "Supporting evidence.",
            model: { answer: item.answer, explanation: "Supporting evidence." },
            evidence: [],
          },
        ]
      : [];
  });
  return row;
}

const scored = [
  scoredConversation("a", "no", 15, true),
  scoredConversation("b", "yes", 20),
  scoredConversation("c", "na", 20),
];
const noResultFilters = { criterion: "", violation: "", reviewOnly: false };

test("investigating a criterion keeps the overview's denominator and averages stable", () => {
  const overview = dashboardView(scored, noResultFilters);
  const selected = dashboardView(scored, {
    ...noResultFilters,
    criterion: criterionKey(scored[0].evaluation, "verification"),
  });
  expect(selected.results).toEqual([scored[0]]);
  expect(selected.breakdown).toEqual(overview.breakdown);
  expect(selected.breakdown.find(({ id }) => id === "verification")).toMatchObject({
    applied: 2,
    na: 1,
    points: 20,
    belowFullScore: 1,
  });
  expect(selected.breakdown.find(({ id }) => id === "guidance")).toMatchObject({
    applied: 3,
    points: 55,
    belowFullScore: 1,
  });
});

test("serious violations filter results separately from the scored criteria", () => {
  const overview = dashboardView(scored, noResultFilters);
  const flagged = dashboardView(scored, { ...noResultFilters, violation: "yes" });
  expect(flagged.results).toEqual([scored[0]]);
  expect(flagged.breakdown).toEqual(overview.breakdown);
  expect(flagged.breakdown.map(({ id }) => id)).toEqual(["verification", "guidance"]);
  expect(dashboardView(scored, { ...noResultFilters, violation: "no" }).results).toEqual(
    scored.slice(1),
  );
});

test("criterion investigation stays within its checklist revision", () => {
  const revised = scoredConversation("d", "no", 20);
  revised.evaluation.revision = 2;
  const rows = [...scored, revised];
  const selected = dashboardView(rows, {
    ...noResultFilters,
    criterion: criterionKey(scored[0].evaluation, "verification"),
  });
  expect(selected.results).toEqual([scored[0]]);
  expect(selected.breakdown.filter(({ id }) => id === "verification")).toHaveLength(2);
});

test("criterion percentages use available weight and applicable conversations, ordered lowest first", () => {
  const { breakdown } = dashboardView(scored, noResultFilters);
  expect(breakdown[0]).toMatchObject({ id: "verification", average: 50, belowFullScoreRate: 50 });
  expect(breakdown[1].average).toBeCloseTo((55 / 60) * 100);
  expect(breakdown[1].belowFullScoreRate).toBeCloseTo(100 / 3);

  const lighter = scoredConversation("lighter", "yes", 15);
  lighter.evaluation.criteria[0].weight = 5;
  lighter.evaluation.criteria[0].points = 5;
  const weighted = dashboardView([lighter], noResultFilters).breakdown;
  expect(weighted.map(({ id }) => id)).toEqual(["guidance", "verification"]);
  expect(weighted.map(({ average }) => average)).toEqual([75, 100]);
});

test("all-N/A and unweighted criteria have no numeric average or fabricated loss rate", () => {
  const na = scoredConversation("na", "na", 20);
  const rows = dashboardView([na], noResultFilters).breakdown;
  expect(rows.at(-1)).toMatchObject({
    id: "verification",
    average: null,
    belowFullScoreRate: null,
    na: 1,
  });
  na.evaluation.criteria[1].weight = 0;
  na.evaluation.criteria[1].points = 0;
  expect(dashboardView([na], noResultFilters).breakdown.every((row) => row.average === null)).toBe(
    true,
  );
});

test("review sorting prioritizes flagged conversations and appeals, then score, with N/A last", () => {
  const low = scoredConversation("low", "no", 5);
  low.evaluation.total = 20;
  const flagged = scoredConversation("flagged", "yes", 20, true);
  flagged.evaluation.total = 90;
  const appealed = { ...scoredConversation("appealed", "yes", 20), pendingAppeals: 1 };
  appealed.evaluation.total = 80;
  const noScore = { ...low, id: "no-score", evaluation: { ...low.evaluation, total: null } };
  expect(
    sortDashboardConversations([low, flagged, noScore, appealed], "review").map(({ id }) => id),
  ).toEqual([appealed.id, flagged.id, low.id, noScore.id]);
  expect(sortDashboardConversations([noScore, low, flagged], "desc").map(({ id }) => id)).toEqual([
    flagged.id,
    low.id,
    noScore.id,
  ]);
  expect(
    dashboardView([low, flagged, appealed], { ...noResultFilters, appealOnly: true }).results,
  ).toEqual([appealed]);
});

test("evidence stays with the selected criterion and checklist revision", () => {
  const key = criterionKey(scored[0].evaluation, "verification");
  expect(dashboardFailures(scored[0], key).map(({ criterionId }) => criterionId)).toEqual([
    "verification",
  ]);
  const revised = { ...scored[0], evaluation: { ...scored[0].evaluation, revision: 2 } };
  expect(dashboardFailures(revised, key)).toEqual([]);
  expect(dashboardFailures(scored[0])).toHaveLength(3);
  expect(dashboardFailures({ ...scored[0], evaluation: null })).toEqual([]);
});

test("reviewed failures show the reviewer's reason and keep the model's original verdict", () => {
  const [failure] = dashboardFailures(scored[0]);
  expect(failureExplanation(failure)).toEqual({
    label: "Model's explanation",
    text: "Supporting evidence.",
    original: null,
  });
  const reviewed = {
    ...failure,
    reviewed: true,
    answer: "no" as const,
    explanation: "Agent never verified the account.",
    model: { answer: "yes" as const, explanation: "Agent asked for the account number." },
  };
  expect(failureExplanation(reviewed)).toEqual({
    label: "Reviewer decision",
    text: "Agent never verified the account.",
    original: { answer: "yes", explanation: "Agent asked for the account number." },
  });
});

test("explanations list serious-violation flags or the selected criterion's failures", () => {
  const off = { criterion: "", seriousViolations: false };
  expect(dashboardExplanations(scored, off)).toBeNull();

  const flagged = dashboardExplanations(scored, { ...off, seriousViolations: true });
  expect(flagged?.map(({ conversation }) => conversation.id)).toEqual([scored[0].id]);
  expect(flagged?.[0].failures.map(({ criterionId }) => criterionId)).toEqual(["violations"]);

  const key = criterionKey(scored[0].evaluation, "guidance");
  const byCriterion = dashboardExplanations(scored, { criterion: key, seriousViolations: true });
  expect(byCriterion?.map(({ conversation }) => conversation.id)).toEqual([scored[0].id]);
  expect(byCriterion?.[0].failures.map(({ criterionId }) => criterionId)).toEqual(["guidance"]);
  expect(dashboardExplanations([scored[1]], { criterion: key, seriousViolations: false })).toEqual(
    [],
  );
});
