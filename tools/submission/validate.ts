// Checks a Results JSON 1.0 file against the organizer dataset it was produced from.
//
//   vp run submission:validate --input <organizer-json> --results <results-json> --dataset dev|prod
//
// dev expects the 65 DEV records, prod the 10 control records. Every input ID must appear in
// the results exactly once, evidence turns must exist in the transcript, and every score is
// recomputed with the app's scorer. Exit status 1 for an invalid submission, 2 for usage.

import { readFileSync } from "node:fs";
import { defaultChecklist } from "../../apps/api/src/checklist.ts";
import { scoreEvaluation } from "../../apps/api/src/evaluation.ts";
import {
  datasetFileSchema,
  submissionFileSchema,
  toInternalRatings,
  type ConversationRecord,
} from "../../packages/contracts/src/index.ts";
import { parseCli, required, runMain, UsageError, type Io } from "../calibrate/cli.ts";

export const EXPECTED_RECORDS = { dev: 65, prod: 10 } as const;
export type DatasetName = keyof typeof EXPECTED_RECORDS;

export type Issue = { conversationId?: string; field?: string; message: string };

export type Validation = {
  ok: boolean;
  issues: Issue[];
  counts: { input: number; ok: number; error: number };
};

export function parseDataset(value: unknown): ConversationRecord[] {
  const parsed = datasetFileSchema.safeParse(value);
  if (!parsed.success) {
    throw new UsageError(
      `the input is not an organizer dataset: ${parsed.error.issues[0]?.message ?? "invalid JSON shape"}`,
    );
  }
  return parsed.data.records;
}

/**
 * Validates a submission against its input records. The schema is checked first; a file that
 * fails it still gets ID checks on whatever conversation IDs can be read, so the report names
 * the conversation and field at fault.
 */
export function validateSubmission(
  input: readonly ConversationRecord[],
  results: unknown,
  dataset: DatasetName,
): Validation {
  const issues: Issue[] = [];
  const counts = { input: input.length, ok: 0, error: 0 };

  if (input.length !== EXPECTED_RECORDS[dataset]) {
    issues.push({
      message: `the ${dataset} input has ${input.length} records, expected ${EXPECTED_RECORDS[dataset]}`,
    });
  }

  const rawResults: unknown[] = Array.isArray((results as { results?: unknown })?.results)
    ? (results as { results: unknown[] }).results
    : [];
  const idOf = (row: unknown) =>
    typeof (row as { conversation_id?: unknown })?.conversation_id === "string"
      ? (row as { conversation_id: string }).conversation_id
      : undefined;

  const parsed = submissionFileSchema.safeParse(results);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const [head, index, ...rest] = issue.path;
      const position = typeof index === "number" ? index : -1;
      const row = head === "results" && position >= 0 ? rawResults[position] : undefined;
      issues.push({
        conversationId: row ? (idOf(row) ?? `results[${position}]`) : undefined,
        field: (row ? rest : issue.path).map(String).join(".") || undefined,
        message: issue.message,
      });
    }
  }

  // ID coverage, on the parsed file when possible, else on whatever IDs the raw rows carry.
  const outputIds = parsed.success
    ? parsed.data.results.map((r) => r.conversation_id)
    : rawResults.map(idOf).filter((id): id is string => id !== undefined);
  const inputIds = new Set(input.map((r) => r.conversation_id));
  const seen = new Map<string, number>();
  for (const id of outputIds) seen.set(id, (seen.get(id) ?? 0) + 1);
  for (const [id, count] of seen) {
    if (count > 1)
      issues.push({ conversationId: id, message: `appears ${count} times in the results` });
    if (!inputIds.has(id))
      issues.push({ conversationId: id, message: "is not in the input dataset" });
  }
  for (const id of inputIds) {
    if (!seen.has(id)) issues.push({ conversationId: id, message: "is missing from the results" });
  }

  if (parsed.success) {
    const transcripts = new Map(input.map((r) => [r.conversation_id, r.transcript.length]));
    for (const result of parsed.data.results) {
      if (result.status === "error") {
        counts.error += 1;
        continue;
      }
      counts.ok += 1;
      const turns = transcripts.get(result.conversation_id);
      for (const item of result.criteria) {
        if (turns === undefined) continue;
        const bad = item.evidence_turns.filter((turn) => turn < 1 || turn > turns);
        if (bad.length) {
          issues.push({
            conversationId: result.conversation_id,
            field: `${item.criterion_id}.evidence_turns`,
            message: `turns ${bad.join(", ")} are outside 1 to ${turns}`,
          });
        }
      }
      const ratings = toInternalRatings(result.criteria);
      const score = scoreEvaluation(defaultChecklist, ratings, []);
      if (score.total === null || score.total !== result.score.final_score) {
        issues.push({
          conversationId: result.conversation_id,
          field: "score.final_score",
          message: `is ${result.score.final_score}, recomputed ${score.total ?? "none"}`,
        });
      }
      if (score.seriousViolation !== result.score.critical_flag) {
        issues.push({
          conversationId: result.conversation_id,
          field: "score.critical_flag",
          message: `is ${result.score.critical_flag}, recomputed ${score.seriousViolation}`,
        });
      }
    }
  }

  return { ok: issues.length === 0, issues, counts };
}

export function formatIssue(issue: Issue): string {
  const where = [issue.conversationId, issue.field].filter(Boolean).join(" ");
  return where ? `${where}: ${issue.message}` : issue.message;
}

export function report(validation: Validation, dataset: DatasetName, io: Io) {
  const { counts } = validation;
  io.out(
    `${dataset}: ${counts.input} input records · ${counts.ok} ok · ${counts.error} error · ${validation.issues.length} issue(s)`,
  );
  for (const issue of validation.issues) io.err(formatIssue(issue));
  io.out(validation.ok ? "VALID" : "INVALID");
}

export function datasetName(value: string): DatasetName {
  if (value === "dev" || value === "prod") return value;
  throw new UsageError("--dataset must be dev or prod");
}

export function main(argv: string[], io: Io): number {
  const { options } = parseCli(argv, {
    input: { type: "string" },
    results: { type: "string" },
    dataset: { type: "string" },
  });
  const dataset = datasetName(required(options.dataset, "dataset"));
  const input = parseDataset(JSON.parse(readFileSync(required(options.input, "input"), "utf8")));
  const results: unknown = JSON.parse(readFileSync(required(options.results, "results"), "utf8"));
  const validation = validateSubmission(input, results, dataset);
  report(validation, dataset, io);
  return validation.ok ? 0 : 1;
}

if (import.meta.main) runMain(main);
