// Build a human review sheet from two labelers' disagreements, then merge into final labels.
//
//   vp run calibrate:review sheet --labels a.csv b.csv --set chats17 --name <name> [--run <run.json>]
//       [--include p1-ru-003:closing,p1-ru-007:guidance]
//   vp run calibrate:review finalize --labels a.csv b.csv --set chats17
//       --decisions tools/calibrate/labels/<name>-decisions.csv --out <final.csv> [--allow-pending]
//
// sheet writes runs/<name>-review.md (git-ignored, with transcript turns) and
// labels/<name>-decisions.csv (IDs and answers only) for reviewers to fill in.

import { mkdirSync, writeFileSync } from "node:fs";
import type { Checklist } from "../../packages/contracts/src/cqa.ts";
import { answerOptions } from "../../packages/contracts/src/cqa.ts";
import {
  loadJson,
  parseCli,
  pyRepr,
  readCsv,
  runMain,
  UsageError,
  writeCsv,
  type CsvValue,
  type Io,
} from "./cli.ts";
import {
  checkLabels,
  checkRun,
  DEFAULT_DATA,
  DEFAULT_LABELS_DIR,
  DEFAULT_RUNS,
  DEFAULT_SETS,
  isAllowed,
  loadChecklist,
  loadRecords,
  normalize,
  readLabels,
  runRatings,
  turns,
  type ConversationRecord,
  type LabelRow,
  type Ratings,
  type RunFile,
  type Sets,
} from "./labels.ts";

export const DECISION_COLUMNS = [
  "conversation_id",
  "criterion_id",
  "a_labeler",
  "a_answer",
  "b_labeler",
  "b_answer",
  "decision",
  "reviewer",
  "reason",
];
export const LABEL_COLUMNS = [
  "conversation_id",
  "labeler",
  "criterion_id",
  "answer",
  "evidence_turns",
  "note",
];

class ReviewError extends Error {}

