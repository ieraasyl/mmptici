// Compare labels against labels (--pairs) or against a model run (--run).
//
//   vp run calibrate:compare --pairs --name <name> --labels a.csv b.csv
//   vp run calibrate:compare --run tools/calibrate/runs/<run>.json --set tuning --name <name>
//
// Writes reports/<name>.json and .md (IDs, answers, and metrics only) and
// runs/<name>-mismatches.csv (git-ignored, with evidence text, explanations, and notes).

import { mkdirSync, writeFileSync } from "node:fs";
import type { Answer, Checklist } from "../../packages/contracts/src/cqa.ts";
import {
  fixed,
  loadJson,
  parseCli,
  pyFloat,
  pyStr,
  pySum,
  round,
  runMain,
  sortAnswers,
  UsageError,
  writeCsv,
  type Io,
} from "./cli.ts";
import {
  checkLabels,
  checkRun,
  DEFAULT_DATA,
  DEFAULT_LABELS,
  DEFAULT_REPORTS,
  DEFAULT_RUNS,
  DEFAULT_SETS,
  loadChecklist,
  loadRecords,
  readLabels,
  runRatings,
  scoreAnswers,
  turns,
  type ConversationRecord,
  type LabelAnswer,
  type LabelRow,
  type Ratings,
  type RunFile,
  type Sets,
} from "./labels.ts";
import { bootstrapCi, cohenKappa, precisionRecall, quadraticWeightedKappa } from "./metrics.ts";

const LANGUAGES = ["RU", "KZ", "EN"];
const CHANNELS = ["agent chat", "voice call"];
export const CSV_COLUMNS = [
  "conversation_id",
  "criterion_id",
  "a",
  "b",
  "votes",
  "explanation",
  "a_note",
  "evidence_turns",
  "evidence_text",
  "bucket",
];

export type Pair = {
  conv: string;
  cid: string;
  a: LabelAnswer;
  b: LabelAnswer;
  aNote: string;
  turns: number[];
  votes: string;
  explanation: string;
};

export function selectConversations(spec: string, sets: Sets, available: Iterable<string>) {
  const have = new Set(available);
  let chosen: string[];
  if (spec === "all") chosen = [...have];
  else if (spec === "tuning" || spec === "heldout") chosen = sets[spec].filter((c) => have.has(c));
  else {
    chosen = spec
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && have.has(s));
  }
  return [...new Set(chosen)].sort();
}

function votesText(votes: unknown[] | undefined): string {
  return (votes ?? [])
    .map((v) => {
      if (v && typeof v === "object") {
        const { answer, model } = v as { answer?: unknown; model?: unknown };
        return model ? `${pyStr(answer)}@${pyStr(model)}` : pyStr(answer);
      }
      return pyStr(v);
    })
    .join(";");
}

function intersect<V>(a: Map<string, V>, b: Map<string, unknown>) {
  return [...a.keys()].filter((k) => b.has(k));
}

