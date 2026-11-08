import { describe, expect, test } from "vite-plus/test";
import { defaultChecklist } from "../../apps/api/src/checklist.ts";
import { scoreEvaluation } from "../../apps/api/src/evaluation.ts";
import {
  buildSubmissionError,
  buildSubmissionResult,
  fromSubmissionValue,
  submissionChecklistIssues,
  submissionFileSchema,
  submissionOkResultSchema,
  SUBMISSION_CRITERIA,
  toInternalRatings,
  toSubmissionCriteria,
  toSubmissionValue,
  type Answer,
  type Rating,
} from "../../packages/contracts/src/index.ts";

const answers = (values: Answer[]): Rating[] =>
  defaultChecklist.criteria.map(({ id }, index) => ({
    criterionId: id,
    answer: values[index],
    explanation: `${id} explained`,
    evidence: [1, 2],
  }));

const allYes: Answer[] = ["yes", "yes", "yes", 20, "yes", 10, "yes", "no"];

function okResult(values: Answer[], conversationId = "p1-ru-001") {
  const ratings = answers(values);
  return buildSubmissionResult({
    conversationId,
    checklist: defaultChecklist,
    ratings,
    score: scoreEvaluation(defaultChecklist, ratings, []),
  });
}

describe("value mapping", () => {
  test("every permitted answer type maps and round-trips", () => {
    expect(toSubmissionValue("contact", "yes")).toBe(true);
    expect(toSubmissionValue("contact", "no")).toBe(false);
    expect(toSubmissionValue("discovery", "na")).toBeNull();
    expect(toSubmissionValue("consultation", 15)).toBe(15);
    expect(toSubmissionValue("consultation", "na")).toBeNull();
    expect(toSubmissionValue("dialogue", 7)).toBe(7);
    expect(toSubmissionValue("critical", "yes")).toBe(true);
    for (const value of [true, false, null, 15, 7] as const) {
      expect(
        toSubmissionValue(
          value === null
            ? "closure"
            : typeof value === "boolean"
              ? "empathy"
              : value === 15
                ? "consultation"
                : "dialogue",
          fromSubmissionValue(value),
        ),
      ).toBe(value);
    }
  });

  test("N/A is rejected for contact, empathy, dialogue, and critical", () => {
    for (const id of ["contact", "empathy", "dialogue", "critical"]) {
      expect(() => toSubmissionValue(id, "na")).toThrow(/not allowed/);
    }
  });

  test("scale values outside the organizer steps are rejected", () => {
    expect(() => toSubmissionValue("consultation", 12)).toThrow(/not allowed/);
    expect(() => toSubmissionValue("dialogue", 5)).toThrow(/not allowed/);
    expect(() => toSubmissionValue("dialogue", "yes")).toThrow(/not allowed/);
  });
});

describe("schema", () => {
  test("string booleans and string numbers are rejected", () => {
    const result = okResult(allYes);
    const criteria = result.criteria.map((item) =>
      item.criterion_id === "contact" ? { ...item, value: "true" } : item,
    );
    expect(submissionOkResultSchema.safeParse({ ...result, criteria }).success).toBe(false);
    const numeric = result.criteria.map((item) =>
      item.criterion_id === "dialogue" ? { ...item, value: "7" } : item,
    );
    expect(submissionOkResultSchema.safeParse({ ...result, criteria: numeric }).success).toBe(
      false,
    );
  });

  test("missing, duplicated, and extra criteria are rejected", () => {
    const result = okResult(allYes);
    const missing = { ...result, criteria: result.criteria.slice(1) };
    expect(submissionOkResultSchema.safeParse(missing).success).toBe(false);
    const duplicated = { ...result, criteria: [...result.criteria, result.criteria[0]] };
    expect(submissionOkResultSchema.safeParse(duplicated).success).toBe(false);
    const extra = {
      ...result,
      criteria: [...result.criteria, { ...result.criteria[0], criterion_id: "tone" }],
    };
    expect(submissionOkResultSchema.safeParse(extra).success).toBe(false);
  });

  test("evidence must be positive integers and rationales nonempty", () => {
    const result = okResult(allYes);
    for (const bad of [[0], [-1], [1.5], []]) {
      const criteria = result.criteria.map((item) =>
        item.criterion_id === "closure" ? { ...item, evidence_turns: bad } : item,
      );
      expect(submissionOkResultSchema.safeParse({ ...result, criteria }).success).toBe(false);
    }
    const blank = result.criteria.map((item) =>
      item.criterion_id === "closure" ? { ...item, rationale: "  " } : item,
    );
    expect(submissionOkResultSchema.safeParse({ ...result, criteria: blank }).success).toBe(false);
  });

  test("critical_flag must match the critical value and never zeroes the score", () => {
    const flagged = okResult(["yes", "yes", "yes", 20, "yes", 10, "yes", "yes"]);
    expect(flagged.score).toEqual({ final_score: 100, critical_flag: true });
    const inconsistent = { ...flagged, score: { ...flagged.score, critical_flag: false } };
    expect(submissionOkResultSchema.safeParse(inconsistent).success).toBe(false);
  });

  test("a failure row is valid and needs a nonempty error", () => {
    const row = buildSubmissionError("p1-ru-002", "The model did not return an evaluation.");
    expect(row).toEqual({
      conversation_id: "p1-ru-002",
      status: "error",
      criteria: [],
      score: null,
      error: "The model did not return an evaluation.",
    });
    const file = {
      schema_version: "1.0",
      team_name: "mmptici",
      model: { mode: "external_api", name: "Qwen/Qwen3.8-27B:cerebras" },
      results: [row, okResult(allYes)],
    };
    expect(submissionFileSchema.safeParse(file).success).toBe(true);
    expect(
      submissionFileSchema.safeParse({ ...file, results: [{ ...row, error: "" }] }).success,
    ).toBe(false);
    expect(submissionFileSchema.safeParse({ ...file, schema_version: "1.1" }).success).toBe(false);
    expect(submissionFileSchema.safeParse({ ...file, team_name: " " }).success).toBe(false);
    expect(
      submissionFileSchema.safeParse({ ...file, model: { mode: "cloud", name: "x" } }).success,
    ).toBe(false);
  });
});

