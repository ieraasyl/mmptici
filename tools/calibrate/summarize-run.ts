// Summarize a run file without labels: answer distribution, violation flags, stability, cost.
//
//   vp run calibrate:summarize tools/calibrate/runs/<run>.json --name <report-name>
//
// Writes tools/calibrate/reports/<name>.md and .json. Reports hold IDs, answers, and counts only.

import { mkdirSync, writeFileSync } from "node:fs";
import {
  fixed,
  loadJson,
  parseCli,
  pyFloat,
  pyStr,
  pySum,
  round,
  runMain,
  UsageError,
  type Io,
} from "./cli.ts";
import { DEFAULT_REPORTS, type RunFile } from "./labels.ts";

// Dialogs where reading the DEV set shows a gross violation. These are team observations,
// not organizer Ground Truth labels.
export const KNOWN_VIOLATIONS = new Set([
  "p1-ru-022",
  "p1-ru-023",
  "p1-ru-029",
  "p1-kz-013",
  "p1-en-013",
]);

type Counts = Map<string, number>;
const answerKey = (answer: unknown) =>
  answer !== null && typeof answer === "object" ? JSON.stringify(answer) : pyStr(answer);
const bump = (m: Counts, key: string) => m.set(key, (m.get(key) ?? 0) + 1);
const sorted = (xs: Iterable<string>) => [...xs].sort();
const meanOf = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** Counts in first-seen order, which the Markdown keeps for ties. */
export function collect(run: RunFile) {
  const dialogs = run.dialogs;
  const evaluated = dialogs.filter((d) => d.ratings?.length);
  const failed = sorted(dialogs.filter((d) => !d.ratings?.length).map((d) => d.conversationId));
  const distribution = new Map<string, Counts>();
  const byLanguage = new Map<string, Map<string, Counts>>();
  const stability = new Map<string, { n: number; unanimous: number }>();
  const flagged = new Set<string>();
  for (const d of evaluated) {
    const lang = (d.language as string | undefined) ?? "?";
    for (const r of d.ratings!) {
      const cid = r.criterionId;
      const key = answerKey(r.answer);
      if (!distribution.has(cid)) distribution.set(cid, new Map());
      bump(distribution.get(cid)!, key);
      if (!byLanguage.has(cid)) byLanguage.set(cid, new Map());
      const langs = byLanguage.get(cid)!;
      if (!langs.has(lang)) langs.set(lang, new Map());
      bump(langs.get(lang)!, key);
      const votes = r.votes ?? [];
      if (votes.length > 1) {
        const s = stability.get(cid) ?? { n: 0, unanimous: 0 };
        stability.set(cid, s);
        s.n++;
        if (new Set(votes.map(answerKey)).size === 1) s.unanimous++;
      }
      if (cid === "violations" && r.answer === "yes") flagged.add(d.conversationId);
    }
  }
  const present = new Set(evaluated.map((d) => d.conversationId));
  const knownHere = [...KNOWN_VIOLATIONS].filter((id) => present.has(id));
  const totals = evaluated
    .map((d) => d.total as number | null | undefined)
    .filter((t): t is number => t !== null && t !== undefined);
  const metas = dialogs.filter((d) => d.run).map((d) => d.run!);
  const latencies = metas.map((m) => m.latencyMs as number);
  // Python printed int sums and means without ".0"; keep that in the Markdown.
  const allInts = (xs: number[]) => xs.every((x) => Number.isInteger(x));
  const format = {
    mean: allInts(totals) ? pyStr : pyFloat,
    cost: allInts(metas.map((m) => m.costUsd)) ? pyStr : pyFloat,
  };
  return {
    format,
    run: Object.fromEntries(
      ["promptVersion", "provider", "model", "set", "samples", "temperature", "commit"].map((k) => [
        k,
        run[k] ?? null,
      ]),
    ),
    dialogs: dialogs.length,
    evaluated: evaluated.length,
    failed,
    distribution,
    byLanguage,
    stability,
    violations: {
      flagged: sorted(flagged),
      knownCaught: sorted(knownHere.filter((id) => flagged.has(id))),
      knownMissed: sorted(knownHere.filter((id) => !flagged.has(id))),
      unexpected: sorted([...flagged].filter((id) => !KNOWN_VIOLATIONS.has(id))),
    },
    totals: {
      n: totals.length,
      mean: totals.length ? round(meanOf(totals), 2) : null,
      min: totals.length ? Math.min(...totals) : null,
      max: totals.length ? Math.max(...totals) : null,
    },
    cost: {
      totalUsd: round(pySum(metas.map((m) => m.costUsd)), 4),
      meanLatencyS: latencies.length ? round(meanOf(latencies) / 1000, 2) : null,
      calls: metas.reduce((s, m) => s + (m.calls ?? 0), 0),
    },
  };
}

