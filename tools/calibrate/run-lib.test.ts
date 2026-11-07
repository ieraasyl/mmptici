import { describe, expect, test } from "vite-plus/test";
import { defaultChecklist } from "../../apps/api/src/checklist.ts";
import type { LlmClient } from "../../apps/api/src/inference/index.ts";
import { fakeLlm, invalid, valid } from "./fake-llm.ts";
import {
  aggregate,
  contentVersion,
  costUsd,
  evaluateDialog,
  isRetryable,
  mapLimit,
  meteredClient,
  priorPasses,
  selectIds,
  withRetry,
  type BatchOptions,
  type SampleRating,
} from "./run-lib.ts";

const sets = { tuning: ["t1", "t2"], heldout: ["h1"] };
const all = ["t1", "t2", "h1", "x1"];

describe("selectIds", () => {
  test("named sets and the full DEV list", () => {
    expect(selectIds("tuning", sets, all)).toEqual(["t1", "t2"]);
    expect(selectIds("all", sets, ["t1", "t2", "x1"])).toEqual(["t1", "t2", "x1"]);
    expect(selectIds("t2, x1", sets, all)).toEqual(["t2", "x1"]);
    expect(selectIds("dev", sets, all)).toEqual(["t1", "t2", "x1"]);
  });

  test("held-out dialogs need a frozen prompt version", () => {
    expect(() => selectIds("heldout", sets, all)).toThrow(/held-out/);
    expect(() => selectIds("all20", sets, all)).toThrow(/held-out/);
    expect(() => selectIds("x1,h1", sets, all)).toThrow(/held-out/);
    expect(() => selectIds("all", sets, all)).toThrow(/held-out/);
    expect(selectIds("heldout", sets, all, "p-1234")).toEqual(["h1"]);
  });

  test("unknown IDs are rejected", () => {
    expect(() => selectIds("t1,nope", sets, all)).toThrow(/nope/);
  });
});

const rating = (criterionId: string, answer: SampleRating["answer"], evidence = [1]) => ({
  criterionId,
  answer,
  explanation: `${criterionId}=${answer}`,
  evidence,
});

describe("aggregate", () => {
  test("unanimous samples give confidence 1", () => {
    const s = [rating("a", "yes")];
    const [a] = aggregate([s, s, s], ["a"])!;
    expect(a).toMatchObject({ answer: "yes", confidence: 1, votes: ["yes", "yes", "yes"] });
  });

  test("2-1 split takes the majority and its evidence", () => {
    const [a] = aggregate(
      [[rating("a", "no", [1])], [rating("a", "yes", [2])], [rating("a", "yes", [3])]],
      ["a"],
    )!;
    expect(a.answer).toBe("yes");
    expect(a.evidence).toEqual([2]);
    expect(a.confidence).toBeCloseTo(2 / 3);
  });

  test("three different answers go to the earliest sample", () => {
    const [a] = aggregate([[rating("a", 10)], [rating("a", 15)], [rating("a", "na")]], ["a"])!;
    expect(a.answer).toBe(10);
    expect(a.confidence).toBeCloseTo(1 / 3);
  });

  test("failed samples lower confidence; all failed gives null", () => {
    const [a] = aggregate([null, [rating("a", "yes")], null], ["a"])!;
    expect(a.confidence).toBeCloseTo(1 / 3);
    expect(aggregate([null, null], ["a"])).toBeNull();
  });

  test("numeric and string answers are not merged", () => {
    const [a] = aggregate([[rating("a", 10)], [rating("a", 10)], [rating("a", "na")]], ["a"])!;
    expect(a).toMatchObject({ answer: 10, votes: [10, 10, "na"] });
  });
});

