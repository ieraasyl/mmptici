import { afterEach, expect, test, vi } from "vite-plus/test";
import { createHfClient, EmptyReplyError, InferenceApiError } from "./client.ts";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(status: number, body: unknown) {
  const fetch = vi.fn(async () =>
    typeof body === "string" ? new Response(body, { status }) : Response.json(body, { status }),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const messages = [{ role: "user" as const, content: "hi" }];

test("an empty reply at the token limit is reported as token exhaustion, with usage", async () => {
  stubFetch(200, {
    choices: [{ finish_reason: "length", message: { content: "" } }],
    usage: { prompt_tokens: 1500, completion_tokens: 8000 },
  });
  const error = await createHfClient({ apiKey: "k" })
    .complete(messages)
    .catch((e: unknown) => e);
  expect(error).toBeInstanceOf(EmptyReplyError);
  expect((error as EmptyReplyError).hitTokenLimit).toBe(true);
  expect((error as EmptyReplyError).usage).toEqual({ promptTokens: 1500, completionTokens: 8000 });
});

test("an authentication failure is an API error, not token exhaustion", async () => {
  stubFetch(401, "Invalid credentials");
  const error = await createHfClient({ apiKey: "bad" })
    .complete(messages)
    .catch((e: unknown) => e);
  expect(error).toBeInstanceOf(InferenceApiError);
  expect((error as InferenceApiError).isAuthError).toBe(true);
});

test("a per-call token budget overrides the default", async () => {
  const fetch = stubFetch(200, { choices: [{ message: { content: "{}" } }] });
  await createHfClient({ apiKey: "k" }).complete(messages, { maxTokens: 12_000 });
  const body = JSON.parse(
    (fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
  );
  expect(body.max_tokens).toBe(12_000);
});