describe("scoring through the format", () => {
  test("N/A redistributes weight and the total survives the round trip", () => {
    const result = okResult(["yes", "na", "na", 15, "yes", 7, "na", "no"]);
    expect(result.score.final_score).toBe(84.17);
    const rescored = scoreEvaluation(defaultChecklist, toInternalRatings(result.criteria), []);
    expect(rescored.total).toBe(84.17);
    expect(result.criteria.map(({ value }) => value)).toEqual([
      true,
      null,
      null,
      15,
      true,
      7,
      null,
      false,
    ]);
  });

  test("half-up rounding: 50.625 becomes 50.63", () => {
    // 15 + 10.5 + 15 earned of 80 applicable weight = 0.50625.
    const result = okResult(["no", "na", "no", 15, "yes", 7, "na", "no"]);
    expect(result.score.final_score).toBe(50.63);
  });

  test("a result with no total cannot be built", () => {
    expect(() => okResult(["yes", "na", "na", "na", "yes", 10, "na", "no"])).not.toThrow();
    const checklist = { criteria: defaultChecklist.criteria.map((c) => ({ ...c })) };
    expect(() =>
      buildSubmissionResult({
        conversationId: "x",
        checklist,
        ratings: answers(allYes),
        score: { total: null, seriousViolation: false },
      }),
    ).toThrow(/no total/);
  });
});

describe("checklist compatibility", () => {
  test("the default checklist fits and every row keeps its submission order", () => {
    expect(submissionChecklistIssues(defaultChecklist)).toEqual([]);
    expect(SUBMISSION_CRITERIA.map(({ id }) => id)).toEqual([
      "contact",
      "discovery",
      "identification",
      "consultation",
      "empathy",
      "dialogue",
      "closure",
      "critical",
    ]);
  });

  test("a replaced, reweighted, or renamed criterion is rejected", () => {
    const replaced = {
      criteria: defaultChecklist.criteria.map((c) =>
        c.id === "closing" ? { ...c, id: "tone", title: "Tone of voice" } : c,
      ),
    };
    expect(submissionChecklistIssues(replaced)).toEqual([
      "criterion closing (closure) is missing",
      "criterion tone has no place in the submission format",
    ]);
    const reweighted = {
      criteria: defaultChecklist.criteria.map((c) =>
        c.id === "opening" ? { ...c, weight: 20 } : c,
      ),
    };
    expect(submissionChecklistIssues(reweighted)).toEqual(["opening: weight 20, expected 10"]);
    const rescaled = {
      criteria: defaultChecklist.criteria.map((c) =>
        c.id === "management" ? { ...c, scale: [0, 5, 10], allowNA: true } : c,
      ),
    };
    expect(submissionChecklistIssues(rescaled)).toHaveLength(2);
    expect(() => toSubmissionCriteria(replaced, answers(allYes))).toThrow(/does not fit/);
  });

  test("duplicate or missing ratings are rejected", () => {
    const ratings = answers(allYes);
    expect(() => toSubmissionCriteria(defaultChecklist, [...ratings, ratings[0]])).toThrow(
      /more than once/,
    );
    expect(() => toSubmissionCriteria(defaultChecklist, ratings.slice(1))).toThrow(/missing/);
  });
});