describe("helpers", () => {
  test("cost uses the Cerebras list price", () => {
    expect(costUsd({ promptTokens: 1_000_000, completionTokens: 1_000_000 })).toBeCloseTo(2.48);
  });

  test("retry only on transient errors", async () => {
    let calls = 0;
    const flaky = () => {
      calls++;
      return calls < 3
        ? Promise.reject(new Error("Inference API error 429: slow down"))
        : Promise.resolve("ok");
    };
    await expect(withRetry(flaky, { baseMs: 0 })).resolves.toBe("ok");
    expect(calls).toBe(3);

    let hard = 0;
    const broken = () => {
      hard++;
      return Promise.reject(new Error("Inference API error 401: bad token"));
    };
    await expect(withRetry(broken, { baseMs: 0 })).rejects.toThrow(/401/);
    expect(hard).toBe(1);
    expect(isRetryable(new Error("fetch failed"))).toBe(true);
  });

  test("mapLimit keeps order and bounds concurrency", async () => {
    let inFlight = 0;
    let peak = 0;
    const out = await mapLimit([5, 1, 3, 2, 4], 2, async (n) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, n));
      inFlight--;
      return n * 10;
    });
    expect(out).toEqual([50, 10, 30, 20, 40]);
    expect(peak).toBe(2);
  });

  test("contentVersion is stable and content-sensitive", () => {
    expect(contentVersion("a", "b")).toBe(contentVersion("a", "b"));
    expect(contentVersion("a", "b")).not.toBe(contentVersion("a", "c"));
    expect(contentVersion("x")).toMatch(/^p-[0-9a-f]{8}$/);
  });
});

const record = {
  conversation_id: "x1",
  language: "EN",
  channel: "agent chat",
  transcript: [
    { timestamp: "00:00", speaker: "client" as const, text: "hello" },
    { timestamp: "00:10", speaker: "operator" as const, text: "hi, I am Ann" },
  ],
};
const options = (llm: LlmClient, samples = 1): BatchOptions => ({
  llm,
  checklist: defaultChecklist,
  samples,
  retry: { tries: 3, baseMs: 0 },
});

describe("usage accounting", () => {
  test("a sample that exhausts validation retries keeps its tokens and cost", async () => {
    const { llm } = fakeLlm([invalid]);
    const dialog = await evaluateDialog(record, options(llm));
    expect(dialog.ratings).toEqual([]);
    expect(dialog.run).toMatchObject({
      requests: 2,
      responses: 2,
      parsedResponses: 0,
      responsesWithoutUsage: 0,
      usage: { promptTokens: 200, completionTokens: 100 },
      failedSamples: 1,
    });
    expect(dialog.run.costUsd).toBeGreaterThan(0);
    expect(dialog.run.errors.length).toBeGreaterThan(0);
  });

  test("attempts before a transient error are counted", async () => {
    const { llm } = fakeLlm([invalid, new Error("Inference API error 429: slow down"), valid]);
    const dialog = await evaluateDialog(record, options(llm));
    expect(dialog.total).not.toBeNull();
    expect(dialog.run).toMatchObject({
      requests: 3,
      responses: 2,
      parsedResponses: 1,
      usage: { promptTokens: 200, completionTokens: 100 },
      failedSamples: 0,
    });
  });

  test("replies without usage are recorded as such, not as zero cost", async () => {
    const { llm } = fakeLlm([{ content: valid, model: "fake" }]);
    const { client, accounting } = meteredClient(llm);
    await client.complete([]);
    expect(accounting).toMatchObject({ requests: 1, responses: 1, responsesWithoutUsage: 1 });
    const dialog = await evaluateDialog(record, options(llm, 2));
    expect(dialog.run).toMatchObject({
      responses: 2,
      parsedResponses: 2,
      responsesWithoutUsage: 2,
    });
  });

  test("older run files become one pass; a failed dialog's replies have unknown usage", () => {
    const [pass] = priorPasses({
      latencyMs: 900,
      usage: { promptTokens: 0, completionTokens: 0 },
      costUsd: 0,
      failedSamples: 1,
      calls: 2,
      errors: ["bad"],
    });
    expect(pass).toMatchObject({ requests: 2, responses: 2, responsesWithoutUsage: 2 });
    expect(priorPasses(undefined)).toEqual([]);
  });
});
