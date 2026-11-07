import { describe, expect, test } from "vite-plus/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultChecklist } from "../../apps/api/src/checklist.ts";
import { scoreEvaluation } from "../../apps/api/src/evaluation.ts";
import {
  buildSubmissionError,
  buildSubmissionResult,
  type Answer,
  type ConversationRecord,
  type Rating,
  type SubmissionFile,
} from "../../packages/contracts/src/index.ts";
import { capture } from "../calibrate/test-helpers.ts";
import { formatIssue, main, parseDataset, validateSubmission } from "./validate.ts";

const turn = (speaker: ConversationRecord["transcript"][number]["speaker"], text: string) => ({
  timestamp: "00:01",
  speaker,
  text,
});

export function records(count: number, prefix = "c"): ConversationRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    conversation_id: `${prefix}-${String(i + 1).padStart(3, "0")}`,
    channel: "agent chat" as const,
    language: "RU" as const,
    transcript: [
      turn("client", "Здравствуйте"),
      turn("operator", "Добрый день, Анна"),
      turn("client", "Спасибо"),
    ],
    audio_url: null,
  }));
}

const allYes: Answer[] = ["yes", "yes", "yes", 20, "yes", 10, "yes", "no"];
const ratings = (values: Answer[]): Rating[] =>
  defaultChecklist.criteria.map(({ id }, index) => ({
    criterionId: id,
    answer: values[index],
    explanation: `${id} ok`,
    evidence: [2],
  }));

function ok(conversationId: string, values = allYes) {
  const rated = ratings(values);
  return buildSubmissionResult({
    conversationId,
    checklist: defaultChecklist,
    ratings: rated,
    score: scoreEvaluation(defaultChecklist, rated, []),
  });
}

function file(results: SubmissionFile["results"]): SubmissionFile {
  return {
    schema_version: "1.0",
    team_name: "mmptici",
    model: { mode: "external_api", name: "fake" },
    results,
  };
}

const prod = records(10);
const prodFile = () => file(prod.map((r) => ok(r.conversation_id)));

describe("validateSubmission", () => {
  test("a complete prod submission with one failure row is valid", () => {
    const results = prod.map((r, i) =>
      i === 3 ? buildSubmissionError(r.conversation_id, "timed out") : ok(r.conversation_id),
    );
    const v = validateSubmission(prod, file(results), "prod");
    expect(v.issues).toEqual([]);
    expect(v).toMatchObject({ ok: true, counts: { input: 10, ok: 9, error: 1 } });
  });

  test("record counts are enforced per dataset", () => {
    const v = validateSubmission(prod, prodFile(), "dev");
    expect(v.ok).toBe(false);
    expect(v.issues.map(formatIssue)).toContain("the dev input has 10 records, expected 65");
  });

  test("missing, extra, and duplicate conversation IDs are named", () => {
    const f = prodFile();
    f.results = [...f.results.slice(1), f.results[1], ok("ghost-1")];
    const messages = validateSubmission(prod, f, "prod").issues.map(formatIssue);
    expect(messages).toContain("c-001: is missing from the results");
    expect(messages).toContain("c-002: appears 2 times in the results");
    expect(messages).toContain("ghost-1: is not in the input dataset");
  });

  test("evidence past the transcript and a wrong total name the conversation and field", () => {
    const f = prodFile();
    const target = f.results[0] as Extract<SubmissionFile["results"][number], { status: "ok" }>;
    target.criteria[0].evidence_turns = [1, 4];
    target.score.final_score = 99.5;
    const messages = validateSubmission(prod, f, "prod").issues.map(formatIssue);
    expect(messages).toContain("c-001 contact.evidence_turns: turns 4 are outside 1 to 3");
    expect(messages).toContain("c-001 score.final_score: is 99.5, recomputed 100");
  });

  test("schema problems identify the conversation and field", () => {
    const f = prodFile() as unknown as { results: Record<string, unknown>[] };
    const row = f.results[2] as { criteria: Record<string, unknown>[] };
    row.criteria[5].value = "7";
    const messages = validateSubmission(prod, f, "prod").issues.map(formatIssue);
    expect(messages.some((m) => m.startsWith("c-003 criteria.5.value"))).toBe(true);
  });

  test("a critical flag that disagrees with the critical value is rejected", () => {
    const f = prodFile();
    const target = f.results[0] as Extract<SubmissionFile["results"][number], { status: "ok" }>;
    target.score.critical_flag = true;
    const messages = validateSubmission(prod, f, "prod").issues.map(formatIssue);
    expect(messages.some((m) => m.includes("critical_flag"))).toBe(true);
  });

  test("N/A answers rescore through redistribution", () => {
    const f = file(
      prod.map((r) => ok(r.conversation_id, ["yes", "na", "na", 15, "yes", 7, "na", "no"])),
    );
    const v = validateSubmission(prod, f, "prod");
    expect(v.ok).toBe(true);
    expect((f.results[0] as { score: { final_score: number } }).score.final_score).toBe(84.17);
  });
});

describe("CLI", () => {
  function write(name: string, value: unknown) {
    const dir = mkdtempSync(join(tmpdir(), "submission-"));
    const path = join(dir, name);
    writeFileSync(path, JSON.stringify(value));
    return path;
  }

  test("accepts the organizer envelope and exits 0 for a valid file", () => {
    const input = write("input.json", {
      error: "",
      isSuccess: true,
      data: { dataset_group_id: "CTRL", total_records: 10, records: prod },
    });
    expect(
      parseDataset(
        JSON.parse(
          JSON.stringify({ isSuccess: true, data: { dataset_group_id: "CTRL", records: prod } }),
        ),
      ),
    ).toHaveLength(10);
    const results = write("results.json", prodFile());
    const { io, out } = capture();
    expect(main(["--input", input, "--results", results, "--dataset", "prod"], io)).toBe(0);
    expect(out.at(-1)).toBe("VALID");
  });

  test("exits 1 and prints the offending conversation for an invalid file", () => {
    const input = write("input.json", { group: "CTRL", records: prod });
    const f = prodFile();
    f.results.pop();
    const results = write("results.json", f);
    const { io, out, err } = capture();
    expect(main(["--input", input, "--results", results, "--dataset", "prod"], io)).toBe(1);
    expect(out.at(-1)).toBe("INVALID");
    expect(err).toContain("c-010: is missing from the results");
  });

  test("usage errors for a bad dataset name", () => {
    const { io } = capture();
    expect(() => main(["--input", "x", "--results", "y", "--dataset", "test"], io)).toThrow(
      /dev or prod/,
    );
  });
});
