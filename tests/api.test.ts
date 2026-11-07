import { expect, inject, test } from "vite-plus/test";

declare module "vite-plus/test" {
  interface ProvidedContext {
    origin: string;
  }
}

const origin = inject("origin");

test("health endpoint responds", async () => {
  const response = await fetch(`${origin}/api/health`);

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
});

test("returns 404 for unknown API routes", async () => {
  const response = await fetch(`${origin}/api/missing`);

  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({
    error: { code: "NOT_FOUND", message: "Endpoint not found." },
  });

  const navigation = await fetch(`${origin}/api/missing`, {
    headers: { "Sec-Fetch-Mode": "navigate" },
  });

  expect(navigation.status).toBe(404);
});

test("serves the React app for frontend navigation", async () => {
  const response = await fetch(`${origin}/checklists`, {
    headers: { "Sec-Fetch-Mode": "navigate" },
  });

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toMatch(/text\/html/);
});
