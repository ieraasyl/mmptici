// Print dialogs as Markdown labeling sheets and per-labeler CSV templates.
//
//   vp run calibrate:print --set p1-ru-003,p1-ru-007
//   vp run calibrate:print --template <labeler>
//
// --set takes tuning, heldout, all20, or comma-separated IDs. Files go to tools/calibrate/print/
// (git-ignored) unless --out is given.

import { mkdirSync, writeFileSync } from "node:fs";
import type { Checklist } from "../../packages/contracts/src/cqa.ts";
import { answerOptions } from "../../packages/contracts/src/cqa.ts";
import { loadJson, parseCli, runMain, UsageError, writeCsv, type Io } from "./cli.ts";
import {
  DEFAULT_DATA,
  DEFAULT_SETS,
  HERE,
  loadChecklist,
  loadRecords,
  type ConversationRecord,
  type Sets,
} from "./labels.ts";

export const HEADER = [
  "conversation_id",
  "labeler",
  "criterion_id",
  "answer",
  "evidence_turns",
  "note",
];

export function setName(sets: Sets, id: string) {
  if (sets.tuning.includes(id)) return "tuning";
  if (sets.heldout.includes(id)) return "heldout";
  return "other";
}

export function resolveIds(spec: string, sets: Sets): string[] {
  if (spec === "tuning") return [...sets.tuning];
  if (spec === "heldout") return [...sets.heldout];
  if (spec === "all20") return [...sets.tuning, ...sets.heldout];
  return spec
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Lines of text joined with spaces; like Python's splitlines, a final line break adds nothing. */
function oneLine(text: string) {
  // oxlint-disable-next-line no-control-regex -- the separators Python's splitlines uses
  const lines = text.split(/\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/);
  if (lines.length > 1 && lines.at(-1) === "") lines.pop();
  return lines.join(" ");
}

/** Turns are numbered from 1, the same numbering the app uses for evidence. */
export function renderDialog(record: ConversationRecord, setLabel: string, checklist: Checklist) {
  const lines = [
    `# ${record.conversation_id}`,
    "",
    `${record.channel} | ${record.language} | ${setLabel}`,
    "",
  ];
  record.transcript.forEach((turn, i) => {
    lines.push(`[${i + 1}] ${turn.speaker} ${turn.timestamp}: ${oneLine(turn.text)}`);
  });
  lines.push(
    "",
    "| criterion_id | title | allowed answers | answer | evidence turns | note |",
    "| --- | --- | --- | --- | --- | --- |",
  );
  for (const c of checklist.criteria) {
    lines.push(`| ${c.id} | ${c.title} | ${answerOptions(c).join("/")} |  |  |  |`);
  }
  return `${lines.join("\n")}\n`;
}

export function writeDialogs(
  ids: string[],
  records: Map<string, ConversationRecord>,
  sets: Sets,
  checklist: Checklist,
  outDir: string,
) {
  mkdirSync(outDir, { recursive: true });
  return ids.map((id) => {
    const record = records.get(id);
    if (!record) throw new UnknownError(`unknown conversation id: ${id}`);
    const path = `${outDir}/${id}.md`;
    writeFileSync(path, renderDialog(record, setName(sets, id), checklist), "utf8");
    return path;
  });
}

export function writeTemplate(labeler: string, sets: Sets, checklist: Checklist, outDir: string) {
  const a = sets.assignments[labeler];
  if (!a) {
    const known = Object.keys(sets.assignments).join(", ");
    throw new UnknownError(`unknown labeler: ${labeler} (known: ${known})`);
  }
  mkdirSync(outDir, { recursive: true });
  const path = `${outDir}/labels-${labeler}.csv`;
  const rows = [...a.primary, ...a.second].flatMap((id) =>
    checklist.criteria.map((c) => [id, labeler, c.id, "", "", ""]),
  );
  writeCsv(path, HEADER, rows);
  return path;
}

class UnknownError extends Error {}

export function main(argv: string[], io: Io) {
  const { options: o } = parseCli(argv, {
    data: { type: "string", default: DEFAULT_DATA },
    out: { type: "string", default: `${HERE}print` },
    sets: { type: "string", default: DEFAULT_SETS },
    checklist: { type: "string" },
    set: { type: "string" },
    template: { type: "string" },
  });
  if (!o.set && !o.template) throw new UsageError("give --set and/or --template");
  const sets = loadJson<Sets>(o.sets!);
  const checklist = loadChecklist(o.checklist);
  const written: string[] = [];
  try {
    if (o.set) {
      const records = new Map(loadRecords(o.data!).map((r) => [r.conversation_id, r]));
      written.push(...writeDialogs(resolveIds(o.set, sets), records, sets, checklist, o.out!));
    }
    if (o.template) written.push(writeTemplate(o.template, sets, checklist, o.out!));
  } catch (error) {
    if (!(error instanceof UnknownError)) throw error;
    io.err(error.message);
    return 2;
  }
  for (const path of written) io.out(path);
  return 0;
}

if (import.meta.main) runMain(main);
