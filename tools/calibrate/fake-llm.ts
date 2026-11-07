// A fake model client for the batch runner tests. No network calls.

import { defaultChecklist } from "../../apps/api/src/checklist.ts";
import type { LlmClient, ModelReply } from "../../apps/api/src/inference/index.ts";

/** A reply that passes validation for the default checklist. */
export const valid = JSON.stringify({
  ratings: Object.fromEntries(
    defaultChecklist.criteria.map((c) => [
      c.id,
      {
        answer: c.kind === "numeric" ? String(c.scale.at(-1)) : "yes",
        explanation: "ok",
        evidence: [1],
      },
    ]),
  ),
});
export const invalid = '{"ratings": {}}';
export const usage = { promptTokens: 100, completionTokens: 50 };

export type Step = string | Error | ModelReply;

/** A fake model that plays the given replies in order, repeating the last one. */
export function fakeLlm(steps: Step[]) {
  let calls = 0;
  const llm: LlmClient = {
    model: "fake",
    async complete() {
      const step = steps[Math.min(calls++, steps.length - 1)];
      if (step instanceof Error) throw step;
      return typeof step === "string" ? { content: step, model: "fake", usage } : step;
    },
  };
  return { llm, calls: () => calls };
}