export function buildPairs(
  mode: "pairs" | "run",
  rows: LabelRow[],
  setSpec: string,
  sets: Sets,
  labeler = "final",
  ratings?: Ratings | null,
) {
  const byConv = new Map<string, Map<string, Map<string, LabelRow>>>();
  for (const r of rows) {
    const conv = byConv.get(r.conversation_id) ?? new Map();
    byConv.set(r.conversation_id, conv);
    const who = conv.get(r.labeler) ?? new Map();
    conv.set(r.labeler, who);
    who.set(r.criterion_id, r);
  }
  const pairs: Pair[] = [];
  const aNames = new Set<string>();
  const bNames = new Set<string>();
  let convs: string[];
  if (mode === "pairs") {
    convs = selectConversations(setSpec, sets, byConv.keys());
    for (const conv of convs) {
      const names = [...byConv.get(conv)!.keys()].filter((n) => n !== "final").sort();
      if (names.length < 2) continue;
      const [aName, bName] = names;
      aNames.add(aName);
      bNames.add(bName);
      const aRows = byConv.get(conv)!.get(aName)!;
      const bRows = byConv.get(conv)!.get(bName)!;
      for (const cid of intersect(aRows, bRows)) {
        pairs.push({
          conv,
          cid,
          a: aRows.get(cid)!.answer,
          b: bRows.get(cid)!.answer,
          aNote: aRows.get(cid)!.note,
          turns: turns(bRows.get(cid)!.evidence_turns),
          votes: "",
          explanation: "",
        });
      }
    }
  } else {
    const withLabeler = [...byConv].filter(([, who]) => who.has(labeler)).map(([c]) => c);
    convs = selectConversations(setSpec, sets, withLabeler);
    aNames.add(labeler);
    for (const conv of convs) {
      const aRows = byConv.get(conv)!.get(labeler)!;
      const bRows = ratings?.get(conv) ?? new Map();
      for (const cid of intersect(aRows, bRows)) {
        const rating = bRows.get(cid)!;
        pairs.push({
          conv,
          cid,
          a: aRows.get(cid)!.answer,
          b: rating.answer,
          aNote: aRows.get(cid)!.note,
          turns: turns(rating.evidence),
          votes: votesText(rating.votes),
          explanation: rating.explanation || "",
        });
      }
    }
  }
  return {
    pairs,
    labelerA: [...aNames].sort().join(","),
    labelerB: [...bNames].sort().join(","),
    convs,
  };
}

const exact = (rows: Pair[]) => rows.filter((p) => p.a === p.b).length;
const rate = (rows: Pair[]) => (rows.length ? exact(rows) / rows.length : null);

export type CriterionStats = {
  n: number;
  exact: number;
  exactRate: number | null;
  kappa: number | null;
  qwk?: number | null;
  naAgreement?: number | null;
  confusion: Record<string, Record<string, number>>;
};

export function perCriterion(pairs: Pair[], checklist: Checklist) {
  const out: Record<string, CriterionStats> = {};
  for (const c of checklist.criteria) {
    const rows = pairs.filter((p) => p.cid === c.id);
    const a = rows.map((p) => p.a);
    const b = rows.map((p) => p.b);
    const entry: Omit<CriterionStats, "confusion"> = {
      n: rows.length,
      exact: exact(rows),
      exactRate: rate(rows),
      kappa: cohenKappa(a, b),
    };
    if (c.kind === "numeric") {
      const kept = rows.filter((p) => p.a !== "na" && p.b !== "na");
      entry.qwk = quadraticWeightedKappa(
        kept.map((p) => p.a),
        kept.map((p) => p.b),
        c.scale as LabelAnswer[],
      );
    }
    if (c.allowNA) {
      entry.naAgreement = rows.length
        ? rows.filter((p) => (p.a === "na") === (p.b === "na")).length / rows.length
        : null;
    }
    const confusion: Record<string, Record<string, number>> = {};
    a.forEach((x, i) => {
      const row = (confusion[String(x)] ??= {});
      row[String(b[i])] = (row[String(b[i])] ?? 0) + 1;
    });
    out[c.id] = { ...entry, confusion };
  }
  return out;
}

function byDialog(pairs: Pair[]): Pair[][] {
  const groups = new Map<string, Pair[]>();
  for (const p of pairs) groups.set(p.conv, [...(groups.get(p.conv) ?? []), p]);
  return [...groups.keys()].sort().map((k) => groups.get(k)!);
}

export function pooled(pairs: Pair[]) {
  const ci = bootstrapCi(byDialog(pairs), (dialogs) => rate(dialogs.flat()));
  return { n: pairs.length, exact: exact(pairs), exactRate: rate(pairs), ci };
}

const mean = (xs: number[]) => (xs.length ? pySum(xs, true) / xs.length : null);

