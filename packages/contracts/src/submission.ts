import { z } from "zod";
import type { Answer, Checklist, Rating } from "./cqa.ts";

// Results JSON 1.0, the organizers' submission format (CQA_HACKATHON.md, "Results JSON 1.0").
// The format fixes eight criterion IDs and their value sets, so it only fits a checklist that
// still has the default eight criteria. Scores are never taken from the model: the exporter
// passes in the scorer's result and the validator recomputes it.

export const SUBMISSION_SCHEMA_VERSION = "1.0";
export const submissionModes = ["local", "external_api", "hybrid"] as const;

/** One row of the organizers' mapping table, in submission order. */
export type SubmissionCriterion = {
  internalId: string;
  id: string;
  kind: "binary" | "numeric" | "flag";
  weight: number;
  scale: number[];
  allowNA: boolean;
};

export const SUBMISSION_CRITERIA: readonly SubmissionCriterion[] = [
  { internalId: "opening", id: "contact", kind: "binary", weight: 10, scale: [], allowNA: false },
  {
    internalId: "understanding",
    id: "discovery",
    kind: "binary",
    weight: 15,
    scale: [],
    allowNA: true,
  },
  {
    internalId: "verification",
    id: "identification",
    kind: "binary",
    weight: 20,
    scale: [],
    allowNA: true,
  },
  {
    internalId: "guidance",
    id: "consultation",
    kind: "numeric",
    weight: 20,
    scale: [0, 5, 10, 15, 20],
    allowNA: true,
  },
  { internalId: "empathy", id: "empathy", kind: "binary", weight: 15, scale: [], allowNA: false },
  {
    internalId: "management",
    id: "dialogue",
    kind: "numeric",
    weight: 15,
    scale: [0, 4, 7, 10],
    allowNA: false,
  },
  { internalId: "closing", id: "closure", kind: "binary", weight: 5, scale: [], allowNA: true },
  { internalId: "violations", id: "critical", kind: "flag", weight: 0, scale: [], allowNA: false },
];

export const submissionCriterionIds = SUBMISSION_CRITERIA.map(({ id }) => id);
const bySubmissionId = new Map(SUBMISSION_CRITERIA.map((c) => [c.id, c]));
const byInternalId = new Map(SUBMISSION_CRITERIA.map((c) => [c.internalId, c]));

const rationale = z.string().trim().min(1);
const evidenceTurns = z.array(z.number().int().positive()).min(1);
const yesNo = z.boolean();
const yesNoNa = z.union([z.boolean(), z.null()]);
const consultation = z.union([
  z.literal(0),
  z.literal(5),
  z.literal(10),
  z.literal(15),
  z.literal(20),
  z.null(),
]);
const dialogue = z.union([z.literal(0), z.literal(4), z.literal(7), z.literal(10)]);

/** The value set the format allows for each criterion: booleans for Yes/No, numbers for scales, null for N/A. */
export const submissionValueSchemas = {
  contact: yesNo,
  discovery: yesNoNa,
  identification: yesNoNa,
  consultation,
  empathy: yesNo,
  dialogue,
  closure: yesNoNa,
  critical: yesNo,
} as const;

const criterionResult = <Id extends string, Value extends z.ZodType>(id: Id, value: Value) =>
  z.object({ criterion_id: z.literal(id), value, rationale, evidence_turns: evidenceTurns });

export const submissionCriterionSchema = z.discriminatedUnion("criterion_id", [
  criterionResult("contact", submissionValueSchemas.contact),
  criterionResult("discovery", submissionValueSchemas.discovery),
  criterionResult("identification", submissionValueSchemas.identification),
  criterionResult("consultation", submissionValueSchemas.consultation),
  criterionResult("empathy", submissionValueSchemas.empathy),
  criterionResult("dialogue", submissionValueSchemas.dialogue),
  criterionResult("closure", submissionValueSchemas.closure),
  criterionResult("critical", submissionValueSchemas.critical),
]);

