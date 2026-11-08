import { expect, test } from "vite-plus/test";
import type { Answer, Rating } from "@app/contracts";
import { defaultChecklist } from "./checklist.ts";
import {
  buildResultsFile,
  deriveModelHeader,
  describeResultsIssues,
  RESULT_CODES,
} from "./results-export.ts";

const meta = "ММ.. Птицы";

function ratings(answers: Record<string, Answer>): Rating[] {
  return Object.entries(answers).map(([criterionId, answer]) => ({
    criterionId,
    answer,
    explanation: `Обоснование ${criterionId}.`,
    evidence: [2],
  }));
}

const answers: Record<string, Answer> = {
  opening: "yes",
  understanding: "na",
  verification: "na",
  guidance: 15,
  empathy: "yes",
  management: 7,
  closing: "no",
  violations: "no",
};

test("maps an evaluation onto the appendix format", () => {
  const { file, problems, models } = buildResultsFile(
    [
      {
        sourceId: "p1-ru-001",
        turnCount: 12,
        evaluation: { checklist: defaultChecklist, ratings: ratings(answers), model: "qwen" },
      },
    ],
    meta,
  );
  expect(problems).toEqual([]);
  expect(models).toEqual({ qwen: 1 });
  expect(file).toMatchObject({
    schema_version: "1.0",
    team_name: "ММ.. Птицы",
    model: { mode: "local", name: "qwen" },
  });
  const [entry] = file.results;
  if (entry.status !== "ok") throw new Error("expected ok");
  expect(entry.criteria.map((c) => c.criterion_id)).toEqual(Object.values(RESULT_CODES));
  expect(entry.criteria.map((c) => c.value)).toEqual([true, null, null, 15, true, 7, false, false]);
  expect(entry.criteria[0]).toEqual({
    criterion_id: "contact",
    value: true,
    rationale: "Обоснование opening.",
    evidence_turns: [2],
  });
  // 10 + 15 (15 of 20) + 15 + 10.5 (7 of 10) + 0 = 50.5 of 65 applicable → 77.69
  expect(entry.score).toEqual({ final_score: 77.69, critical_flag: false });
});

test("a serious violation sets critical_flag without changing the total", () => {
  const { file } = buildResultsFile(
    [
      {
        sourceId: "x",
        turnCount: 3,
        evaluation: {
          checklist: defaultChecklist,
          ratings: ratings({ ...answers, violations: "yes" }),
          model: "qwen",
        },
      },
    ],
    meta,
  );
  const [entry] = file.results;
  expect(entry.status === "ok" && entry.score).toEqual({ final_score: 77.69, critical_flag: true });
  expect(entry.status === "ok" && entry.criteria.at(-1)).toMatchObject({
    criterion_id: "critical",
    value: true,
  });
});

test("conversations without an evaluation become error entries, never zeros", () => {
  const { file, problems } = buildResultsFile(
    [{ sourceId: "a", turnCount: 5, evaluation: null }],
    meta,
  );
  expect(problems).toEqual([]);
  expect(file.results).toEqual([
    {
      conversation_id: "a",
      status: "error",
      criteria: [],
      score: null,
      error: "Not evaluated with the selected checklist.",
    },
  ]);
});

test("any checklist exports: default criteria get the appendix codes, others keep their id", () => {
  const custom = {
    ...defaultChecklist,
    criteria: [
      ...defaultChecklist.criteria.filter(({ id }) => id !== "empathy"),
      { ...defaultChecklist.criteria[0], id: "investment_advice" },
    ],
  };
  const { file, problems } = buildResultsFile(
    [
      {
        sourceId: "b",
        turnCount: 5,
        evaluation: {
          checklist: custom,
          ratings: ratings({ ...answers, investment_advice: "no" }),
          model: "qwen",
        },
      },
    ],
    meta,
  );
  expect(problems).toEqual([]);
  const [entry] = file.results;
  if (entry.status !== "ok") throw new Error("expected ok");
  expect(entry.criteria.map((c) => c.criterion_id)).toEqual([
    "contact",
    "discovery",
    "identification",
    "consultation",
    "dialogue",
    "closure",
    "critical",
    "investment_advice",
  ]);
  expect(entry.criteria.at(-1)?.value).toBe(false);
});

test("duplicate IDs and out-of-range evidence are reported as problems", () => {
  const evaluation = { checklist: defaultChecklist, ratings: ratings(answers), model: "qwen" };
  const { problems } = buildResultsFile(
    [
      { sourceId: "same", turnCount: 5, evaluation },
      { sourceId: "same", turnCount: 1, evaluation },
    ],
    meta,
  );
  expect(problems.some((p) => p.includes('"same" appears more than once'))).toBe(true);
  expect(problems.some((p) => p.startsWith("same/contact: evidence outside turns 1–1"))).toBe(true);
});

test("derives the header from the stored models", () => {
  expect(deriveModelHeader([])).toEqual({ mode: "local", modelName: "Qwen/Qwen3.8-27B" });
  expect(deriveModelHeader(["test-model", "test-model"])).toEqual({
    mode: "local",
    modelName: "test-model",
  });
  expect(deriveModelHeader(["Qwen/Qwen3.8-27B:cerebras"])).toEqual({
    mode: "external_api",
    modelName: "Qwen/Qwen3.8-27B:cerebras",
  });
  expect(deriveModelHeader(["b:novita", "a:cerebras"])).toEqual({
    mode: "external_api",
    modelName: "a:cerebras, b:novita",
  });
  expect(deriveModelHeader(["z-local", "a:cerebras"])).toEqual({
    mode: "hybrid",
    modelName: "a:cerebras, z-local",
  });
});

test("names the conversation of each invalid result", () => {
  const results = [
    { conversation_id: "p1-ru-001" },
    { conversation_id: "p1-kz-002" },
  ] as Parameters<typeof describeResultsIssues>[0]["results"];
  expect(
    describeResultsIssues({ results }, [
      { path: ["results", 1, "score"], message: "Expected string" },
      { path: ["model"], message: "Required" },
    ]),
  ).toBe("p1-kz-002: results.1.score: Expected string; model: Required");
});