type Collected = ReturnType<typeof collect>;
const toObject = (m: Counts) => Object.fromEntries(m);

export function toJson(s: Collected) {
  return {
    run: s.run,
    dialogs: s.dialogs,
    evaluated: s.evaluated,
    failed: s.failed,
    distribution: Object.fromEntries([...s.distribution].map(([c, v]) => [c, toObject(v)])),
    byLanguage: Object.fromEntries(
      [...s.byLanguage].map(([c, langs]) => [
        c,
        Object.fromEntries([...langs].map(([l, v]) => [l, toObject(v)])),
      ]),
    ),
    stability: s.stability.size
      ? Object.fromEntries(
          [...s.stability].map(([c, v]) => [c, { ...v, rate: v.n ? v.unanimous / v.n : null }]),
        )
      : null,
    violations: s.violations,
    totals: s.totals,
    cost: s.cost,
  };
}

export function summarize(run: RunFile) {
  return toJson(collect(run));
}

const cells = (counts: Counts) =>
  [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([a, n]) => `${a}: ${n}`)
    .join(", ");

export function renderMd(name: string, s: Collected) {
  const r = s.run;
  const lines = [`# Run summary: ${name}`, ""];
  lines.push(
    `Prompt \`${pyStr(r.promptVersion)}\` · ${pyStr(r.model)} · set \`${pyStr(r.set)}\` · ` +
      `${pyStr(r.samples)} sample(s) at T=${pyStr(r.temperature)} · commit ${pyStr(r.commit)}`,
  );
  lines.push(
    "",
    `Evaluated ${s.evaluated} of ${s.dialogs}. Failed: ${s.failed.join(", ") || "none"}.`,
    "",
  );
  lines.push("## Answers per criterion", "", "| Criterion | Answers |", "| --- | --- |");
  for (const [cid, counts] of s.distribution) lines.push(`| ${cid} | ${cells(counts)} |`);
  lines.push(
    "",
    "## Answers per criterion and language",
    "",
    "| Criterion | Language | Answers |",
    "| --- | --- | --- |",
  );
  for (const [cid, langs] of s.byLanguage) {
    for (const lang of sorted(langs.keys())) {
      lines.push(`| ${cid} | ${lang} | ${cells(langs.get(lang)!)} |`);
    }
  }
  if (s.stability.size) {
    lines.push(
      "",
      "## Agreement between samples",
      "",
      "| Criterion | Unanimous | Of | Rate |",
      "| --- | ---: | ---: | ---: |",
    );
    for (const [cid, v] of s.stability) {
      const rate = v.n ? fixed(v.unanimous / v.n, 2) : "n/a";
      lines.push(`| ${cid} | ${v.unanimous} | ${v.n} | ${rate} |`);
    }
  }
  const v = s.violations;
  lines.push(
    "",
    "## Gross violation flag",
    "",
    `- Flagged: ${v.flagged.join(", ") || "none"}`,
    `- Known cases caught: ${v.knownCaught.join(", ") || "none"}`,
    `- Known cases missed: ${v.knownMissed.join(", ") || "none"}`,
    `- Flagged but not a known case: ${v.unexpected.join(", ") || "none"}`,
  );
  const { totals: t, cost: c } = s;
  lines.push(
    "",
    "## Totals and cost",
    "",
    `- Totals: n=${t.n}, mean ${s.format.mean(t.mean)}, min ${pyStr(t.min)}, max ${pyStr(t.max)}`,
    `- Cost $${s.format.cost(c.totalUsd)} over ${c.calls} model calls, mean ${pyFloat(c.meanLatencyS)} s per dialog`,
    "",
  );
  return lines.join("\n");
}

export function main(argv: string[], io: Io) {
  const { options: o, positionals } = parseCli(argv, {
    name: { type: "string" },
    "reports-dir": { type: "string", default: DEFAULT_REPORTS },
  });
  if (positionals.length !== 1) throw new UsageError("give exactly one run file");
  if (!o.name) throw new UsageError("--name is required");
  const collected = collect(loadJson<RunFile>(positionals[0]));
  const dir = o["reports-dir"]!;
  mkdirSync(dir, { recursive: true });
  const jsonPath = `${dir}/${o.name}.json`;
  const mdPath = `${dir}/${o.name}.md`;
  writeFileSync(jsonPath, JSON.stringify({ name: o.name, ...toJson(collected) }, null, 2), "utf8");
  writeFileSync(mdPath, renderMd(o.name, collected), "utf8");
  io.out(jsonPath);
  io.out(mdPath);
  return 0;
}

if (import.meta.main) runMain(main);