/** Total-score error per dialog, through the app's scorer. */
export function totals(pairs: Pair[], checklist: Checklist) {
  const need = checklist.criteria.map((c) => c.id);
  const errors: number[] = [];
  let skipped = 0;
  for (const d of byDialog(pairs)) {
    const a = Object.fromEntries(d.map((p) => [p.cid, p.a as Answer]));
    const b = Object.fromEntries(d.map((p) => [p.cid, p.b as Answer]));
    if (!need.every((id) => id in a && id in b)) {
      skipped++;
      continue;
    }
    const ta = scoreAnswers(checklist, a).total;
    const tb = scoreAnswers(checklist, b).total;
    if (ta === null || tb === null) {
      skipped++;
      continue;
    }
    errors.push(Math.abs(ta - tb));
  }
  return {
    n: errors.length,
    mae: mean(errors),
    maxError: errors.length ? Math.max(...errors) : null,
    ci: bootstrapCi(errors, mean),
    skipped,
  };
}

export function breakdown(pairs: Pair[], records: ConversationRecord[]) {
  const info = new Map(records.map((r) => [r.conversation_id, r]));
  const out: Record<string, Record<string, { n: number; exactRate: number | null }>> = {};
  for (const [field, values] of [
    ["language", LANGUAGES],
    ["channel", CHANNELS],
  ] as const) {
    out[field] = {};
    for (const v of values) {
      const rows = pairs.filter((p) => info.get(p.conv)?.[field] === v);
      out[field][v] = { n: rows.length, exactRate: rate(rows) };
    }
  }
  return out;
}

export function runHealth(run: RunFile, labelConvs: string[], ratings: Ratings) {
  const meta = run.dialogs.map((d) => d.run ?? {});
  const latencies = meta.map((m) => m.latencyMs).filter((x) => x !== null && x !== undefined);
  const cost = pySum(meta.map((m) => m.costUsd || 0));
  return {
    dialogs: run.dialogs.length,
    failedSamples: meta.reduce((s, m) => s + (m.failedSamples || 0), 0),
    meanLatencyMs: mean(latencies),
    costUsd: cost,
    // Responses without token usage make costUsd a lower bound.
    responsesWithoutUsage: meta.reduce((s, m) => s + (m.responsesWithoutUsage || 0), 0),
    missingFromRun: labelConvs.filter((c) => !ratings.get(c)?.size).sort(),
  };
}

/** Python summed int and float costs; its Markdown printed "0" for ints and "0.0" for floats. */
function costIsFloat(run: RunFile) {
  return run.dialogs.some((d) => !Number.isInteger(d.run?.costUsd || 0));
}

export type Report = ReturnType<typeof buildReport>["report"];

export function buildReport(
  mode: "pairs" | "run",
  name: string,
  setSpec: string,
  labelsPaths: string[],
  sets: Sets,
  checklist: Checklist,
  records: ConversationRecord[],
  run: RunFile | null,
  labeler: string,
  io: Pick<Io, "err">,
) {
  const rows = labelsPaths.flatMap((p) => readLabels(p, io));
  const conversations = new Set(records.map((r) => r.conversation_id));
  const problems = checkLabels(rows, checklist, conversations);
  const ratings = run ? runRatings(run) : null;
  if (ratings) problems.push(...checkRun(ratings, checklist, conversations));
  if (problems.length) throw new LabelError(problems.join("\n"));
  const { pairs, labelerA, labelerB, convs } = buildPairs(
    mode,
    rows,
    setSpec,
    sets,
    labeler,
    ratings,
  );
  const violations = pairs.filter((p) => p.cid === "violations");
  const mismatches = pairs.filter((p) => p.a !== p.b);
  const health = run && ratings ? runHealth(run, convs, ratings) : null;
  const report = {
    name,
    createdAt: `${new Date().toISOString().slice(0, 19)}+00:00`,
    mode,
    set: setSpec,
    labelerA,
    perCriterion: perCriterion(pairs, checklist),
    pooled: pooled(pairs),
    totals: totals(pairs, checklist),
    violations: precisionRecall(
      violations.map((p) => p.a),
      violations.map((p) => p.b),
    ),
    breakdown: breakdown(pairs, records),
    runHealth: health,
    mismatches: mismatches.map((p) => ({
      conversationId: p.conv,
      criterionId: p.cid,
      a: p.a,
      b: p.b,
    })),
    ...(run
      ? {
          run: {
            promptVersion: run.promptVersion ?? null,
            provider: run.provider ?? null,
            model: run.model ?? null,
          },
        }
      : { labelerB }),
  };
  return { report, mismatches, costIsFloat: run ? costIsFloat(run) : false };
}

