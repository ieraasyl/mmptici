import { describe, expect, test } from "vite-plus/test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { defaultChecklist } from "../../apps/api/src/checklist.ts";
import { InferenceApiError, type LlmClient } from "../../apps/api/src/inference/index.ts";
import type { ConversationRecord } from "../../packages/contracts/src/index.ts";
import { valid } from "../calibrate/fake-llm.ts";
import { capture, tempDir } from "../calibrate/test-helpers.ts";
import { main as exportMain } from "./export.ts";
import { parseRunFile, type RunFile } from "./run-file.ts";
import { main as runMain, type RunDeps } from "./run.ts";
import { records as makeRecords } from "./validate.test.ts";

/** A fake model: a valid reply, unless the transcript asks it to fail. */
function fakeClient(
  options: { calls?: string[]; fail?: (text: string) => Error | undefined } = {},
) {
  const create: NonNullable<RunDeps["createClient"]> = (model) => {
    const llm: LlmClient = {
      model,
      async complete(messages) {
        const { transcript } = JSON.parse(messages[1].content) as {
          transcript: { text: string }[];
        };
        const text = transcript.map((t) => t.text).join(" ");
        options.calls?.push(text);
        const error = options.fail?.(text);
        if (error) throw error;
        return { content: valid, model, usage: { promptTokens: 10, completionTokens: 5 } };
      },
    };
    return llm;
  };
  return create;
}

const fingerprint =
  (version = "p-test0000") =>
  () => ({ promptVersion: version, sources: {} });

function setup(count = 10) {
  const dir = tempDir();
  const records: ConversationRecord[] = makeRecords(count).map((r) => ({
    ...r,
    transcript: [
      { timestamp: "00:01", speaker: "operator", text: `hello from ${r.conversation_id}` },
    ],
  }));
  const input = join(dir, "input.json");
  writeFileSync(
    input,
    JSON.stringify({ isSuccess: true, data: { dataset_group_id: "CTRL", records } }),
  );
  const run = join(dir, "run.json");
  const out = join(dir, "results.json");
  const read = () => parseRunFile(JSON.parse(readFileSync(run, "utf8")), run);
  return { dir, records, input, run, out, read };
}

const failOn = (ids: string[]) => (text: string) =>
  ids.some((id) => text.includes(id)) ? new Error("boom") : undefined;

