// Build reports/INDEX.md and reports/latest.json from the compare reports.
//
//   vp run calibrate:index [--reports-dir DIR] [--latest NAME] [--ceiling NAME]
//
// INDEX.md has one row per run report. latest.json feeds the calibration page.
// reports/verdicts.json is hand-edited: { "<report name>": { "verdict", "note" } }.

import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { defaultChecklist } from "../../apps/api/src/checklist.ts";
import { fixed, loadJson, parseCli, runMain, type Io } from "./cli.ts";
import { DEFAULT_REPORTS } from "./labels.ts";
import type { Report } from "./compare.ts";

export type Verdict = { verdict: "accepted" | "rejected" | "baseline" | "info"; note: string };

export type LatestJson = {
  generatedAt: string;
  report: string;
  promptVersion: string | null;
  provider: string | null;
  model: string | null;
  referenceLabeler: string;
  dialogs: number | null;
  pooled: { exact: number; n: number; rate: number | null; ci: [number, number] };
  perCriterion: Record<string, { n: number; exactRate: number | null; kappa?: number }>;
  totals: { mae: number | null; maxError: number | null; n: number };
  violations: Report["violations"];
  breakdown: Report["breakdown"];
  humanCeiling: {
    report: string;
    labelerA: string;
    labelerB: string | null;
    n: number;
    set: string | null;
    pooledRate: number | null;
    perCriterion: Record<string, number | null>;
  } | null;
  providers: {
    provider: string | null;
    model: string | null;
    promptVersion: string | null;
    report: string;
    pooledRate: number | null;
    meanLatencyMs: number | null;
    costUsd: number | null;
  }[];
};

type Loaded = Report & {
  run?: { promptVersion: string | null; provider: string | null; model: string | null };
};

const DASH = "—";
const pct = (x: number) => `${fixed(x * 100, 1)}%`;
const isReport = (d: any): d is Loaded =>
  !!d &&
  typeof d === "object" &&
  typeof d.name === "string" &&
  typeof d.createdAt === "string" &&
  (d.mode === "run" || d.mode === "pairs") &&
  !!d.perCriterion &&
  !!d.pooled &&
  !!d.totals;
const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();

/** KZ exactRate minus the mean of RU and EN, in points; null when a language is missing. */
export function kzGap(r: Loaded): number | null {
  const lang = r.breakdown?.language as
    | Record<string, { exactRate: number | null } | undefined>
    | undefined;
  if (!lang?.KZ || !lang.RU || !lang.EN) return null;
  const { KZ, RU, EN } = lang;
  if (![KZ?.exactRate, RU?.exactRate, EN?.exactRate].every((x) => typeof x === "number"))
    return null;
  return (KZ!.exactRate! - (RU!.exactRate! + EN!.exactRate!) / 2) * 100;
}
const gapText = (g: number | null) =>
  g === null ? DASH : `${g >= 0 ? "+" : "-"}${fixed(Math.abs(g), 1)}`;

function byCreated(a: Loaded, b: Loaded) {
  return a.createdAt === b.createdAt
    ? a.name.localeCompare(b.name)
    : a.createdAt.localeCompare(b.createdAt);
}

