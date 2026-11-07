import { expect, test } from "vite-plus/test";
import type { Checklist } from "@app/contracts";
import { defaultChecklist } from "../checklist.ts";
import type { ChatMessage, LlmClient } from "./client.ts";
import { evaluateConversation, EvaluationError } from "./evaluate.ts";
import { buildPrompt } from "./prompt.ts";
import { validateRatings } from "./validate.ts";

const conversation = {
  language: "RU",
  channel: "agent chat",
  transcript: [
    { timestamp: "00:00", speaker: "client" as const, text: "Где посмотреть мой тариф?" },
    { timestamp: "01:15", speaker: "operator" as const, text: "Здравствуйте! Меня зовут Алина." },
    { timestamp: "02:04", speaker: "operator" as const, text: "Пожалуйста. Хорошего вечера!" },
  ],
};

const validRatings = {
  opening: { answer: "yes", explanation: "Greeted and introduced.", evidence: [2] },
  understanding: { answer: "na", explanation: "Enough information.", evidence: [1] },
  verification: { answer: "N/A", explanation: "General question.", evidence: [1] },
  guidance: { answer: "20", explanation: "Correct steps.", evidence: [2] },
  empathy: { answer: "Да", explanation: "Polite.", evidence: [2, 3] },
  management: { answer: "10", explanation: "Clear.", evidence: [2] },
  closing: { answer: "no", explanation: "No offer of further help.", evidence: [3] },
  violations: { answer: "no", explanation: "None found.", evidence: [2, 3] },
};

function fakeLlm(replies: string[]) {
  const calls: ChatMessage[][] = [];
  const llm: LlmClient = {
    model: "fake",
    async complete(messages) {
      calls.push([...messages]);
      const content = replies[Math.min(calls.length - 1, replies.length - 1)];
      return { content, model: "fake", usage: { promptTokens: 100, completionTokens: 50 } };
    },
  };
  return { llm, calls };
}

test("the prompt is built from the checklist it is given", () => {
  const custom: Checklist = {
    ...defaultChecklist,
    criteria: [
      ...defaultChecklist.criteria.slice(1),
      {
        id: "brand_name",
        title: "Mentions the company name",
        section: "Opening and understanding",
        guidance: "Yes if the operator names Freedom Broker.",
        weight: 10,
        kind: "binary",
        scale: [],
        allowNA: false,
      },
    ],
  };
  const [, user] = buildPrompt(conversation, custom);
  const payload = JSON.parse(user.content);
  expect(payload.criteria.map((c: { criterionId: string }) => c.criterionId)).not.toContain(
    "opening",
  );
  expect(payload.criteria.at(-1)).toMatchObject({
    criterionId: "brand_name",
    allowedAnswers: ["yes", "no"],
  });
  expect(payload.transcript[0]).toMatchObject({ turn: 1, speaker: "client" });
});

test("a valid reply is normalized into ratings", async () => {
  const reply = `<think>reasoning</think>\n\`\`\`json\n${JSON.stringify({ ratings: validRatings })}\n\`\`\``;
  const { llm, calls } = fakeLlm([reply]);
  const run = await evaluateConversation(llm, conversation, defaultChecklist);
  expect(calls).toHaveLength(1);
  expect(run.model).toBe("fake");
  expect(run.usage).toEqual({ promptTokens: 100, completionTokens: 50 });
  const byId = Object.fromEntries(run.ratings.map((r) => [r.criterionId, r]));
  expect(byId.verification.answer).toBe("na");
  expect(byId.empathy.answer).toBe("yes");
  expect(byId.guidance.answer).toBe(20);
});

test("an invalid reply is retried with the list of problems", async () => {
  const bad = { ...validRatings, opening: { ...validRatings.opening, answer: "na" } };
  const { llm, calls } = fakeLlm([
    JSON.stringify({ ratings: bad }),
    JSON.stringify({ ratings: validRatings }),
  ]);
  const run = await evaluateConversation(llm, conversation, defaultChecklist);
  expect(calls).toHaveLength(2);
  expect(calls[1].at(-1)?.content).toContain("opening");
  expect(run.attempts).toHaveLength(2);
  expect(run.usage.promptTokens).toBe(200);
});

test("two invalid replies fail the evaluation", async () => {
  const { llm } = fakeLlm(["not json at all"]);
  await expect(evaluateConversation(llm, conversation, defaultChecklist)).rejects.toBeInstanceOf(
    EvaluationError,
  );
});

test("validation reports every problem", () => {
  const { errors, warnings } = validateRatings(
    {
      ratings: {
        ...validRatings,
        opening: { answer: "na", explanation: "x", evidence: [1] },
        guidance: { answer: "12", explanation: "x", evidence: [1] },
        empathy: { answer: "yes", explanation: "x", evidence: [99] },
        management: { answer: "10", explanation: "x", evidence: [1, 2, 3, 1, 2] },
        closing: undefined,
        made_up: { answer: "yes", explanation: "x", evidence: [1] },
      },
    },
    defaultChecklist,
    conversation.transcript.length,
  );
  expect(errors.some((e) => e.startsWith("opening:") && e.includes("N/A is not allowed"))).toBe(
    true,
  );
  expect(errors.some((e) => e.startsWith("guidance:") && e.includes("not an allowed answer"))).toBe(
    true,
  );
  expect(errors.some((e) => e.startsWith("empathy:") && e.includes("no valid evidence"))).toBe(
    true,
  );
  expect(errors.some((e) => e.startsWith("closing:") && e.includes("missing"))).toBe(true);
  expect(errors.some((e) => e.includes('Unknown criterionId "made_up"'))).toBe(true);
  expect(warnings.some((w) => w.startsWith("empathy:"))).toBe(true);
});
