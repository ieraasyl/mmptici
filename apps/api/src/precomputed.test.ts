import { datasetFileSchema, precomputedEvaluationsSchema } from "@app/contracts";
import { describe, expect, it } from "vite-plus/test";
import devDataset from "../../../data/invoke.json";
import precomputed from "../../../data/evaluations-dev.json";
import { defaultChecklist } from "./checklist.ts";
import { checkRatings } from "./precomputed.ts";

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