export class LabelError extends Error {}

export function writeMismatchCsv(path: string, mismatches: Pair[], records: ConversationRecord[]) {
  const text = new Map(records.map((r) => [r.conversation_id, r.transcript]));
  writeCsv(
    path,
    CSV_COLUMNS,
    mismatches.map((p) => {
      const transcript = text.get(p.conv) ?? [];
      const quoted = p.turns
        .filter((t) => t >= 1 && t <= transcript.length)
        .map((t) => transcript[t - 1].text)
        .join(" | ");
      return [
        p.conv,
        p.cid,
        p.a,
        p.b,
        p.votes,
        p.explanation,
        p.aNote,
        p.turns.join(";"),
        quoted,
        "",
      ];
    }),
  );
}

const f3 = (x: number | null | undefined) => (x === null || x === undefined ? "-" : fixed(x, 3));
const ciText = (ci: [number, number] | null) =>
  ci ? `[${ci.map((x) => pyFloat(round(x, 3))).join(", ")}]` : "None";

function confusionText(conf: Record<string, Record<string, number>>) {
  const dict = (entries: string[]) => `{${entries.join(", ")}}`;
  return dict(
    sortAnswers(Object.keys(conf)).map(
      (a) =>
        `"${a}": ${dict(sortAnswers(Object.keys(conf[a])).map((b) => `"${b}": ${conf[a][b]}`))}`,
    ),
  );
}

export function renderMd(r: Report, costIsFloat = false): string {
  const L = [
    `# Comparison report: ${r.name}`,
    "",
    `- Created: ${r.createdAt}`,
    `- Mode: ${r.mode}`,
    `- Set: ${r.set}`,
    `- Labeler A: ${r.labelerA}`,
  ];
  L.push(
    "run" in r && r.run
      ? `- Run: ${Object.entries(r.run)
          .map(([k, v]) => `${k}=${pyStr(v)}`)
          .join(", ")}`
      : `- Labeler B: ${"labelerB" in r ? r.labelerB : ""}`,
  );
  L.push(
    "",
    "## Per criterion",
    "",
    "| criterion | n | exact | exact rate | kappa | qwk | NA agreement |",
    "|---|---|---|---|---|---|---|",
  );
  for (const [cid, c] of Object.entries(r.perCriterion)) {
    L.push(
      `| ${cid} | ${c.n} | ${c.exact} | ${f3(c.exactRate)} | ${f3(c.kappa)} | ` +
        `${f3(c.qwk)} | ${f3(c.naAgreement)} |`,
    );
  }
  for (const [cid, c] of Object.entries(r.perCriterion)) {
    L.push("", `Confusion ${cid} (A rows, B columns): \`${confusionText(c.confusion)}\``);
  }
  const { pooled: p, totals: t, violations: v } = r;
  L.push(
    "",
    "## Pooled",
    "",
    `- n: ${p.n}, exact: ${p.exact}, rate: ${f3(p.exactRate)}, 95% CI: ${ciText(p.ci)}`,
    "",
    "## Totals",
    "",
    `- n: ${t.n}, MAE: ${f3(t.mae)}, max error: ${f3(t.maxError)}, 95% CI: ${ciText(t.ci)}, skipped: ${t.skipped}`,
    "",
    "## Violations",
    "",
    `- tp: ${v.tp}, fp: ${v.fp}, fn: ${v.fn}, precision: ${f3(v.precision)}, recall: ${f3(v.recall)}`,
    "",
    "## Breakdown",
    "",
    "| group | value | n | exact rate |",
    "|---|---|---|---|",
  );
  for (const [field, values] of Object.entries(r.breakdown)) {
    for (const [k, e] of Object.entries(values)) {
      L.push(`| ${field} | ${k} | ${e.n} | ${f3(e.exactRate)} |`);
    }
  }
  L.push("", "## Run health", "");
  const h = r.runHealth;
  if (!h) L.push("Not applicable (pairs mode).");
  else {
    L.push(
      `- dialogs: ${h.dialogs}`,
      `- failed samples: ${h.failedSamples}`,
      `- mean latency ms: ${pyFloat(h.meanLatencyMs)}`,
      `- cost USD: ${costIsFloat ? pyFloat(h.costUsd) : h.costUsd}`,
    );
    if (h.responsesWithoutUsage) {
      L.push(`- responses without token usage: ${h.responsesWithoutUsage} (cost is a lower bound)`);
    }
    L.push(`- missing from run: ${h.missingFromRun.join(", ") || "none"}`);
  }
  L.push("", "## Mismatches", "", `Count: ${r.mismatches.length}`, "");
  return L.join("\n");
}

