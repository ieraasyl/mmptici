import { describe, expect, test } from "vite-plus/test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { defaultChecklist } from "../../apps/api/src/checklist.ts";
import { capture, tempDir } from "../calibrate/test-helpers.ts";
import { main as exportMain } from "./export.ts";
import { main } from "./from-calibration-run.ts";
import { parseRunFile } from "./run-file.ts";
import { records as makeRecords } from "./validate.test.ts";

describe("submission:from-run", () => {
  test("converts a single-sample calibration run and exports it", async () => {
    const dir = tempDir();
    const records = makeRecords(10);
    const input = join(dir, "input.json");
    writeFileSync(input, JSON.stringify({ group: "DEV", records }));
    const ratings = defaultChecklist.criteria.map((c) => ({
      criterionId: c.id,
      answer: c.kind === "numeric" ? c.scale.at(-1)! : "yes",
      explanation: "ok",
      evidence: [1],
    }));
    const calibration = {
      promptVersion: "p-abc12345",
      provider: "hf-router",
      model: "Qwen/Qwen3.8-27B:cerebras",
      samples: 1,
      temperature: 0,
      commit: "abc1234",
      createdAt: "2026-11-07T18:25:59.804Z",
      provenance: { sources: { "apps/api/src/inference/prompt.ts": "f4b7ee2e04c4" } },
      dialogs: records.slice(0, 9).map((r, i) => ({
        conversationId: r.conversation_id,
        ratings: i === 4 ? [] : ratings,
        total: i === 4 ? null : 100,
        run: {
          errors: i === 4 ? ["cut off"] : [],
          usage: { promptTokens: 1, completionTokens: 1 },
          requests: 1,
        },
      })),
    };
    const from = join(dir, "calibration.json");
    writeFileSync(from, JSON.stringify(calibration));
    const run = join(dir, "run.json");
    const { io, text } = capture();
    expect(await main(["--from", from, "--input", input, "--run", run], io)).toBe(1);
    expect(text()).toContain("8 succeeded, 1 failed, 1 missing");
    const file = parseRunFile(JSON.parse(readFileSync(run, "utf8")), run);
    expect(file.evaluator.promptVersion).toBe("p-abc12345");
    expect(file.records["c-001"]).toMatchObject({
      status: "succeeded",
      model: "Qwen/Qwen3.8-27B:cerebras",
    });
    expect(file.records["c-005"]).toMatchObject({ status: "failed", error: "cut off" });
    expect(file.records["c-010"]).toMatchObject({ status: "pending" });
    // Export refuses while c-010 is pending, which keeps a partial calibration run out of the results.
    const out = join(dir, "results.json");
    await expect(
      exportMain(
        ["--input", input, "--run", run, "--team-name", "t", "--dataset", "prod", "--out", out],
        capture().io,
      ),
    ).rejects.toThrow(/not finished/);
    await expect(
      main(["--from", from, "--input", input, "--run", run], capture().io),
    ).rejects.toThrow(/already exists/);
  });

  test("refuses multi-sample runs", async () => {
    const dir = tempDir();
    const input = join(dir, "input.json");
    writeFileSync(input, JSON.stringify({ group: "DEV", records: makeRecords(10) }));
    const from = join(dir, "calibration.json");
    writeFileSync(
      from,
      JSON.stringify({ promptVersion: "p-1", model: "m", samples: 3, dialogs: [] }),
    );
    await expect(
      main(["--from", from, "--input", input, "--run", join(dir, "run.json")], capture().io),
    ).rejects.toThrow(/samples/);
  });
});