describe("submission:run", () => {
  test("records successes and failures, then both survive export and validation", async () => {
    const { input, run, out, read } = setup();
    const { io, errText } = capture();
    const deps: RunDeps = {
      createClient: fakeClient({ fail: failOn(["c-004"]) }),
      fingerprint: fingerprint(),
    };
    expect(await runMain(["--input", input, "--run", run], io, deps)).toBe(1);
    const file = read();
    expect(file.records["c-004"]).toMatchObject({
      status: "failed",
      attempts: 1,
      error: "Error: boom",
    });
    expect(file.records["c-004"].failures).toHaveLength(1);
    expect(file.records["c-001"]).toMatchObject({
      status: "succeeded",
      attempts: 1,
      model: "Qwen/Qwen3.8-27B:cerebras",
    });
    expect(file.records["c-001"].ratings).toHaveLength(8);
    expect(errText()).toContain("c-004");

    const exp = capture();
    expect(
      await exportMain(
        [
          "--input",
          input,
          "--run",
          run,
          "--team-name",
          "mmptici",
          "--dataset",
          "prod",
          "--out",
          out,
        ],
        exp.io,
      ),
    ).toBe(0);
    const results = JSON.parse(readFileSync(out, "utf8"));
    expect(results.model).toEqual({ mode: "external_api", name: "Qwen/Qwen3.8-27B:cerebras" });
    expect(results.results.map((r: { conversation_id: string }) => r.conversation_id)).toEqual(
      Array.from({ length: 10 }, (_, i) => `c-${String(i + 1).padStart(3, "0")}`),
    );
    expect(results.results[3]).toEqual({
      conversation_id: "c-004",
      status: "error",
      criteria: [],
      score: null,
      error: "Error: boom",
    });
    expect(results.results[0].status).toBe("ok");
    expect(
      results.results[0].criteria.map((c: { criterion_id: string }) => c.criterion_id),
    ).toEqual([
      "contact",
      "discovery",
      "identification",
      "consultation",
      "empathy",
      "dialogue",
      "closure",
      "critical",
    ]);
    expect(exp.text()).toContain("VALID");
  });

  test("an interrupted run resumes without repeating completed calls", async () => {
    const { input, run, read } = setup();
    const first = capture();
    expect(
      await runMain(["--input", input, "--run", run], first.io, {
        createClient: fakeClient(),
        fingerprint: fingerprint(),
      }),
    ).toBe(0);
    // Simulate an interruption: two records never finished.
    const file = read();
    file.records["c-002"] = { status: "running", attempts: 0, failures: [], startedAt: "x" };
    file.records["c-007"] = { status: "pending", attempts: 0, failures: [] };
    writeFileSync(run, JSON.stringify(file));

    const calls: string[] = [];
    const second = capture();
    expect(
      await runMain(["--resume", run], second.io, {
        createClient: fakeClient({ calls }),
        fingerprint: fingerprint(),
      }),
    ).toBe(0);
    expect(calls.map((t) => t.replace("hello from ", "")).sort()).toEqual(["c-002", "c-007"]);
    expect(Object.values(read().records).every((r) => r.status === "succeeded")).toBe(true);

    const third = capture();
    expect(
      await runMain(["--resume", run], third.io, {
        createClient: fakeClient({ calls }),
        fingerprint: fingerprint(),
      }),
    ).toBe(0);
    expect(calls).toHaveLength(2);
    expect(third.text()).toContain("Nothing to evaluate");
  });

  test("retry evaluates only failed IDs and keeps the failure history", async () => {
    const { input, run, read } = setup();
    const calls: string[] = [];
    await runMain(["--input", input, "--run", run], capture().io, {
      createClient: fakeClient({ calls, fail: failOn(["c-003", "c-008"]) }),
      fingerprint: fingerprint(),
    });
    expect(calls).toHaveLength(10);
    // --resume does not touch failed records.
    expect(
      await runMain(["--resume", run], capture().io, {
        createClient: fakeClient({ calls }),
        fingerprint: fingerprint(),
      }),
    ).toBe(1);
    expect(calls).toHaveLength(10);
    expect(
      await runMain(["--retry-failed", run], capture().io, {
        createClient: fakeClient({ calls }),
        fingerprint: fingerprint(),
      }),
    ).toBe(0);
    expect(
      calls
        .slice(10)
        .map((t) => t.replace("hello from ", ""))
        .sort(),
    ).toEqual(["c-003", "c-008"]);
    const record = read().records["c-003"];
    expect(record).toMatchObject({ status: "succeeded", attempts: 2 });
    expect(record.failures).toEqual([{ at: expect.any(String), error: "Error: boom" }]);
    expect(record.error).toBeUndefined();
  });

  test("a changed transcript, evaluator, model, or checklist prevents a resume", async () => {
    const { input, run, records, read } = setup();
    await runMain(["--input", input, "--run", run], capture().io, {
      createClient: fakeClient({ fail: failOn(["c-001"]) }),
      fingerprint: fingerprint(),
    });
    const resume = (deps: RunDeps, args: string[] = ["--retry-failed", run]) =>
      runMain(args, capture().io, deps);

    await expect(
      resume({ createClient: fakeClient(), fingerprint: fingerprint("p-changed0") }),
    ).rejects.toThrow(/evaluator changed/);

    const changed = join(tempDir(), "changed.json");
    const edited = structuredClone(records);
    edited[5].transcript[0].text = "edited";
    writeFileSync(changed, JSON.stringify({ group: "CTRL", records: edited }));
    await expect(
      resume({ createClient: fakeClient(), fingerprint: fingerprint() }, [
        "--retry-failed",
        run,
        "--input",
        changed,
      ]),
    ).rejects.toThrow(/input changed/);

    const file = read();
    file.model.name = "other/model";
    writeFileSync(run, JSON.stringify(file));
    await expect(
      resume({ createClient: fakeClient(), fingerprint: fingerprint() }),
    ).rejects.toThrow(/model\.name changed/);

    file.model.name = "Qwen/Qwen3.8-27B:cerebras";
    file.checklist.fingerprint = "0000000000000000";
    writeFileSync(run, JSON.stringify(file));
    await expect(
      resume({ createClient: fakeClient(), fingerprint: fingerprint() }),
    ).rejects.toThrow(/checklist changed/);
  });

  test("concurrent completions all reach the checkpoint", async () => {
    const { input, run, read } = setup(25);
    expect(
      await runMain(["--input", input, "--run", run, "--concurrency", "4"], capture().io, {
        createClient: fakeClient(),
        fingerprint: fingerprint(),
      }),
    ).toBe(0);
    const statuses = Object.values(read().records).map((r) => r.status);
    expect(statuses).toHaveLength(25);
    expect(statuses.every((s) => s === "succeeded")).toBe(true);
    await expect(
      runMain(["--input", input, "--run", run, "--concurrency", "5"], capture().io, {
        createClient: fakeClient(),
        fingerprint: fingerprint(),
      }),
    ).rejects.toThrow(/concurrency/);
  });

  test("rejected credentials stop the run after the first failure", async () => {
    const { input, run, read } = setup();
    const calls: string[] = [];
    const deps: RunDeps = {
      createClient: fakeClient({ calls, fail: () => new InferenceApiError(401, "bad token") }),
      fingerprint: fingerprint(),
    };
    expect(
      await runMain(["--input", input, "--run", run, "--concurrency", "1"], capture().io, deps),
    ).toBe(1);
    expect(calls).toHaveLength(1);
    const statuses = Object.values(read().records).map((r) => r.status);
    expect(statuses.filter((s) => s === "failed")).toHaveLength(1);
    expect(statuses.filter((s) => s === "pending")).toHaveLength(9);
    expect(read().records["c-001"].error).not.toContain("bad token");
  });

  test("refuses to overwrite an existing run file", async () => {
    const { input, run } = setup();
    await runMain(["--input", input, "--run", run], capture().io, {
      createClient: fakeClient(),
      fingerprint: fingerprint(),
    });
    await expect(
      runMain(["--input", input, "--run", run], capture().io, {
        createClient: fakeClient(),
        fingerprint: fingerprint(),
      }),
    ).rejects.toThrow(/already exists/);
  });
});

