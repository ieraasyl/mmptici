// Label files, run files, and the app's checklist and scorer, shared by compare.ts and review.ts.

import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultChecklist } from "../../apps/api/src/checklist.ts";
import { scoreEvaluation } from "../../apps/api/src/evaluation.ts";
import { answerOptions, type Answer, type Checklist } from "../../packages/contracts/src/cqa.ts";
import { loadJson, pyRepr, readCsv, type Io } from "./cli.ts";

export const HERE = fileURLToPath(new URL(".", import.meta.url));
export const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const DEFAULT_LABELS = `${HERE}labels/labels.csv`;
export const DEFAULT_LABELS_DIR = `${HERE}labels`;
export const DEFAULT_SETS = `${HERE}labels/sets.json`;
export const DEFAULT_DATA = `${ROOT}data/invoke.json`;
export const DEFAULT_REPORTS = `${HERE}reports`;
export const DEFAULT_RUNS = `${HERE}runs`;

export type Turn = { speaker: string; timestamp: string; text: string };
export type ConversationRecord = {
  conversation_id: string;
  channel: string;
  language: string;
  transcript: Turn[];
};
export type Sets = {
  tuning: string[];
  heldout: string[];
  assignments: Record<string, { primary: string[]; second: string[] }>;
  [key: string]: unknown;
};
/** A label answer after normalization; text that is not an allowed answer stays a string. */
export type LabelAnswer = string | number;

export type LabelRow = {
  conversation_id: string;
  labeler: string;
  criterion_id: string;
  answer: LabelAnswer;
  evidence_turns: string;
  note: string;
  row: number;
  file: string;
  [column: string]: unknown;
};

export type RunRating = {
  criterionId: string;
  answer: LabelAnswer;
  evidence?: unknown;
  votes?: unknown[];
  explanation?: string;
  [key: string]: unknown;
};
export type RunFile = {
  promptVersion?: string;
  provider?: string;
  model?: string;
  dialogs: {
    conversationId: string;
    ratings?: RunRating[] | null;
    run?: Record<string, any> | null;
    [key: string]: unknown;
  }[];
  [key: string]: unknown;
};

/** The app's default checklist, or a checklist JSON file. */
export function loadChecklist(path?: string): Checklist {
  return path ? loadJson<Checklist>(path) : defaultChecklist;
}

export function loadRecords(path: string): ConversationRecord[] {
  return loadJson(path).data.records;
}

export function normalize(answer: unknown): LabelAnswer {
  if (typeof answer === "number" && Number.isInteger(answer)) return answer;
  const text = String(answer).trim().toLowerCase();
  if (text === "n/a") return "na";
  return /^\d+$/.test(text) ? Number(text) : text;
}

export function isAllowed(criterion: Checklist["criteria"][number], answer: LabelAnswer) {
  return (answerOptions(criterion) as LabelAnswer[]).includes(answer);
}

/** Reads one labels CSV; rows with an empty answer are skipped with a warning on stderr. */
export function readLabels(path: string, io: Pick<Io, "err">): LabelRow[] {
  const raw = readCsv(path);
  const rows: LabelRow[] = [];
  let skipped = 0;
  raw.forEach((record, i) => {
    const row: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(record)) row[k] = v.trim();
    if (!row.answer) {
      skipped++;
      return;
    }
    row.row = i + 2;
    row.file = basename(path);
    row.answer = normalize(row.answer);
    rows.push(row as LabelRow);
  });
  if (skipped) {
    io.err(`warning: ${basename(path)}: skipped ${skipped} row(s) with an empty answer`);
  }
  return rows;
}

export function checkLabels(
  rows: LabelRow[],
  checklist: Checklist,
  conversations: Set<string>,
): string[] {
  const criteria = new Map(checklist.criteria.map((c) => [c.id, c]));
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const n = `${r.file} row ${r.row}`;
    const cid = r.criterion_id;
    if (!conversations.has(r.conversation_id)) {
      problems.push(`${n}: unknown conversation ${pyRepr(r.conversation_id)}`);
    }
    const criterion = criteria.get(cid);
    if (!criterion) problems.push(`${n}: unknown criterion ${pyRepr(cid)}`);
    else if (!isAllowed(criterion, r.answer)) {
      problems.push(`${n}: answer ${pyRepr(r.answer)} not allowed for ${cid}`);
    }
    const key = [r.conversation_id, r.labeler, cid];
    const id = JSON.stringify(key);
    if (seen.has(id)) problems.push(`${n}: duplicate label for ${pyRepr(key)}`);
    seen.add(id);
  }
  return problems;
}

export type Ratings = Map<string, Map<string, RunRating>>;

/** conversationId → criterionId → rating with a normalized answer. */
export function runRatings(run: RunFile): Ratings {
  return new Map(
    run.dialogs.map((d) => [
      d.conversationId,
      new Map((d.ratings ?? []).map((r) => [r.criterionId, { ...r, answer: normalize(r.answer) }])),
    ]),
  );
}

export function checkRun(
  ratings: Ratings,
  checklist: Checklist,
  conversations: Set<string>,
): string[] {
  const criteria = new Map(checklist.criteria.map((c) => [c.id, c]));
  const problems: string[] = [];
  for (const [conv, byCriterion] of ratings) {
    if (!conversations.has(conv)) problems.push(`run dialog ${conv}: unknown conversation`);
    for (const [cid, r] of byCriterion) {
      const criterion = criteria.get(cid);
      if (!criterion) problems.push(`run dialog ${conv}: unknown criterion ${pyRepr(cid)}`);
      else if (!isAllowed(criterion, r.answer)) {
        problems.push(`run dialog ${conv}: answer ${pyRepr(r.answer)} not allowed for ${cid}`);
      }
    }
  }
  return problems;
}

/** Turn numbers from "1;3", "1, 3", or a list such as [1, "3"]. */
export function turns(value: unknown): number[] {
  const text = Array.isArray(value)
    ? value.filter((v) => v !== null && v !== undefined).join(";")
    : typeof value === "string" || typeof value === "number"
      ? String(value)
      : "";
  return [...text.matchAll(/\d+/g)].map((m) => Number(m[0]));
}

/**
 * Total score of one set of answers through the app's scorer. Answers must be complete and
 * valid; decisions override answers like accepted appeals.
 */
export function scoreAnswers(
  checklist: Checklist,
  answers: Record<string, Answer>,
  decisions: Record<string, Answer> = {},
) {
  const ratings = checklist.criteria.map((c) => {
    if (!(c.id in answers)) throw new Error(`criterion ${pyRepr(c.id)}: answer is missing`);
    for (const answer of [answers[c.id], decisions[c.id] ?? answers[c.id]]) {
      if (!isAllowed(c, answer)) {
        throw new Error(`criterion ${pyRepr(c.id)}: answer ${pyRepr(answer)} is not allowed`);
      }
    }
    return { criterionId: c.id, answer: answers[c.id], explanation: "-", evidence: [1] };
  });
  const appeals = Object.entries(decisions).map(([criterionId, answer]) => ({
    criterionId,
    decision: { answer, reason: "-" },
  }));
  return scoreEvaluation(checklist, ratings, appeals);
}
