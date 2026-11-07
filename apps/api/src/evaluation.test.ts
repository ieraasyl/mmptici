import { expect, test } from "vite-plus/test";
import type { Answer, Rating } from "@app/contracts";
import { defaultChecklist } from "./checklist.ts";
import { scoreEvaluation } from "./evaluation.ts";

test("normalizes numeric answers, excludes N/A, and scores serious violations separately", () => {
  const answers: Answer[] = ["yes", "na", "na", 15, "yes", 7, "na", "yes"];
  const ratings: Rating[] = defaultChecklist.criteria.map(({ id }, index) => ({
    criterionId: id,
    answer: answers[index],
    explanation: "Test explanation",
    evidence: [1],
  }));
  const original = scoreEvaluation(defaultChecklist, ratings, []);
  expect(original.total).toBe(84.17);
  expect(original.seriousViolation).toBe(true);
  expect(original.sections).toEqual([
    { name: "Opening and understanding", earned: 10, weight: 10, score: 100 },
    { name: "Security and resolution", earned: 15, weight: 20, score: 75 },
    { name: "Managing and closing", earned: 25.5, weight: 30, score: 85 },
  ]);

  const final = scoreEvaluation(defaultChecklist, ratings, [
    { criterionId: "guidance", decision: { answer: "na", reason: "No request was made." } },
    { criterionId: "violations", decision: { answer: "no", reason: "No violation occurred." } },
  ]);
  expect(final.total).toBe(88.75);
  expect(final.seriousViolation).toBe(false);
  expect(final.sections[1]).toMatchObject({ earned: 0, weight: 0, score: null });
});