describe("submission:export", () => {
  async function finished() {
    const s = setup();
    await runMain(["--input", s.input, "--run", s.run], capture().io, {
      createClient: fakeClient(),
      fingerprint: fingerprint(),
    });
    return s;
  }
  const args = (s: { input: string; run: string; out: string }, extra: string[] = []) => [
    "--input",
    s.input,
    "--run",
    s.run,
    "--team-name",
    "mmptici",
    "--dataset",
    "prod",
    "--out",
    s.out,
    ...extra,
  ];

  test("refuses while conversations are pending or running", async () => {
    const s = await finished();
    const file = s.read();
    file.records["c-005"].status = "pending";
    writeFileSync(s.run, JSON.stringify(file));
    await expect(exportMain(args(s), capture().io)).rejects.toThrow(/not finished \(c-005\)/);
  });

  test("malformed run artifacts cannot produce successful results", async () => {
    const s = await finished();
    const good = readFileSync(s.run, "utf8");
    const corrupt = (edit: (file: RunFile) => void) => {
      const file = JSON.parse(good) as RunFile;
      edit(file);
      writeFileSync(s.run, JSON.stringify(file));
    };
    corrupt((file) => delete file.records["c-002"].ratings);
    await expect(exportMain(args(s), capture().io)).rejects.toThrow(/not a valid run file/);
    corrupt((file) => {
      file.records["c-002"].ratings![0].answer = "maybe" as never;
    });
    await expect(exportMain(args(s), capture().io)).rejects.toThrow(/not a valid run file/);
    corrupt((file) => {
      file.records["ghost"] = { status: "pending", attempts: 0, failures: [] };
    });
    await expect(exportMain(args(s), capture().io)).rejects.toThrow(/unexpected ghost/);
  });

  test("refuses a run made from a different input and an unfit checklist", async () => {
    const s = await finished();
    const other = join(tempDir(), "other.json");
    writeFileSync(other, JSON.stringify({ group: "CTRL", records: makeRecords(10, "d") }));
    await expect(exportMain(args({ ...s, input: other }), capture().io)).rejects.toThrow(
      /different input/,
    );

    const file = s.read();
    file.checklist.snapshot.criteria = file.checklist.snapshot.criteria.map((c) =>
      c.id === "closing" ? { ...c, id: "tone" } : c,
    );
    writeFileSync(s.run, JSON.stringify(file));
    await expect(exportMain(args(s), capture().io)).rejects.toThrow(/does not fit/);
  });

  test("validates the dataset size before writing", async () => {
    const s = await finished();
    const { io, text } = capture();
    expect(await exportMain(args(s, ["--dataset", "dev"]), io)).toBe(1);
    expect(text()).toContain("INVALID");
    expect(() => readFileSync(s.out)).toThrow();
  });

  test("the exported checklist is the default one", async () => {
    const s = await finished();
    expect(s.read().checklist.snapshot).toEqual(defaultChecklist);
  });
});