export function main(argv: string[], io: Io) {
  const { options: o } = parseCli(argv, {
    "reports-dir": { type: "string", default: DEFAULT_REPORTS },
    latest: { type: "string", default: "prompt-before-vs-manual" },
    ceiling: { type: "string", default: "ai-labeler-agreement" },
  });
  const dir = o["reports-dir"]!;
  const reports: Loaded[] = [];
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()) {
    if (file === "verdicts.json" || file === "latest.json") continue;
    const data = loadJson(`${dir}/${file}`);
    if (isReport(data)) reports.push(data);
    else io.out(`skipped ${file}: not a compare report`);
  }
  const runs = reports.filter((r) => r.mode === "run").sort(byCreated);
  const latest = runs.find((r) => r.name === o.latest);
  if (!latest) {
    io.err(`error: --latest ${o.latest} is not a run report in ${dir}`);
    return 1;
  }
  const verdictsPath = `${dir}/verdicts.json`;
  const verdicts: Record<string, Verdict> = existsSync(verdictsPath) ? loadJson(verdictsPath) : {};
  const VERDICTS = ["accepted", "rejected", "baseline", "info"];
  for (const [name, v] of Object.entries(verdicts)) {
    if (!reports.some((r) => r.name === name))
      io.out(`warning: verdicts.json names unknown report ${name}`);
    if (!VERDICTS.includes(v?.verdict))
      io.out(
        `warning: verdicts.json has invalid verdict ${JSON.stringify(v?.verdict)} for ${name}`,
      );
  }
  const ceilingReport = reports.find((r) => r.name === o.ceiling);
  if (ceilingReport && ceilingReport.mode !== "pairs") {
    io.err(`error: --ceiling ${o.ceiling} is not a pairs report`);
    return 1;
  }

  const ids = defaultChecklist.criteria.map((c) => c.id);
  const header = [
    "Report",
    "Reference",
    "Prompt",
    "Provider",
    "Dialogs",
    "Pooled agreement",
    ...ids,
    "MAE",
    "KZ gap",
    "Verdict",
    "Note",
  ];
  const rows = runs.map((r) => {
    const v = verdicts[r.name];
    return [
      r.name,
      r.labelerA,
      r.run?.promptVersion ?? DASH,
      r.run?.provider ?? DASH,
      String(r.runHealth?.dialogs ?? DASH),
      `${r.pooled.exact}/${r.pooled.n} (${typeof r.pooled.exactRate === "number" ? pct(r.pooled.exactRate) : DASH})`,
      ...ids.map((id) => {
        const c = (r.perCriterion as Record<string, { exactRate?: number | null }>)[id];
        return typeof c?.exactRate === "number" ? pct(c.exactRate) : DASH;
      }),
      r.totals.mae === null ? DASH : fixed(r.totals.mae, 2),
      gapText(kzGap(r)),
      v?.verdict ?? DASH,
      v?.note ? cell(v.note) : DASH,
    ].map((x) => cell(String(x)));
  });
  // Pad columns the way the formatter does so `vp run ready` accepts the file.
  const widths = header.map((_, i) =>
    Math.max(3, ...rows.map((r) => r[i].length), header[i].length),
  );
  const line = (r: string[]) => `| ${r.map((x, i) => x.padEnd(widths[i])).join(" | ")} |`;
  const table = [
    line(header),
    `| ${widths.map((w) => "-".repeat(w)).join(" | ")} |`,
    ...rows.map(line),
  ];

  const low = runs.filter((r) => {
    const g = kzGap(r);
    return g !== null && Number(fixed(g, 1)) <= -10;
  });
  const check = low.length
    ? low.map((r) => `- ${r.name}: KZ gap ${gapText(kzGap(r))} points`)
    : ["KZ is within 10 points of RU and EN in every run report."];
  const md = [
    "# Calibration index",
    "",
    "One row per run report, oldest first. KZ gap is the KZ agreement minus the mean of RU and EN, in points. Verdicts come from `verdicts.json`.",
    "",
    ...table,
    "",
    "## Kazakh check",
    "",
    ...check,
    "",
  ].join("\n");
  writeFileSync(`${dir}/INDEX.md`, md, "utf8");

  const perCriterion: LatestJson["perCriterion"] = {};
  for (const [id, c] of Object.entries(latest.perCriterion as Record<string, any>)) {
    perCriterion[id] = {
      n: c.n,
      exactRate: c.exactRate,
      ...(c.kappa !== undefined && c.kappa !== null ? { kappa: c.kappa } : {}),
    };
  }
  const key = (r: Loaded) => `${r.run?.provider ?? DASH}\u0000${r.run?.model ?? DASH}`;
  const providers = new Map<string, Loaded>();
  for (const r of runs) {
    if (r.run?.promptVersion !== latest.run?.promptVersion || r.labelerA !== latest.labelerA)
      continue;
    providers.set(key(r), r); // runs are sorted, so the newest wins
  }
  providers.set(key(latest), latest); // the --latest report is always its own row
  const out: LatestJson = {
    generatedAt: new Date().toISOString(),
    report: latest.name,
    promptVersion: latest.run?.promptVersion ?? null,
    provider: latest.run?.provider ?? null,
    model: latest.run?.model ?? null,
    referenceLabeler: latest.labelerA,
    dialogs: latest.runHealth?.dialogs ?? null,
    pooled: {
      exact: latest.pooled.exact,
      n: latest.pooled.n,
      rate: latest.pooled.exactRate,
      ci: latest.pooled.ci as [number, number],
    },
    perCriterion,
    totals: { mae: latest.totals.mae, maxError: latest.totals.maxError, n: latest.totals.n },
    violations: latest.violations,
    breakdown: latest.breakdown,
    humanCeiling: ceilingReport
      ? {
          report: ceilingReport.name,
          labelerA: ceilingReport.labelerA,
          labelerB: (ceilingReport as any).labelerB ?? null,
          n: ceilingReport.pooled.n,
          set: (ceilingReport as any).set ?? null,
          pooledRate: ceilingReport.pooled.exactRate,
          perCriterion: Object.fromEntries(
            Object.entries(ceilingReport.perCriterion as Record<string, any>).map(([id, c]) => [
              id,
              c.exactRate,
            ]),
          ),
        }
      : null,
    providers: [...providers.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, r]) => ({
        provider: r.run?.provider ?? null,
        model: r.run?.model ?? null,
        promptVersion: r.run?.promptVersion ?? null,
        report: r.name,
        pooledRate: r.pooled.exactRate,
        meanLatencyMs: (r.runHealth as any)?.meanLatencyMs ?? null,
        costUsd: (r.runHealth as any)?.costUsd ?? null,
      })),
  };
  writeFileSync(
    `${dir}/latest.json`,
    JSON.stringify(out, null, 2).replace(/\[\s+(-?[\d.e+-]+),\s+(-?[\d.e+-]+)\s+\]/g, "[$1, $2]") +
      "\n",
    "utf8",
  );
  io.out(`${dir}/INDEX.md`);
  io.out(`${dir}/latest.json`);
  return 0;
}

if (import.meta.main) runMain(main);