export const submissionScoreSchema = z.object({
  final_score: z.number().min(0).max(100),
  critical_flag: z.boolean(),
});

export const submissionOkResultSchema = z
  .object({
    conversation_id: z.string().min(1),
    status: z.literal("ok"),
    criteria: z.array(submissionCriterionSchema),
    score: submissionScoreSchema,
  })
  .superRefine((result, ctx) => {
    const seen = new Map<string, number>();
    for (const { criterion_id } of result.criteria) {
      seen.set(criterion_id, (seen.get(criterion_id) ?? 0) + 1);
    }
    for (const id of submissionCriterionIds) {
      const count = seen.get(id) ?? 0;
      if (count !== 1) {
        ctx.addIssue({
          code: "custom",
          path: ["criteria"],
          message: `criterion ${id} must appear exactly once (found ${count})`,
        });
      }
    }
    const critical = result.criteria.find(({ criterion_id }) => criterion_id === "critical");
    if (critical && result.score.critical_flag !== critical.value) {
      ctx.addIssue({
        code: "custom",
        path: ["score", "critical_flag"],
        message: "critical_flag must equal the value of the critical criterion",
      });
    }
    const cents = Math.round(result.score.final_score * 100);
    if (Math.abs(result.score.final_score * 100 - cents) > 1e-6) {
      ctx.addIssue({
        code: "custom",
        path: ["score", "final_score"],
        message: "final_score must be rounded to two decimals",
      });
    }
  });

export const submissionErrorResultSchema = z.object({
  conversation_id: z.string().min(1),
  status: z.literal("error"),
  criteria: z.array(z.never()).max(0),
  score: z.null(),
  error: z.string().trim().min(1),
});

export const submissionResultSchema = z.discriminatedUnion("status", [
  submissionOkResultSchema,
  submissionErrorResultSchema,
]);

export const submissionFileSchema = z.object({
  schema_version: z.literal(SUBMISSION_SCHEMA_VERSION),
  team_name: z.string().trim().min(1),
  model: z.object({ mode: z.enum(submissionModes), name: z.string().trim().min(1) }),
  results: z.array(submissionResultSchema),
});

export type SubmissionCriterionResult = z.infer<typeof submissionCriterionSchema>;
export type SubmissionOkResult = z.infer<typeof submissionOkResultSchema>;
export type SubmissionErrorResult = z.infer<typeof submissionErrorResultSchema>;
export type SubmissionResult = z.infer<typeof submissionResultSchema>;
export type SubmissionFile = z.infer<typeof submissionFileSchema>;
export type SubmissionValue = SubmissionCriterionResult["value"];

/**
 * Why a checklist cannot be exported in the fixed eight-criterion format. Empty when it still
 * has the default criteria with their kinds, scales, N/A rules, and weights; the wording may differ.
 */
export function submissionChecklistIssues(checklist: Pick<Checklist, "criteria">): string[] {
  const issues: string[] = [];
  const present = new Map(checklist.criteria.map((c) => [c.id, c]));
  for (const expected of SUBMISSION_CRITERIA) {
    const actual = present.get(expected.internalId);
    if (!actual) {
      issues.push(`criterion ${expected.internalId} (${expected.id}) is missing`);
      continue;
    }
    if (actual.kind !== expected.kind)
      issues.push(`${expected.internalId}: kind ${actual.kind}, expected ${expected.kind}`);
    if (actual.allowNA !== expected.allowNA)
      issues.push(
        `${expected.internalId}: N/A ${actual.allowNA ? "allowed" : "not allowed"}, expected the opposite`,
      );
    if (actual.weight !== expected.weight)
      issues.push(`${expected.internalId}: weight ${actual.weight}, expected ${expected.weight}`);
    if (actual.scale.join(",") !== expected.scale.join(","))
      issues.push(
        `${expected.internalId}: scale [${actual.scale.join(", ")}], expected [${expected.scale.join(", ")}]`,
      );
  }
  for (const { id } of checklist.criteria) {
    if (!byInternalId.has(id)) issues.push(`criterion ${id} has no place in the submission format`);
  }
  return issues;
}

