import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, test } from "vite-plus/test";
import { defaultChecklist } from "../../apps/api/src/checklist.ts";
import { writeCsv } from "./cli.ts";
import { DEFAULT_LABELS_DIR, DEFAULT_SETS } from "./labels.ts";
import { DECISION_COLUMNS, main, resolveSet } from "./review.ts";
import { loadJson } from "./cli.ts";
import { capture, csvRows, tempDir } from "./test-helpers.ts";

const HEADER = "conversation_id,labeler,criterion_id,answer,evidence_turns,note\n";
const CRITS = defaultChecklist.criteria.map((c) => c.id);
const DATA = {
  data: {
    records: [
      {
        conversation_id: "d1",
        language: "EN",
        channel: "agent chat",
        transcript: [
          { speaker: "client", text: "hello SECRETTEXT" },
          { speaker: "bot", text: "hi there" },
          { speaker: "client", text: "third turn" },
        ],
      },
      {
        conversation_id: "d2",
        language: "RU",
        channel: "agent chat",
        transcript: [{ speaker: "client", text: "x" }],
      },
    ],
  },
};
const SETS = { tuning: ["d1"], heldout: ["d2"] };

const line = (conv: string, who: string, cid: string, ans: string, ev = "", note = "") =>
  `${conv},${who},${cid},${ans},${ev},${note}\n`;

function setup() {
  const dir = tempDir();
  writeFileSync(`${dir}/data.json`, JSON.stringify(DATA));
  writeFileSync(`${dir}/sets.json`, JSON.stringify(SETS));
  const write = (name: string, lines: string[]) => {
    writeFileSync(`${dir}/${name}`, HEADER + lines.join(""));
    return `${dir}/${name}`;
  };
  const cli = (...argv: string[]) => {
    const c = capture();
    const code = main([...argv, "--data", `${dir}/data.json`, "--sets", `${dir}/sets.json`], c.io);
    return { code, ...c };
  };
  const sheet = (labels: string[], ...extra: string[]) =>
    cli(
      "sheet",
      "--labels",
      ...labels,
      "--set",
      "d1",
      "--name",
      "t",
      "--runs-dir",
      `${dir}/runs`,
      "--labels-dir",
      `${dir}/lab`,
      ...extra,
    );
  const scenario = () => [
    write("a.csv", [
      line("d1", "A", "opening", "yes", "1"),
      line("d1", "A", "understanding", "yes", "2"),
      line("d1", "A", CRITS[2], "no", "3", "UNSURE: maybe"),
      line("d1", "A", CRITS[3], "na"),
    ]),
    write("b.csv", [
      line("d1", "B", "opening", "yes", "2"),
      line("d1", "B", "understanding", "no", "1"),
      line("d1", "B", CRITS[2], "no", "3"),
    ]),
  ];
  const decisions = () => csvRows(`${dir}/lab/t-decisions.csv`);
  /** Writes the sheet, fills decisions row by row (or by key), and runs finalize. */
  const finalize = (
    fill: Record<string, string>[] | Record<string, Record<string, string>>,
    options: { include?: string; extra?: string[] } = {},
  ) => {
    sheet(scenario(), ...(options.include ? ["--include", options.include] : []));
    const rows = decisions();
    if (Array.isArray(fill)) fill.forEach((d, i) => Object.assign(rows[i], d));
    else {
      for (const [k, d] of Object.entries(fill)) {
        const [conv, cid] = k.split(":");
        const row = rows.find((r) => r.conversation_id === conv && r.criterion_id === cid);
        if (row) Object.assign(row, d);
        else rows.push({ conversation_id: conv, criterion_id: cid, ...d });
      }
    }
    const path = `${dir}/lab/t-decisions.csv`;
    writeCsv(
      path,
      DECISION_COLUMNS,
      rows.map((r) => DECISION_COLUMNS.map((c) => r[c] ?? "")),
    );
    const out = `${dir}/final.csv`;
    const r = cli(
      "finalize",
      "--labels",
      ...scenario(),
      "--decisions",
      path,
      "--set",
      "d1",
      "--out",
      out,
      ...(options.extra ?? []),
    );
    const final = () =>
      Object.fromEntries(csvRows(out).map((row) => [row.criterion_id, row] as const));
    return { ...r, out, final };
  };
  return { dir, write, cli, sheet, scenario, decisions, finalize };
}

