import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, test } from "vite-plus/test";
import { main, type LatestJson } from "./index.ts";
import { capture, tempDir } from "./test-helpers.ts";

const IDS = [
  "opening",
  "understanding",
  "verification",
  "guidance",
  "empathy",
  "management",
  "closing",
  "violations",
];

function report(
  name: string,
  createdAt: string,
  opts: {
    mode?: string;
    promptVersion?: string;
    provider?: string;
    kz?: number;
    ru?: number;
    en?: number;
    exact?: number;
    labelerA?: string;
    skipCriterion?: string;
  } = {},
) {
  const perCriterion: Record<string, unknown> = {};
  for (const id of IDS) {
    if (id === opts.skipCriterion) continue;
    perCriterion[id] = {
      n: 10,
      exact: 9,
      exactRate: 0.9,
      ...(id === "opening" ? { kappa: 0.5 } : {}),
    };
  }
  const lang: Record<string, unknown> = {};
  if (opts.ru !== undefined) lang.RU = { n: 10, exactRate: opts.ru };
  if (opts.kz !== undefined) lang.KZ = { n: 10, exactRate: opts.kz };
  if (opts.en !== undefined) lang.EN = { n: 10, exactRate: opts.en };
  const exact = opts.exact ?? 90;
  return {
    name,
    createdAt,
    mode: opts.mode ?? "run",
    labelerA: opts.labelerA ?? "manual",
    perCriterion,
    pooled: { n: 100, exact, exactRate: exact / 100, ci: [0.8, 0.95] },
    totals: { n: 5, mae: 6.2279, maxError: 30, ci: [1, 2], skipped: 0 },
    violations: { tp: 1, fp: 0, fn: 0, precision: 1, recall: 1 },
    breakdown: { language: lang, channel: {} },
    runHealth: { dialogs: 59, failedSamples: 0, meanLatencyMs: 1000, costUsd: 0.5 },
    ...(opts.mode === "pairs"
      ? { labelerB: "x" }
      : {
          run: {
            promptVersion: opts.promptVersion ?? "p1",
            provider: opts.provider ?? "hf",
            model: "m",
          },
        }),
  };
}

function setup(extra: Record<string, unknown> = {}) {
  const dir = tempDir();
  const put = (name: string, value: unknown) =>
    writeFileSync(`${dir}/${name}.json`, JSON.stringify(value), "utf8");
  put(
    "b-late",
    report("b-late", "2026-11-07T12:00:00+00:00", { ru: 0.9, kz: 0.7, en: 0.9, exact: 80 }),
  );
  put(
    "a-early",
    report("a-early", "2026-11-07T10:00:00+00:00", {
      ru: 0.9,
      kz: 0.95,
      en: 0.9,
      skipCriterion: "closing",
    }),
  );
  put(
    "ceiling",
    report("ceiling", "2026-11-07T09:00:00+00:00", {
      mode: "pairs",
      ru: 0.9,
      kz: 0.9,
      en: 0.9,
      exact: 95,
    }),
  );
  put("summary", { name: "summary", run: {}, dialogs: [] });
  put(
    "local",
    report("local", "2026-11-07T13:00:00+00:00", { provider: "local", ru: 0.9, kz: 0.9, en: 0.9 }),
  );
  put(
    "other-prompt",
    report("other-prompt", "2026-11-07T14:00:00+00:00", { promptVersion: "p2", provider: "other" }),
  );
  put(
    "other-labeler",
    report("other-labeler", "2026-11-07T15:00:00+00:00", { provider: "other2", labelerA: "final" }),
  );
  writeFileSync(
    `${dir}/verdicts.json`,
    JSON.stringify({ "a-early": { verdict: "baseline", note: "main prompt" } }),
    "utf8",
  );
  for (const [k, v] of Object.entries(extra)) put(k, v);
  return dir;
}

const run = (dir: string, args: string[] = []) => {
  const c = capture();
  const code = main(
    ["--reports-dir", dir, "--latest", "a-early", "--ceiling", "ceiling", ...args],
    c.io,
  );
  return { code, ...c };
};