/** Converts an internal answer to the format's value. Throws when the answer is not allowed. */
export function toSubmissionValue(criterionId: string, answer: Answer): SubmissionValue {
  const schema = submissionValueSchemas[criterionId as keyof typeof submissionValueSchemas];
  if (!schema) throw new Error(`Unknown submission criterion ${criterionId}`);
  const value: unknown =
    answer === "yes" ? true : answer === "no" ? false : answer === "na" ? null : answer;
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new Error(
      `${criterionId}: answer ${String(answer)} is not allowed in the submission format`,
    );
  return parsed.data as SubmissionValue;
}

/** Converts a format value back to the internal answer used by the scorer. */
export function fromSubmissionValue(value: SubmissionValue): Answer {
  if (value === null) return "na";
  if (typeof value === "boolean") return value ? "yes" : "no";
  return value;
}

/** The eight criteria in submission order, built from internal ratings. Throws on a bad set. */
export function toSubmissionCriteria(
  checklist: Pick<Checklist, "criteria">,
  ratings: readonly Rating[],
): SubmissionCriterionResult[] {
  const issues = submissionChecklistIssues(checklist);
  if (issues.length)
    throw new Error(`Checklist does not fit the submission format: ${issues.join("; ")}`);
  const byCriterion = new Map<string, Rating>();
  for (const rating of ratings) {
    if (byCriterion.has(rating.criterionId))
      throw new Error(`Rating for ${rating.criterionId} appears more than once`);
    byCriterion.set(rating.criterionId, rating);
  }
  return SUBMISSION_CRITERIA.map((criterion) => {
    const rating = byCriterion.get(criterion.internalId);
    if (!rating) throw new Error(`Rating for ${criterion.internalId} is missing`);
    const rationale = rating.explanation.trim();
    if (!rationale) throw new Error(`${criterion.internalId}: the rationale is empty`);
    if (!rating.evidence.length) throw new Error(`${criterion.internalId}: no evidence turns`);
    return {
      criterion_id: criterion.id,
      value: toSubmissionValue(criterion.id, rating.answer),
      rationale,
      evidence_turns: [...rating.evidence],
    } as SubmissionCriterionResult;
  });
}

/** Internal ratings rebuilt from a submission result, for rescoring with the app's scorer. */
export function toInternalRatings(criteria: readonly SubmissionCriterionResult[]): Rating[] {
  return criteria.map((item) => ({
    criterionId: bySubmissionId.get(item.criterion_id)!.internalId,
    answer: fromSubmissionValue(item.value),
    explanation: item.rationale,
    evidence: [...item.evidence_turns],
  }));
}

/**
 * One successful result. `score` comes from the app's scorer (`scoreEvaluation`), never from
 * the model. A null total (no applicable weighted criteria) cannot be expressed and throws.
 */
export function buildSubmissionResult(input: {
  conversationId: string;
  checklist: Pick<Checklist, "criteria">;
  ratings: readonly Rating[];
  score: { total: number | null; seriousViolation: boolean };
}): SubmissionOkResult {
  const criteria = toSubmissionCriteria(input.checklist, input.ratings);
  if (input.score.total === null)
    throw new Error(
      `${input.conversationId}: no applicable criteria carry weight, so there is no total`,
    );
  return submissionOkResultSchema.parse({
    conversation_id: input.conversationId,
    status: "ok",
    criteria,
    score: { final_score: input.score.total, critical_flag: input.score.seriousViolation },
  });
}

export function buildSubmissionError(conversationId: string, error: string): SubmissionErrorResult {
  return submissionErrorResultSchema.parse({
    conversation_id: conversationId,
    status: "error",
    criteria: [],
    score: null,
    error: error.trim() || "The evaluation failed without a message.",
  });
}