describe("review sheet", () => {
  test("detects disagreements, UNSURE notes, and missing labels", () => {
    const s = setup();
    const { code, text } = s.sheet(s.scenario());
    expect(code).toBe(0);
    const rows = s.decisions();
    expect(rows.map((r) => r.criterion_id)).toEqual(["understanding", CRITS[2], CRITS[3]]);
    expect(rows[2].b_answer).toBe("");
    expect(text()).toContain("total rows: 4, agreed: 1, to review: 3");
  });

  test("decisions CSV has the fixed columns and no transcript text", () => {
    const s = setup();
    s.sheet(s.scenario());
    const text = readFileSync(`${s.dir}/lab/t-decisions.csv`, "utf8");
    expect(text.split("\r\n")[0]).toBe(DECISION_COLUMNS.join(","));
    expect(text).not.toContain("SECRETTEXT");
    expect(s.decisions()[0].decision).toBe("");
  });

  test("sheet shows cited turns and the model answer", () => {
    const s = setup();
    const run = {
      dialogs: [
        { conversationId: "d1", ratings: [{ criterionId: "understanding", answer: "yes" }] },
      ],
    };
    writeFileSync(`${s.dir}/run.json`, JSON.stringify(run));
    s.sheet(s.scenario(), "--run", `${s.dir}/run.json`);
    const md = readFileSync(`${s.dir}/runs/t-review.md`, "utf8");
    expect(md).toContain("[1] client: hello SECRETTEXT");
    expect(md).toContain("[2] bot: hi there");
    expect(md).toContain("model, for context only: yes");
  });

  test("chats17 is the 20 dialogs without voice calls", () => {
    const ids = resolveSet("chats17", loadJson(DEFAULT_SETS));
    expect(ids).toHaveLength(17);
    expect(ids.some((id) => id.startsWith("p4-"))).toBe(false);
  });

  test("needs exactly two labelers", () => {
    const s = setup();
    const one = s.sheet([s.write("a.csv", [line("d1", "A", "opening", "yes")])]);
    expect(one.code).toBe(1);
    expect(one.errText()).toContain("exactly two labelers");
    const three = s.sheet([
      s.write("a.csv", [line("d1", "A", "opening", "yes")]),
      s.write("b.csv", [line("d1", "C", "closing", "yes")]),
      s.write("c.csv", [line("d1", "B", "opening", "yes")]),
    ]);
    expect(three.code).toBe(1);
    expect(three.errText()).toContain("exactly two labelers");
  });

  // These read the AI label files but never the decisions sheet, which reviewers fill in.
  const round1 = (...extra: string[]) => {
    const dir = tempDir();
    const c = capture();
    const code = main(
      [
        "sheet",
        "--labels",
        `${DEFAULT_LABELS_DIR}/ai-fable.csv`,
        `${DEFAULT_LABELS_DIR}/ai-opus.csv`,
        "--set",
        "chats17",
        "--name",
        "ai-round1",
        "--runs-dir",
        `${dir}/runs`,
        "--labels-dir",
        `${dir}/lab`,
        ...extra,
      ],
      c.io,
    );
    expect(code).toBe(0);
    const key = (r: Record<string, string>) => `${r.conversation_id}:${r.criterion_id}`;
    return { text: c.text(), keys: csvRows(`${dir}/lab/ai-round1-decisions.csv`).map(key) };
  };

  test("the round 1 AI labels give 136 rows with 23 to review", () => {
    const { text, keys } = round1();
    expect(text).toContain("total rows: 136, agreed: 113, to review: 23");
    expect(keys).toHaveLength(23);
  });

  test("--include puts agreed rows up for review", () => {
    const s = setup();
    const { code, text } = s.sheet(s.scenario(), "--include", "d1:opening");
    expect(code).toBe(0);
    const rows = s.decisions();
    expect(rows.map((r) => r.criterion_id)).toEqual([
      "opening",
      "understanding",
      CRITS[2],
      CRITS[3],
    ]);
    expect(rows[0]).toMatchObject({ a_answer: "yes", b_answer: "yes", decision: "" });
    expect(text()).toContain("total rows: 4, agreed: 0, to review: 4");
    const md = readFileSync(`${s.dir}/runs/t-review.md`, "utf8");
    expect(md).toContain("### opening: Opening the conversation");
  });

  test("--include rejects rows that are not labeled in the set", () => {
    const s = setup();
    const bad = s.sheet(s.scenario(), "--include", "d1:closing");
    expect(bad.code).toBe(1);
    expect(bad.errText()).toContain("d1:closing");
    expect(existsSync(`${s.dir}/lab/t-decisions.csv`)).toBe(false);
    const malformed = s.sheet(s.scenario(), "--include", "d1");
    expect(malformed.code).toBe(1);
    expect(malformed.errText()).toContain("conversation_id:criterion_id");
  });

  test("regenerating the round 1 sheet with --include keeps its rows and adds the included", () => {
    const before = round1().keys;
    const after = round1("--include", "p1-ru-003:closing,p1-ru-007:guidance");
    expect(after.text).toContain("total rows: 136, agreed: 111, to review: 25");
    expect(after.keys.filter((k) => !before.includes(k))).toEqual([
      "p1-ru-003:closing",
      "p1-ru-007:guidance",
    ]);
    expect(after.keys.filter((k) => before.includes(k))).toEqual(before);
  });
});

