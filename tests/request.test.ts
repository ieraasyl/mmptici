import { afterEach, expect, test, vi } from "vite-plus/test";
import { api } from "../apps/web/src/lib/api.ts";
import { ApiRequestError, request } from "../apps/web/src/lib/request.ts";

afterEach(() => vi.unstubAllGlobals());

function loadConversations(options?: RequestInit) {
  return request((init) => api.cqa.conversations.$get({}, { init }), options);
}

test("parses successful RPC responses and forwards request options", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ conversations: [] }));
  vi.stubGlobal("fetch", fetch);
  const options = { signal: new AbortController().signal };

  expect(await loadConversations(options)).toEqual({ conversations: [] });
  expect(fetch).toHaveBeenCalledWith(
    "/api/cqa/conversations",
    expect.objectContaining({ ...options, method: "GET" }),
  );
});

test("preserves validation details and HTTP status", async () => {
  const error = {
    code: "VALIDATION_ERROR",
    message: "Check the submitted fields.",
    issues: [{ path: ["group"], message: "Too long" }],
  };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error }, { status: 400 })));

  await expect(loadConversations()).rejects.toMatchObject({
    ...error,
    status: 400,
  });
});

test.each([
  { status: 401, code: "UNAUTHORIZED", message: "Reload the page to open your workspace." },
  { status: 500, code: "HTTP_ERROR", message: "Something went wrong. Please try again." },
])("distinguishes a $status response even without JSON", async ({ status, code, message }) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("failure", { status })));

  await expect(loadConversations()).rejects.toMatchObject({
    status,
    code,
    message,
  });
});

test.each([
  { status: 401, code: "HTTP_ERROR", message: "Reload the page to open your workspace." },
  { status: 500, code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
])(
  "preserves the structured $status error from the global handler",
  async ({ status, ...error }) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error }, { status })));

    await expect(loadConversations()).rejects.toMatchObject({ ...error, status });
  },
);

test("rejects successful responses containing invalid JSON", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not JSON", { status: 201 })));

  await expect(loadConversations()).rejects.toMatchObject({
    status: 201,
    code: "INVALID_RESPONSE",
  });
});

test("trusts successful JSON without validating its shape", async () => {
  const body = { conversations: "not schema-validated" };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(body)));

  expect(await loadConversations()).toEqual(body);
});

test("distinguishes connection failures from server failures", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

  await expect(loadConversations()).rejects.toBeInstanceOf(ApiRequestError);
  await expect(loadConversations()).rejects.toMatchObject({
    status: 0,
    code: "NETWORK_ERROR",
  });
});

test("preserves cancellation", async () => {
  const controller = new AbortController();
  const cause = new DOMException("Aborted", "AbortError");
  controller.abort();
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(cause));

  await expect(loadConversations({ signal: controller.signal })).rejects.toBe(cause);
});

test("preserves cancellation while reading the response body", async () => {
  const controller = new AbortController();
  const cause = new Error("Reading cancelled");
  const response = Response.json({ conversations: [] });
  vi.spyOn(response, "json").mockImplementation(async () => {
    controller.abort(cause);
    throw cause;
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

  await expect(loadConversations({ signal: controller.signal })).rejects.toBe(cause);
});