/** Dialog IDs in set order. chats17 = tuning + heldout without the p4- voice calls. */
export function resolveSet(spec: string, sets: Sets): string[] {
  if (spec === "tuning" || spec === "heldout") return [...sets[spec]];
  if (spec === "chats17") {
    return [...sets.tuning, ...sets.heldout].filter((c) => !c.startsWith("p4-"));
  }
  return spec
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function twoLabelers(rows: LabelRow[]): [string, string] {
  const names = [...new Set(rows.map((r) => r.labeler))].sort();
  if (names.length !== 2) {
    throw new ReviewError(
      `expected exactly two labelers, found ${names.length}: ${names.join(", ") || "none"}`,
    );
  }
  return [names[0], names[1]];
}

export type Entry = {
  conv: string;
  cid: string;
  a: LabelRow | undefined;
  b: LabelRow | undefined;
  agreed: boolean;
  /** Agreed, but listed with --include so a human reviews it anyway. */
  forced: boolean;
};

const key = (conv: string, cid: string) => `${conv}:${cid}`;

/**
 * Parses --include "conv:criterion,conv:criterion". Each row must be in the set and labeled by
 * at least one labeler.
 */
export function parseInclude(spec: string | undefined): Set<string> {
  const out = new Set<string>();
  for (const item of (spec ?? "").split(",")) {
    const text = item.trim();
    if (!text) continue;
    const [conv, cid, ...rest] = text.split(":").map((s) => s.trim());
    if (!conv || !cid || rest.length) {
      throw new ReviewError(
        `--include: expected conversation_id:criterion_id, got ${pyRepr(text)}`,
      );
    }
    out.add(key(conv, cid));
  }
  return out;
}

/** One entry per (dialog, criterion) labeled by at least one labeler, in set/checklist order. */
export function classify(
  rows: LabelRow[],
  aName: string,
  bName: string,
  convs: string[],
  checklist: Checklist,
  include: Set<string> = new Set(),
): Entry[] {
  const by = new Map(rows.map((r) => [`${r.conversation_id}\0${r.labeler}\0${r.criterion_id}`, r]));
  const out: Entry[] = [];
  for (const conv of convs) {
    for (const c of checklist.criteria) {
      const a = by.get(`${conv}\0${aName}\0${c.id}`);
      const b = by.get(`${conv}\0${bName}\0${c.id}`);
      if (!a && !b) continue;
      const unsure = [a, b].some((r) => r?.note.toUpperCase().startsWith("UNSURE:"));
      const agreed = Boolean(a && b) && a!.answer === b!.answer && !unsure;
      out.push({ conv, cid: c.id, a, b, agreed, forced: agreed && include.has(key(conv, c.id)) });
    }
  }
  const found = new Set(out.map((e) => key(e.conv, e.cid)));
  const unknown = [...include].filter((k) => !found.has(k));
  if (unknown.length) {
    throw new ReviewError(`--include: no labels in this set for ${unknown.join(", ")}`);
  }
  return out;
}

const needsReview = (e: Entry) => !e.agreed || e.forced;

function loadRows(paths: string[], checklist: Checklist, records: ConversationRecord[], io: Io) {
  const rows = paths.flatMap((p) => readLabels(p, io));
  const problems = checkLabels(rows, checklist, new Set(records.map((r) => r.conversation_id)));
  if (problems.length) throw new ReviewError(problems.join("\n"));
  return { rows, names: twoLabelers(rows) };
}

const answerText = (r: LabelRow | undefined) => (r ? r.answer : "");

function formatLabeler(name: string, r: LabelRow | undefined) {
  if (!r) return `${name}: (missing)`;
  const cited = turns(r.evidence_turns).join(";") || "-";
  return `${name}: ${r.answer} | turns ${cited} | note: ${r.note || "-"}`;
}

export function renderSheet(
  name: string,
  entries: Entry[],
  aName: string,
  bName: string,
  convs: string[],
  records: ConversationRecord[],
  checklist: Checklist,
  ratings: Ratings | null,
) {
  const info = new Map(records.map((r) => [r.conversation_id, r]));
  const crit = new Map(checklist.criteria.map((c) => [c.id, c]));
  const L = [`# Review sheet: ${name}`, "", `Labelers: A=${aName}, B=${bName}`, ""];
  for (const conv of convs) {
    const todo = entries.filter((e) => e.conv === conv && needsReview(e));
    if (!todo.length) continue;
    const transcript = info.get(conv)!.transcript;
    L.push(`## ${conv} (${info.get(conv)!.language})`, "");
    for (const e of todo) {
      const c = crit.get(e.cid)!;
      L.push(
        `### ${c.id}: ${c.title}`,
        "",
        `- Allowed answers: ${answerOptions(c).join(", ")}`,
        `- ${formatLabeler(aName, e.a)}`,
        `- ${formatLabeler(bName, e.b)}`,
      );
      if (ratings) {
        const m = ratings.get(conv)?.get(e.cid);
        L.push(`- model, for context only: ${m ? m.answer : "(none)"}`);
      }
      const cited = [...new Set([e.a, e.b].flatMap((r) => (r ? turns(r.evidence_turns) : [])))];
      for (const t of cited.sort((x, y) => x - y)) {
        if (t >= 1 && t <= transcript.length) {
          L.push(`  - [${t}] ${transcript[t - 1].speaker}: ${transcript[t - 1].text}`);
        } else L.push(`  - [${t}] (no such turn)`);
      }
      L.push("");
    }
  }
  return L.join("\n");
}

type Common = {
  labels: string[];
  set: string;
  sets: Sets;
  checklist: Checklist;
  records: ConversationRecord[];
};

export function sheet(
  o: Common & { name: string; run?: string; runsDir: string; labelsDir: string; include?: string },
  io: Io,
) {
  const {
    rows,
    names: [aName, bName],
  } = loadRows(o.labels, o.checklist, o.records, io);
  const convs = resolveSet(o.set, o.sets);
  let ratings: Ratings | null = null;
  if (o.run) {
    ratings = runRatings(loadJson<RunFile>(o.run));
    const problems = checkRun(
      ratings,
      o.checklist,
      new Set(o.records.map((r) => r.conversation_id)),
    );
    if (problems.length) throw new ReviewError(problems.join("\n"));
  }
  const entries = classify(rows, aName, bName, convs, o.checklist, parseInclude(o.include));
  const review = entries.filter(needsReview);
  mkdirSync(o.runsDir, { recursive: true });
  mkdirSync(o.labelsDir, { recursive: true });
  const sheetPath = `${o.runsDir}/${o.name}-review.md`;
  const decisionsPath = `${o.labelsDir}/${o.name}-decisions.csv`;
  writeFileSync(
    sheetPath,
    renderSheet(o.name, entries, aName, bName, convs, o.records, o.checklist, ratings),
    "utf8",
  );
  writeCsv(
    decisionsPath,
    DECISION_COLUMNS,
    review.map((e) => [e.conv, e.cid, aName, answerText(e.a), bName, answerText(e.b), "", "", ""]),
  );
  io.out(sheetPath);
  io.out(decisionsPath);
  const agreed = entries.length - review.length;
  const forced = review.filter((e) => e.forced).length;
  io.out(
    `total rows: ${entries.length}, agreed: ${agreed}, to review: ${review.length}` +
      (forced ? ` (${forced} agreed row(s) included)` : ""),
  );
  for (const c of o.checklist.criteria) {
    const n = review.filter((e) => e.cid === c.id).length;
    const total = entries.filter((e) => e.cid === c.id).length;
    io.out(`  ${c.id}: ${n} to review of ${total}`);
  }
  return 0;
}

const union = (...rows: (LabelRow | undefined)[]) =>
  [...new Set(rows.flatMap((r) => (r ? turns(r.evidence_turns) : [])))].sort((x, y) => x - y);

/**
 * Agreed rows keep the shared answer, unless a reviewer filled in a decision for them, which
 * overrides it. Disagreements take the reviewer's decision. Evidence is the union of the turns
 * cited by the labelers whose answer survives.
 */
export function finalize(
  o: Common & { decisions: string; out: string; allowPending: boolean },
  io: Io,
) {
  const {
    rows,
    names: [aName, bName],
  } = loadRows(o.labels, o.checklist, o.records, io);
  const convs = resolveSet(o.set, o.sets);
  const crit = new Map(o.checklist.criteria.map((c) => [c.id, c]));
  const decisions = new Map<string, Record<string, string>>();
  for (const d of readCsv(o.decisions)) {
    const row = Object.fromEntries(
      Object.entries(d)
        .filter(([k]) => k)
        .map(([k, v]) => [k, v.trim()]),
    );
    decisions.set(key(row.conversation_id ?? "", row.criterion_id ?? ""), row);
  }
  const problems: string[] = [];
  const pending: [string, string][] = [];
  const out: CsvValue[][] = [];
  let agreed = 0;
  let decided = 0;
  let overridden = 0;
  let kept = 0;
  for (const e of classify(rows, aName, bName, convs, o.checklist)) {
    const d = decisions.get(key(e.conv, e.cid));
    if (e.agreed && !d?.decision) {
      agreed++;
      out.push([e.conv, "final", e.cid, e.a!.answer, union(e.a, e.b).join(";"), "ai-agreed"]);
      continue;
    }
    if (!d?.decision) {
      pending.push([e.conv, e.cid]);
      continue;
    }
    const answer = normalize(d.decision);
    if (!isAllowed(crit.get(e.cid)!, answer)) {
      problems.push(`${e.conv} ${e.cid}: decision ${pyRepr(d.decision)} not allowed`);
      continue;
    }
    const support = [e.a, e.b].filter((r) => r && r.answer === answer);
    const confirmed = e.agreed && answer === e.a!.answer;
    const label = confirmed ? "human confirmed" : e.agreed ? "human override" : "human";
    if (confirmed) kept++;
    else if (e.agreed) overridden++;
    else decided++;
    out.push([
      e.conv,
      "final",
      e.cid,
      answer,
      union(...support).join(";"),
      `${label}: ${d.reviewer ?? ""}: ${d.reason ?? ""}`,
    ]);
  }
  if (pending.length && !o.allowPending) {
    problems.push(...pending.map(([c, k]) => `${c} ${k}: decision missing`));
  }
  if (problems.length) {
    io.err(problems.join("\n"));
    return 1;
  }
  writeCsv(o.out, LABEL_COLUMNS, out);
  io.out(o.out);
  io.out(
    `agreed: ${agreed}, decided: ${decided}, pending: ${pending.length}` +
      (kept ? `, confirmed: ${kept}` : "") +
      (overridden ? `, overridden: ${overridden}` : ""),
  );
  return 0;
}

export function main(argv: string[], io: Io) {
  const [cmd, ...rest] = argv;
  if (cmd !== "sheet" && cmd !== "finalize") {
    throw new UsageError("give a command: sheet or finalize");
  }
  const { options: o } = parseCli(rest, {
    labels: { type: "list" },
    set: { type: "string" },
    sets: { type: "string", default: DEFAULT_SETS },
    checklist: { type: "string" },
    data: { type: "string", default: DEFAULT_DATA },
    ...(cmd === "sheet"
      ? {
          run: { type: "string" },
          name: { type: "string" },
          include: { type: "string" },
          "runs-dir": { type: "string", default: DEFAULT_RUNS },
          "labels-dir": { type: "string", default: DEFAULT_LABELS_DIR },
        }
      : {
          decisions: { type: "string" },
          out: { type: "string" },
          "allow-pending": { type: "boolean" },
        }),
  } as Record<string, { type: "string" | "boolean" | "list"; default?: string }>);
  const need = (name: string) => {
    if (o[name] === undefined) throw new UsageError(`--${name} is required`);
    return o[name] as string;
  };
  const common: Common = {
    labels: need("labels") as unknown as string[],
    set: need("set"),
    checklist: loadChecklist(o.checklist as string | undefined),
    records: loadRecords(o.data as string),
    sets: loadJson<Sets>(o.sets as string),
  };
  try {
    if (cmd === "sheet") {
      return sheet(
        {
          ...common,
          name: need("name"),
          run: o.run as string | undefined,
          include: o.include as string | undefined,
          runsDir: o["runs-dir"] as string,
          labelsDir: o["labels-dir"] as string,
        },
        io,
      );
    }
    return finalize(
      {
        ...common,
        decisions: need("decisions"),
        out: need("out"),
        allowPending: Boolean(o["allow-pending"]),
      },
      io,
    );
  } catch (error) {
    if (!(error instanceof ReviewError)) throw error;
    io.err(error.message);
    return 1;
  }
}

if (import.meta.main) runMain(main);