describe("review finalize", () => {
  test("all decided, with evidence from the labelers who agree with the result", () => {
    const s = setup();
    const r = s.finalize([
      { decision: "no", reviewer: "me", reason: "r" },
      { decision: "no", reviewer: "me" },
      { decision: "na", reviewer: "me" },
    ]);
    expect(r.code).toBe(0);
    expect(r.text()).toContain("agreed: 1, decided: 3, pending: 0");
    const rows = r.final();
    expect(rows.opening).toMatchObject({ evidence_turns: "1;2", note: "ai-agreed" });
    expect(rows.understanding).toMatchObject({ evidence_turns: "1", note: "human: me: r" });
    expect(rows[CRITS[2]].evidence_turns).toBe("3");
    expect(rows[CRITS[3]].evidence_turns).toBe("");
    expect(new Set(Object.values(rows).map((row) => row.labeler))).toEqual(new Set(["final"]));
  });

  test("invalid decision", () => {
    const s = setup();
    const r = s.finalize([{ decision: "maybe" }, { decision: "maybe" }, { decision: "maybe" }]);
    expect(r.code).toBe(1);
    expect(r.errText()).toContain("'maybe' not allowed");
    expect(existsSync(r.out)).toBe(false);
  });

  test("pending decisions fail unless allowed", () => {
    const s = setup();
    const strict = s.finalize([{ decision: "no" }]);
    expect(strict.code).toBe(1);
    expect(strict.errText()).toContain("decision missing");
    const lenient = s.finalize([{ decision: "no" }], { extra: ["--allow-pending"] });
    expect(lenient.code).toBe(0);
    expect(lenient.text()).toContain("agreed: 1, decided: 1, pending: 2");
    expect(Object.keys(lenient.final()).sort()).toEqual(["opening", "understanding"]);
  });

  test("a decision on an agreed row overrides it", () => {
    const s = setup();
    const r = s.finalize(
      {
        "d1:opening": { decision: "no", reviewer: "rev", reason: "no name given" },
        "d1:understanding": { decision: "yes", reviewer: "rev" },
        [`d1:${CRITS[2]}`]: { decision: "no", reviewer: "rev" },
        [`d1:${CRITS[3]}`]: { decision: "na", reviewer: "rev" },
      },
      { include: "d1:opening" },
    );
    expect(r.code).toBe(0);
    expect(r.text()).toContain("agreed: 0, decided: 3, pending: 0, overridden: 1");
    const rows = r.final();
    // Neither labeler answered "no", so no evidence supports the override.
    expect(rows.opening).toMatchObject({
      answer: "no",
      evidence_turns: "",
      note: "human override: rev: no name given",
    });
    expect(rows.understanding).toMatchObject({ evidence_turns: "2", note: "human: rev: " });
  });

  test("an override that matches the labelers keeps their evidence", () => {
    const s = setup();
    const r = s.finalize({
      // Added by hand to a sheet made without --include.
      "d1:opening": { decision: "yes", reviewer: "rev", reason: "checked" },
      "d1:understanding": { decision: "no" },
      [`d1:${CRITS[2]}`]: { decision: "no" },
      [`d1:${CRITS[3]}`]: { decision: "na" },
    });
    expect(r.code).toBe(0);
    expect(r.final().opening).toMatchObject({
      answer: "yes",
      evidence_turns: "1;2",
      note: "human override: rev: checked",
    });
  });

  test("an included row left empty keeps the agreed answer", () => {
    const s = setup();
    const r = s.finalize([{}, { decision: "no" }, { decision: "no" }, { decision: "na" }], {
      include: "d1:opening",
    });
    expect(r.code).toBe(0);
    expect(r.text()).toContain("agreed: 1, decided: 3, pending: 0");
    expect(r.final().opening.note).toBe("ai-agreed");
  });
});
