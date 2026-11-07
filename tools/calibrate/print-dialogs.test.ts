import { readFileSync } from "node:fs";
import { describe, expect, test } from "vite-plus/test";
import { defaultChecklist } from "../../apps/api/src/checklist.ts";
import { DEFAULT_DATA, loadRecords } from "./labels.ts";
import { HEADER, main, renderDialog } from "./print-dialogs.ts";
import { capture, tempDir } from "./test-helpers.ts";

function run(...args: string[]) {
  const c = capture();
  return { code: main(args, c.io), ...c };
}

describe("print-dialogs", () => {
  test("dialog Markdown numbers turns from 1", () => {
    const dir = tempDir();
    const { code, out } = run("--out", dir, "--set", "p1-ru-003");
    expect(code).toBe(0);
    expect(out).toEqual([`${dir}/p1-ru-003.md`]);
    const text = readFileSync(`${dir}/p1-ru-003.md`, "utf8");
    const record = loadRecords(DEFAULT_DATA).find((r) => r.conversation_id === "p1-ru-003")!;
    const lines = text.split("\n");
    expect(lines[0]).toBe("# p1-ru-003");
    expect(lines[2]).toContain("tuning");
    const turnLines = lines.filter((l) => /^\[\d+\] /.test(l));
    expect(turnLines).toHaveLength(record.transcript.length);
    expect(turnLines[0].startsWith("[1] ")).toBe(true);
    expect(turnLines[0]).toContain(record.transcript[0].text.split("\n").join(" "));
    const rows = lines.filter(
      (l) => l.startsWith("| ") && !l.includes("criterion_id") && !l.includes("---"),
    );
    expect(rows).toHaveLength(8);
    const byId = Object.fromEntries(rows.map((r) => [r.split(" | ")[0].slice(2), r]));
    expect(byId.understanding).toContain("| yes/no/na |");
    expect(byId.guidance).toContain("| 0/5/10/15/20/na |");
  });

  test("line breaks inside a turn become spaces", () => {
    const text = renderDialog(
      {
        conversation_id: "x",
        channel: "agent chat",
        language: "EN",
        transcript: [{ speaker: "client", timestamp: "00:01", text: "one\r\ntwo\nthree\n" }],
      },
      "other",
      defaultChecklist,
    );
    expect(text).toContain("[1] client 00:01: one two three\n");
  });

  test("template for dauka", () => {
    const dir = tempDir();
    const { out } = run("--out", dir, "--template", "dauka");
    expect(out).toEqual([`${dir}/labels-dauka.csv`]);
    const raw = readFileSync(`${dir}/labels-dauka.csv`, "utf8");
    const rows = raw
      .trimEnd()
      .split("\r\n")
      .map((l) => l.split(","));
    expect(rows[0]).toEqual(HEADER);
    expect(rows.length - 1).toBe(56);
    expect(rows[1][0]).toBe("p1-ru-003");
    expect(rows.at(-1)![0]).toBe("p1-en-014");
  });

  test("unknown labeler or dialog exits 2", () => {
    const dir = tempDir();
    const labeler = run("--out", dir, "--template", "nobody");
    expect(labeler.code).toBe(2);
    expect(labeler.errText()).toContain("nobody");
    const dialog = run("--out", dir, "--set", "p1-zz-999");
    expect(dialog.code).toBe(2);
    expect(dialog.errText()).toContain("unknown conversation id: p1-zz-999");
  });
});