describe("calibrate index", () => {
  test("rows are run reports sorted by createdAt with formatted cells", () => {
    const dir = setup();
    const r = run(dir);
    expect(r.code).toBe(0);
    expect(r.text()).toContain("summary.json");
    const md = readFileSync(`${dir}/INDEX.md`, "utf8");
    expect(md.endsWith("\n")).toBe(true);
    const rows = md
      .split("\n")
      .filter((l) => l.startsWith("| ") && !l.includes("Report") && !l.includes("---"));
    expect(rows.map((l) => l.split("|")[1].trim())).toEqual([
      "a-early",
      "b-late",
      "local",
      "other-prompt",
      "other-labeler",
    ]);
    const early = rows[0];
    expect(early).toContain("90/100 (90.0%)");
    expect(early).toContain("90.0%");
    expect(early).toContain("6.23");
    expect(early).toContain("baseline");
    expect(early).toContain("main prompt");
    expect(early.split("|").some((c) => c.trim() === "—")).toBe(true); // closing missing
    expect(rows[1]).toContain("80/100 (80.0%)");
    expect(md).not.toContain("ceiling |");
  });

  test("KZ gap has a sign and the Kazakh check lists low reports", () => {
    const dir = setup();
    run(dir);
    const md = readFileSync(`${dir}/INDEX.md`, "utf8");
    expect(md).toContain("+5.0");
    expect(md).toContain("-20.0");
    expect(md).toContain("Kazakh check");
    expect(md).toMatch(/b-late.*-20\.0/);
    expect(md.split("Kazakh check")[1]).not.toContain("a-early");
  });

  test("Kazakh check says all clear when no run is 10 points below", () => {
    const dir = setup();
    writeFileSync(
      `${dir}/b-late.json`,
      JSON.stringify(report("b-late", "2026-11-07T12:00:00+00:00", { ru: 0.9, kz: 0.9, en: 0.9 })),
    );
    run(dir);
    expect(readFileSync(`${dir}/INDEX.md`, "utf8")).toContain(
      "KZ is within 10 points of RU and EN in every run report.",
    );
  });

  test("a report without language breakdown has an empty gap and is skipped", () => {
    const dir = setup();
    run(dir);
    const md = readFileSync(`${dir}/INDEX.md`, "utf8");
    const row = md.split("\n").find((l) => l.startsWith("| other-prompt"))!;
    expect(row.split("|").map((c) => c.trim())).toContain("—");
    expect(md.split("Kazakh check")[1]).not.toContain("other-prompt");
  });

  test("missing verdict entry shows a dash", () => {
    const dir = setup();
    run(dir);
    const row = readFileSync(`${dir}/INDEX.md`, "utf8")
      .split("\n")
      .find((l) => l.startsWith("| b-late"))!;
    expect(
      row
        .split("|")
        .map((c) => c.trim())
        .slice(-3, -1),
    ).toEqual(["—", "—"]);
  });

  test("latest.json has the documented shape and filters providers by prompt version", () => {
    const dir = setup();
    run(dir);
    const text = readFileSync(`${dir}/latest.json`, "utf8");
    expect(text.endsWith("\n")).toBe(true);
    const latest: LatestJson = JSON.parse(text);
    expect(latest.report).toBe("a-early");
    expect(latest.promptVersion).toBe("p1");
    expect(latest.provider).toBe("hf");
    expect(latest.model).toBe("m");
    expect(latest.referenceLabeler).toBe("manual");
    expect(latest.dialogs).toBe(59);
    expect(latest.pooled).toEqual({ exact: 90, n: 100, rate: 0.9, ci: [0.8, 0.95] });
    expect(latest.perCriterion.opening).toEqual({ n: 10, exactRate: 0.9, kappa: 0.5 });
    expect(latest.perCriterion.empathy).toEqual({ n: 10, exactRate: 0.9 });
    expect(latest.totals).toEqual({ mae: 6.2279, maxError: 30, n: 5 });
    expect(latest.violations).toMatchObject({ tp: 1 });
    expect(latest.breakdown.language).toBeDefined();
    expect(latest.humanCeiling).toMatchObject({
      report: "ceiling",
      labelerA: "manual",
      labelerB: "x",
      n: 100,
    });
    expect(latest.humanCeiling?.pooledRate).toBe(0.95);
    expect(latest.humanCeiling?.perCriterion.opening).toBe(0.9);
    expect(latest.providers.map((p) => [p.provider, p.report])).toEqual([
      ["hf", "a-early"],
      ["local", "local"],
    ]);
    expect(latest.providers[0]).toMatchObject({
      model: "m",
      promptVersion: "p1",
      pooledRate: 0.9,
      meanLatencyMs: 1000,
      costUsd: 0.5,
    });
  });

  test("humanCeiling is null when the ceiling report is absent", () => {
    const dir = setup();
    const c = capture();
    expect(main(["--reports-dir", dir, "--latest", "a-early", "--ceiling", "nope"], c.io)).toBe(0);
    expect(JSON.parse(readFileSync(`${dir}/latest.json`, "utf8")).humanCeiling).toBeNull();
  });

  test("a missing or non-run --latest report exits 1", () => {
    const dir = setup();
    for (const name of ["nope", "ceiling", "summary"]) {
      const c = capture();
      expect(main(["--reports-dir", dir, "--latest", name], c.io)).toBe(1);
      expect(c.errText()).toContain(name);
    }
  });

  test("output is deterministic apart from generatedAt", () => {
    const dir = setup();
    run(dir);
    const a = readFileSync(`${dir}/INDEX.md`, "utf8");
    run(dir);
    expect(readFileSync(`${dir}/INDEX.md`, "utf8")).toBe(a);
  });

  test("null exactRate renders a dash and gives no KZ gap", () => {
    const dir = setup();
    const r = report("b-late", "2026-11-07T12:00:00+00:00", { ru: 0.9, kz: 0.1, en: 0.9 });
    (r.perCriterion as any).empathy.exactRate = null;
    (r.breakdown.language as any).RU.exactRate = null;
    writeFileSync(`${dir}/b-late.json`, JSON.stringify(r));
    run(dir);
    const md = readFileSync(`${dir}/INDEX.md`, "utf8");
    const cells = md
      .split("\n")
      .find((l) => l.startsWith("| b-late"))!
      .split("|")
      .map((c) => c.trim());
    expect(cells).not.toContain("0.0%");
    expect(cells).not.toContain("NaN%");
    expect(cells.filter((c) => c === "—").length).toBeGreaterThanOrEqual(2);
    expect(md.split("Kazakh check")[1]).not.toContain("b-late");
  });

  test("a non-pairs --ceiling report exits 1", () => {
    const dir = setup();
    const c = capture();
    expect(main(["--reports-dir", dir, "--latest", "a-early", "--ceiling", "b-late"], c.io)).toBe(
      1,
    );
    expect(c.errText()).toContain("b-late");
  });

  test("the --latest report is its own provider row; providers are keyed by model too", () => {
    const dir = setup();
    // newer report with the same provider and model as a-early
    // (b-late already is), and a second model on the same provider
    const other = report("c-model", "2026-11-07T11:00:00+00:00", { provider: "hf" });
    (other as { run?: { model: string } }).run!.model = "m2";
    writeFileSync(`${dir}/c-model.json`, JSON.stringify(other));
    const c = capture();
    expect(main(["--reports-dir", dir, "--latest", "a-early", "--ceiling", "ceiling"], c.io)).toBe(
      0,
    );
    const latest: LatestJson = JSON.parse(readFileSync(`${dir}/latest.json`, "utf8"));
    expect(latest.providers.map((p) => [p.provider, p.model, p.report])).toEqual([
      ["hf", "m", "a-early"],
      ["hf", "m2", "c-model"],
      ["local", "m", "local"],
    ]);
  });

  test("a gap of exactly -10 points is listed in the Kazakh check", () => {
    const dir = setup();
    writeFileSync(
      `${dir}/b-late.json`,
      JSON.stringify(report("b-late", "2026-11-07T12:00:00+00:00", { ru: 0.9, kz: 0.8, en: 0.9 })),
    );
    run(dir);
    const md = readFileSync(`${dir}/INDEX.md`, "utf8");
    expect(md.split("Kazakh check")[1]).toContain("b-late: KZ gap -10.0");
  });

  test("verdicts.json problems print warnings", () => {
    const dir = setup();
    writeFileSync(
      `${dir}/verdicts.json`,
      JSON.stringify({
        ghost: { verdict: "info", note: "" },
        "a-early": { verdict: "great", note: "" },
      }),
    );
    const r = run(dir);
    expect(r.code).toBe(0);
    expect(r.text()).toContain("unknown report ghost");
    expect(r.text()).toContain('invalid verdict "great" for a-early');
  });
});
