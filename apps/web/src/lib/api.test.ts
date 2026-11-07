import { expectTypeOf, test } from "vite-plus/test";
import type { InferRequestType, InferResponseType } from "hono/client";
import { api } from "./api";
import { request } from "./request";

test("RPC source types preserve browser globals", () => {
  function browserTypes() {
    document.body.append(document.createElement("div"));
    // @ts-expect-error HTMLRewriter methods are not browser DOM methods.
    document.body.setInnerContent("hello");
  }

  expectTypeOf(browserTypes).returns.toBeVoid();
  // @ts-expect-error Worker database bindings must not become browser globals.
  expectTypeOf<D1Database>().toBeAny();
  // @ts-expect-error Worker environment bindings belong to the API project.
  expectTypeOf<CloudflareBindings>().toBeAny();
});

test("RPC exposes the CQA endpoints and validated request inputs", () => {
  const runEvaluation = api.cqa.conversations[":id"].evaluations.$post;
  expectTypeOf(api.health.$get).toBeFunction();
  expectTypeOf(api.cqa.workspace.$get).toBeFunction();
  expectTypeOf(api.cqa.checklists.$post).toBeFunction();
  expectTypeOf(api.cqa.appeals[":id"].decision.$put).toBeFunction();
  expectTypeOf<InferRequestType<typeof runEvaluation>["json"]>().toEqualTypeOf<{
    id: string;
    checklistId: string;
  }>();

  // @ts-expect-error Unknown endpoints must not appear on the client.
  void api.missing;
  // @ts-expect-error Validated checklist IDs must be strings.
  const invalid: InferRequestType<typeof runEvaluation>["json"] = { id: "id", checklistId: 123 };
  void invalid;
});

test("RPC infers successful JSON bodies and serialized dates", () => {
  const endpoint = api.cqa.evaluations[":id"];
  type Result = InferResponseType<typeof endpoint.$get, 200>;
  const loadEvaluation = () => request((init) => endpoint.$get({ param: { id: "id" } }, { init }));

  expectTypeOf<Result["evaluation"]["createdAt"]>().toEqualTypeOf<string>();
  expectTypeOf<Awaited<ReturnType<typeof loadEvaluation>>>().toEqualTypeOf<Result>();
  expectTypeOf<InferResponseType<typeof api.health.$get, 200>>().toEqualTypeOf<{ ok: true }>();
});
