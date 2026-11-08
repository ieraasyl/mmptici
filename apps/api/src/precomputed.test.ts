import { datasetFileSchema, precomputedEvaluationsSchema } from "@app/contracts";
import { describe, expect, it } from "vite-plus/test";
import devDataset from "../../../data/invoke.json";
import precomputed from "../../../data/evaluations-dev.json";
import { defaultChecklist } from "./checklist.ts";
import {
  checkRatings,
  planPrecomputedImport,
  precomputedEvaluationId,
  type PrecomputedTarget,
} from "./precomputed.ts";

describe("precomputed DEV evaluations", () => {
  const data = precomputedEvaluationsSchema.parse(precomputed);
  const records = new Map(
    datasetFileSchema.parse(devDataset).records.map((record) => [record.conversation_id, record]),
  );

  it("uses the default checklist", () => {
    expect(data.checklistId).toBe(defaultChecklist.id);
  });

  it("covers every DEV conversation once per model", () => {
    const models = new Set(data.evaluations.map(({ model }) => model));
    expect(models.size).toBeGreaterThan(0);
    expect(data.evaluations).toHaveLength(models.size * records.size);
    for (const model of models) {
      const ids = data.evaluations
        .filter((item) => item.model === model)
        .map((item) => item.conversation_id);
      expect(new Set(ids)).toEqual(new Set(records.keys()));
    }
  });

  it("has ratings that fit the checklist and the transcripts", () => {
    for (const item of data.evaluations) {
      const record = records.get(item.conversation_id)!;
      expect(() => checkRatings(defaultChecklist, item.ratings, record.transcript)).not.toThrow();
    }
  });

  it("rejects an answer outside the scale", () => {
    const item = data.evaluations[0];
    const bad = item.ratings.map((rating) =>
      rating.criterionId === "guidance" ? { ...rating, answer: 12 } : rating,
    );
    expect(() =>
      checkRatings(defaultChecklist, bad, records.get(item.conversation_id)!.transcript),
    ).toThrow();
  });
});

describe("planPrecomputedImport", () => {
  const data = precomputedEvaluationsSchema.parse(precomputed);
  const records = datasetFileSchema.parse(devDataset).records;
  const sources = new Map(records.map((record) => [record.conversation_id, record.transcript]));
  const first = records[0];
  const target = (overrides: Partial<PrecomputedTarget> = {}): PrecomputedTarget => ({
    id: "dev-conversation",
    group: "DEV",
    sourceId: first.conversation_id,
    transcript: first.transcript,
    ...overrides,
  });
  const models = new Set(data.evaluations.map(({ model }) => model)).size;

  it("attaches scores only to the DEV conversation when another group shares the source ID", () => {
    const edited = [{ ...first.transcript[0], text: "A different conversation" }];
    const plan = planPrecomputedImport({
      checklist: defaultChecklist,
      data,
      conversations: [
        target({ id: "control-conversation", group: "CONTROL", transcript: edited }),
        target(),
      ],
      sources,
    });
    expect(plan.rows).toHaveLength(models);
    expect(new Set(plan.rows.map(({ conversationId }) => conversationId))).toEqual(
      new Set(["dev-conversation"]),
    );
    expect(plan.mismatched).toEqual([]);
    expect(plan.skipped).toBe(data.evaluations.length - models);
  });

  it("rejects a DEV conversation whose transcript was modified", () => {
    const edited = first.transcript.map((turn, index) =>
      index === 1 ? { ...turn, text: `${turn.text} (edited)` } : turn,
    );
    const plan = planPrecomputedImport({
      checklist: defaultChecklist,
      data,
      conversations: [target({ transcript: edited })],
      sources,
    });
    expect(plan.rows).toEqual([]);
    expect(plan.mismatched).toHaveLength(models);
    expect(plan.mismatched[0]).toMatchObject({
      conversation_id: first.conversation_id,
      reason: expect.stringContaining("differs"),
    });
  });

  it("rejects a checklist other than the one the scores were produced with", () => {
    const edited = { ...defaultChecklist, id: crypto.randomUUID() };
    expect(() =>
      planPrecomputedImport({ checklist: edited, data, conversations: [target()], sources }),
    ).toThrow(/made with checklist/);
  });

  it("reports a conversation without a bundled transcript instead of attaching scores", () => {
    const plan = planPrecomputedImport({
      checklist: defaultChecklist,
      data,
      conversations: [target()],
      sources: new Map(),
    });
    expect(plan.rows).toEqual([]);
    expect(plan.mismatched[0].reason).toContain("no transcript");
  });

  it("derives the same evaluation ID on every import", async () => {
    const a = await precomputedEvaluationId("ws", "conv", "model");
    const b = await precomputedEvaluationId("ws", "conv", "model");
    expect(a).toBe(b);
    expect(a).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-8[\da-f]{3}-[\da-f]{12}$/);
    expect(await precomputedEvaluationId("ws", "conv", "other")).not.toBe(a);
    expect(await precomputedEvaluationId("ws2", "conv", "model")).not.toBe(a);
  });
});