export function main(
  argv: string[],
  io: Io,
  dirs = { reports: DEFAULT_REPORTS, runs: DEFAULT_RUNS },
) {
  const { options: o } = parseCli(argv, {
    labels: { type: "list", default: [DEFAULT_LABELS] },
    sets: { type: "string", default: DEFAULT_SETS },
    checklist: { type: "string" },
    data: { type: "string", default: DEFAULT_DATA },
    set: { type: "string", default: "all" },
    name: { type: "string" },
    labeler: { type: "string", default: "final" },
    "reports-dir": { type: "string", default: dirs.reports },
    "runs-dir": { type: "string", default: dirs.runs },
    pairs: { type: "boolean" },
    run: { type: "string" },
  });
  if (!o.name) throw new UsageError("--name is required");
  if (o.pairs === (o.run !== undefined))
    throw new UsageError("give exactly one of --pairs or --run");

  const checklist = loadChecklist(o.checklist);
  const records = loadRecords(o.data!);
  const sets = loadJson<Sets>(o.sets!);
  const run = o.run ? loadJson<RunFile>(o.run) : null;
  let built;
  try {
    built = buildReport(
      run ? "run" : "pairs",
      o.name,
      o.set!,
      o.labels!,
      sets,
      checklist,
      records,
      run,
      o.labeler!,
      io,
    );
  } catch (error) {
    if (!(error instanceof LabelError)) throw error;
    io.err(error.message);
    return 1;
  }
  const { report, mismatches, costIsFloat } = built;
  if (report.pooled.n === 0) {
    io.err(
      `error: nothing to compare (mode=${report.mode}, set=${o.set}, labeler=${o.labeler}); no report written`,
    );
    return 1;
  }
  const reports = o["reports-dir"]!;
  const runs = o["runs-dir"]!;
  mkdirSync(reports, { recursive: true });
  mkdirSync(runs, { recursive: true });
  const paths = [
    `${reports}/${o.name}.json`,
    `${reports}/${o.name}.md`,
    `${runs}/${o.name}-mismatches.csv`,
  ];
  writeFileSync(paths[0], `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(paths[1], renderMd(report, costIsFloat), "utf8");
  writeMismatchCsv(paths[2], mismatches, records);
  for (const p of paths) io.out(p);
  return 0;
}

if (import.meta.main) runMain(main);
