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

function stubSequence(...replies: { status: number; body?: unknown; headers?: HeadersInit }[]) {
  const fetch = vi.fn(async () => {
    const { status, body = "", headers } = replies.shift()!;
    return typeof body === "string"
      ? new Response(body, { status, headers })
      : Response.json(body, { status, headers });
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const ok = { status: 200, body: { choices: [{ message: { content: "{}" } }] } };

test("a rate limit or server error is retried, then the reply is returned", async () => {
  const fetch = stubSequence(
    { status: 429, body: "Tokens per minute limit exceeded" },
    { status: 503 },
    ok,
  );
  const reply = await createHfClient({ apiKey: "k", retryDelaysMs: [0, 0] }).complete(messages);
  expect(reply.content).toBe("{}");
  expect(fetch).toHaveBeenCalledTimes(3);
});

test("retries stop after the last delay and the API error is thrown", async () => {
  const fetch = stubSequence({ status: 429 }, { status: 429 }, { status: 429 });
  const error = await createHfClient({ apiKey: "k", retryDelaysMs: [0, 0] })
    .complete(messages)
    .catch((e: unknown) => e);
  expect(error).toBeInstanceOf(InferenceApiError);
  expect((error as InferenceApiError).status).toBe(429);
  expect(fetch).toHaveBeenCalledTimes(3);
});

test("client errors such as a bad token are not retried", async () => {
  const fetch = stubSequence({ status: 401, body: "Invalid credentials" }, ok);
  const error = await createHfClient({ apiKey: "bad", retryDelaysMs: [0, 0] })
    .complete(messages)
    .catch((e: unknown) => e);
  expect((error as InferenceApiError).isAuthError).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("an empty retry list sends the request once", async () => {
  const fetch = stubSequence({ status: 500 }, ok);
  const error = await createHfClient({ apiKey: "k", retryDelaysMs: [] })
    .complete(messages)
    .catch((e: unknown) => e);
  expect((error as InferenceApiError).status).toBe(500);
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("Retry-After is honoured and cancelling stops the wait", async () => {
  vi.useFakeTimers();
  try {
    stubSequence({ status: 429, headers: { "retry-after": "3" } }, ok);
    const pending = createHfClient({ apiKey: "k", retryDelaysMs: [0] }).complete(messages);
    await vi.advanceTimersByTimeAsync(2_999);
    let settled = false;
    void pending.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect((await pending).content).toBe("{}");

    stubSequence({ status: 429 }, ok);
    const controller = new AbortController();
    const cancelled = createHfClient({ apiKey: "k", retryDelaysMs: [60_000] })
      .complete(messages, { signal: controller.signal })
      .catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(0);
    controller.abort(new Error("cancelled"));
    expect(((await cancelled) as Error).message).toBe("cancelled");
  } finally {
    vi.useRealTimers();
  }
});
