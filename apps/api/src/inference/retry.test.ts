import { expect, test } from "vite-plus/test";
import { defaultChecklist } from "../checklist.ts";
import {
  EmptyReplyError,
  InferenceApiError,
  type CompleteOptions,
  type LlmClient,
  type ModelReply,
} from "./client.ts";
import { evaluateConversation, EvaluationError } from "./evaluate.ts";

const conversation = {
  language: "RU",
  channel: "agent chat",
  transcript: [
    { timestamp: "00:00", speaker: "client" as const, text: "Где посмотреть мой тариф?" },
    { timestamp: "01:15", speaker: "operator" as const, text: "Здравствуйте! Меня зовут Алина." },
    { timestamp: "02:04", speaker: "operator" as const, text: "Пожалуйста. Хорошего вечера!" },
  ],
};

const valid = JSON.stringify({
  ratings: Object.fromEntries(
    defaultChecklist.criteria.map((c) => [
      c.id,
      {
        answer:
          c.kind === "numeric" ? String(Math.max(...c.scale)) : c.kind === "flag" ? "no" : "yes",
        explanation: "Проверено.",
        evidence: [2],
      },
    ]),
  ),
});

const exhausted = () =>
  new EmptyReplyError("length", 8000, { promptTokens: 1000, completionTokens: 8000 });

/** Each step either returns a reply text or throws the given error. */
function scriptedLlm(steps: (string | (() => Error))[]) {
  const calls: CompleteOptions[] = [];
  const llm: LlmClient = {
    model: "fake",
    maxTokens: 8000,
    async complete(_messages, options = {}): Promise<ModelReply> {
      calls.push(options);
      const step = steps[Math.min(calls.length - 1, steps.length - 1)];
      if (typeof step !== "string") throw step();
      return { content: step, model: "fake", usage: { promptTokens: 1000, completionTokens: 500 } };
    },
  };
  return { llm, calls };
}

test("an exhausted reply followed by a valid one recovers, with a larger token budget", async () => {
  const { llm, calls } = scriptedLlm([exhausted, valid]);
  const run = await evaluateConversation(llm, conversation, defaultChecklist, { maxRetries: 1 });
  expect(calls).toHaveLength(2);
  expect(calls[0].maxTokens).toBe(8000);
  expect(calls[1].maxTokens).toBe(12_000);
  expect(run.attempts[0].errors[0]).toContain("token limit");
  expect(run.usage).toEqual({ promptTokens: 2000, completionTokens: 8500 });
});

test("repeated exhaustion stops at the retry limit with a useful message", async () => {
  const { llm, calls } = scriptedLlm([exhausted]);
  const error = await evaluateConversation(llm, conversation, defaultChecklist, {
    maxRetries: 2,
  }).catch((e: unknown) => e);
  expect(calls).toHaveLength(3);
  expect(calls.map((c) => c.maxTokens)).toEqual([8000, 12_000, 18_000]);
  expect(error).toBeInstanceOf(EvaluationError);
  expect((error as EvaluationError).message).toContain("no answer in 3 attempt(s)");
  expect((error as EvaluationError).message).toContain("token limit");
});

test("the token budget never grows past the ceiling", async () => {
  const { llm, calls } = scriptedLlm([exhausted]);
  await evaluateConversation(llm, conversation, defaultChecklist, { maxRetries: 6 }).catch(
    () => {},
  );
  expect(calls.map((c) => c.maxTokens)).toEqual([
    8000, 12_000, 18_000, 27_000, 40_500, 48_000, 48_000,
  ]);
});

test("an authentication failure is not retried", async () => {
  const { llm, calls } = scriptedLlm([() => new InferenceApiError(401, "bad token")]);
  await expect(
    evaluateConversation(llm, conversation, defaultChecklist, { maxRetries: 3 }),
  ).rejects.toBeInstanceOf(InferenceApiError);
  expect(calls).toHaveLength(1);
});

test("cancellation stops the evaluation without further calls", async () => {
  const controller = new AbortController();
  const { llm, calls } = scriptedLlm([
    () => {
      controller.abort();
      return exhausted();
    },
    valid,
  ]);
  await expect(
    evaluateConversation(llm, conversation, defaultChecklist, {
      maxRetries: 3,
      signal: controller.signal,
    }),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(calls).toHaveLength(1);
  expect(calls[0].signal).toBe(controller.signal);
});
