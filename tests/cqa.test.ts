import { inject, test, expect } from "vite-plus/test";
import { hc } from "hono/client";
import type { AppType } from "@app/api/types";

const origin = inject("origin");
const cqa = hc<AppType>(origin).api.cqa;
const example = {
  group: "CONTROL",
  records: [
    {
      conversation_id: "example-kz",
      channel: "voice call" as const,
      language: "KZ" as const,
      transcript: [
        {
          timestamp: "2026-10-15T15:20:00+05:00",
          speaker: "client" as const,
          text: "Комиссия қанша?",
        },
        {
          timestamp: "2026-10-15T15:20:05+05:00",
          speaker: "operator" as const,
          text: "Сәлеметсіз бе! Менің атым Айша.",
        },
      ],
      audio_url: "https://example.invalid/recording",
    },
  ],
};

async function openWorkspace() {
  const response = await cqa.workspace.$get();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  return { Cookie: response.headers.get("set-cookie")!.split(";")[0] };
}

async function importExample(headers: { Cookie: string }) {
  const response = await cqa.conversations.$post({ json: example }, { headers });
  expect(response.status, await response.clone().text()).toBe(201);
  const list = await cqa.conversations.$get({}, { headers });
  expect(list.status).toBe(200);
  const { conversations } = await list.json();
  expect(conversations).toHaveLength(1);
  return conversations[0].id;
}

test("imports conversations once and isolates browser workspaces", async () => {
  expect((await cqa.conversations.$get()).status).toBe(401);
  expect((await cqa.dashboard.$get()).status).toBe(401);
  const headers = await openWorkspace();
  const other = await openWorkspace();
  const id = await importExample(headers);

  const dashboard = await cqa.dashboard.$get({}, { headers });
  expect(dashboard.headers.get("cache-control")).toContain("no-store");
  expect(await dashboard.json()).toMatchObject({
    conversations: [{ id, evaluation: null, pendingAppeals: 0 }],
  });
  expect(await (await cqa.dashboard.$get({}, { headers: other })).json()).toEqual({
    conversations: [],
    checklistResults: [],
  });

  const duplicate = await cqa.conversations.$post({ json: example }, { headers });
  expect(await duplicate.json()).toEqual({ imported: 0, skipped: 1 });

  const detail = await cqa.conversations[":id"].$get({ param: { id } }, { headers });
  expect(detail.status).toBe(200);
  expect(await detail.json()).toMatchObject({
    conversation: {
      transcript: example.records[0].transcript,
      audioUrl: example.records[0].audio_url,
    },
  });
  expect((await cqa.conversations[":id"].$get({ param: { id } }, { headers: other })).status).toBe(
    404,
  );
  const recording = cqa.conversations[":id"].recording;
  expect((await recording.$get({ param: { id } })).status).toBe(401);
  expect((await recording.$get({ param: { id } }, { headers: other })).status).toBe(404);
  const playback = await recording.$get(
    { param: { id } },
    { headers, init: { redirect: "manual" } },
  );
  expect(playback.status).toBe(302);
  expect(playback.headers.get("location")).toBe(example.records[0].audio_url);
  expect(playback.headers.get("cache-control")).toContain("no-store");
  expect(await (await cqa.conversations.$get({}, { headers: other })).json()).toEqual({
    conversations: [],
  });
  expect(
    (
      await cqa.conversations.$post(
        { json: example },
        {
          headers: { ...headers, Origin: "https://example.invalid" },
        },
      )
    ).status,
  ).toBe(403);
});

test("attaches bundled evaluations once, only to matching DEV transcripts", async () => {
  const headers = await openWorkspace();
  const other = await openWorkspace();
  const loadScores = cqa.evaluations["import-dev"].$post;
  expect((await loadScores()).status).toBe(401);

  // A conversation with a DEV source ID but another transcript, in DEV and in another group.
  const shared = {
    ...example.records[0],
    conversation_id: "p1-ru-001",
    channel: "agent chat" as const,
    language: "RU" as const,
    audio_url: null,
  };
  for (const group of ["CONTROL", "DEV"]) {
    const imported = await cqa.conversations.$post(
      { json: { group, records: [shared] } },
      { headers },
    );
    expect(imported.status, await imported.clone().text()).toBe(201);
  }
  expect((await cqa.conversations["import-dev"].$post({}, { headers })).status).toBe(201);
  expect((await cqa.conversations["import-dev"].$post({}, { headers: other })).status).toBe(201);

  // Two imports at once insert each bundled evaluation only once.
  const [one, two] = await Promise.all([loadScores({}, { headers }), loadScores({}, { headers })]);
  expect([one.status, two.status]).toEqual([201, 201]);
  const results = [await one.json(), await two.json()];
  const total = results.reduce((sum, { imported }) => sum + imported, 0);
  const models = 1; // data/evaluations-dev.json holds one model (Qwen) since main regenerated it
  expect(total).toBe(64 * models);
  for (const result of results) {
    expect(result.mismatched).toHaveLength(models);
    expect(result.mismatched[0]).toMatchObject({ conversation_id: "p1-ru-001" });
  }
  // A repeated import adds nothing.
  const again = await (await loadScores({}, { headers })).json();
  expect(again).toMatchObject({ imported: 0, skipped: 64 * models });

  const { conversations } = await (await cqa.conversations.$get({}, { headers })).json();
  expect(conversations).toHaveLength(66);
  const modified = conversations.filter(({ sourceId }) => sourceId === "p1-ru-001");
  expect(modified).toHaveLength(2);
  expect(modified.every(({ evaluated }) => !evaluated)).toBe(true);
  expect(conversations.filter(({ evaluated }) => evaluated)).toHaveLength(64);
  const dashboard = await (await cqa.dashboard.$get({}, { headers })).json();
  const latest = dashboard.conversations.find(({ sourceId }) => sourceId === "p1-ru-002");
  expect(latest?.evaluation).toMatchObject({
    model: "Qwen/Qwen3.8-27B:cerebras",
    origin: "imported",
  });

  // The other workspace holds the same DEV conversations and received nothing.
  const elsewhere = await (await cqa.conversations.$get({}, { headers: other })).json();
  expect(elsewhere.conversations).toHaveLength(65);
  expect(elsewhere.conversations.some(({ evaluated }) => evaluated)).toBe(false);
});

test("loads the bundled DEV dataset once per workspace", async () => {
  const load = cqa.conversations["import-dev"].$post;
  expect((await load()).status).toBe(401);
  const headers = await openWorkspace();
  const other = await openWorkspace();

  const imported = await load({}, { headers });
  expect(imported.status).toBe(201);
  expect(await imported.json()).toEqual({ imported: 65, skipped: 0 });
  expect(await (await load({}, { headers })).json()).toEqual({ imported: 0, skipped: 65 });

  const { conversations } = await (await cqa.conversations.$get({}, { headers })).json();
  expect(conversations).toHaveLength(65);
  expect(conversations.every(({ group }) => group === "DEV")).toBe(true);
  expect(await (await cqa.conversations.$get({}, { headers: other })).json()).toEqual({
    conversations: [],
  });
});

test("dashboard handles empty workspaces and evaluations with only violation flags", async () => {
  const headers = await openWorkspace();
  expect(await (await cqa.dashboard.$get({}, { headers })).json()).toEqual({
    conversations: [],
    checklistResults: [],
  });
  const conversationId = await importExample(headers);
  const { checklists } = await (await cqa.checklists.$get({}, { headers })).json();
  const created = await cqa.checklists.$post(
    {
      json: {
        name: "Violation review",
        criteria: [{ ...checklists[0].criteria.at(-1)!, id: "risk" }],
      },
    },
    { headers },
  );
  if (created.status !== 201) throw new Error(await created.text());
  const { checklist } = await created.json();
  const evaluationId = crypto.randomUUID();
  const result = await cqa.conversations[":id"].evaluations.$post(
    {
      param: { id: conversationId },
      json: { id: evaluationId, checklistId: checklist.id },
    },
    { headers: { ...headers, "X-CQA-Test-Model": "valid" } },
  );
  expect(result.status).toBe(201);
  const dashboard = await (await cqa.dashboard.$get({}, { headers })).json();
  expect(dashboard).toMatchObject({
    conversations: [
      {
        id: conversationId,
        pendingAppeals: 0,
        evaluation: { id: evaluationId, total: null, seriousViolation: true },
      },
    ],
  });
  expect(dashboard.conversations[0]).not.toHaveProperty("transcript");
});

test("dashboard keeps the latest result per checklist revision after deletion and appeal decisions", async () => {
  const headers = await openWorkspace();
  const other = await openWorkspace();
  const conversationId = await importExample(headers);
  const { checklists, defaultId } = await (await cqa.checklists.$get({}, { headers })).json();
  const draft = { name: "Historical checklist", criteria: checklists[0].criteria };
  const created = await cqa.checklists.$post({ json: draft }, { headers });
  if (created.status !== 201) throw new Error(await created.text());
  const { checklist } = await created.json();

  async function run(checklistId: string) {
    const id = crypto.randomUUID();
    const response = await cqa.conversations[":id"].evaluations.$post(
      { param: { id: conversationId }, json: { id, checklistId } },
      { headers: { ...headers, "X-CQA-Test-Model": "valid" } },
    );
    expect(response.status).toBe(201);
    // Give consecutive runs distinct timestamps, regardless of UUID ordering.
    await new Promise((resolve) => setTimeout(resolve, 2));
    return id;
  }

  const first = await run(checklist.id);
  const updated = await cqa.checklists[":id"].$put(
    {
      param: { id: checklist.id },
      json: {
        ...draft,
        revision: 1,
        criteria: draft.criteria.map((criterion, index) =>
          index === 0 ? { ...criterion, weight: 1 } : criterion,
        ),
      },
    },
    { headers },
  );
  expect(updated.status).toBe(200);
  const second = await run(checklist.id);
  const third = await run(checklist.id);
  const latest = await run(defaultId);
  expect(
    (await cqa.checklists[":id"].$delete({ param: { id: checklist.id } }, { headers })).status,
  ).toBe(200);

  const appeal = await cqa.evaluations[":id"].appeals.$post(
    { param: { id: first }, json: { criterionId: "opening", comment: "Review the greeting." } },
    { headers },
  );
  if (appeal.status !== 201) throw new Error(await appeal.text());
  const appealId = (await appeal.json()).appeal.id;
  const before = await (await cqa.dashboard.$get({}, { headers })).json();
  expect(before.conversations).toMatchObject([{ pendingAppeals: 1, evaluation: { id: latest } }]);
  expect(
    before.checklistResults.find(({ evaluation }) => evaluation.id === first)?.pendingAppeals,
  ).toBe(1);
  expect(
    before.checklistResults
      .filter(({ evaluation }) => evaluation.id !== first)
      .every((row) => row.pendingAppeals === 0),
  ).toBe(true);

  expect(
    (
      await cqa.appeals[":id"].decision.$put(
        { param: { id: appealId }, json: { answer: "yes", reason: "The greeting is confirmed." } },
        { headers },
      )
    ).status,
  ).toBe(200);
  const after = await (await cqa.dashboard.$get({}, { headers })).json();
  expect(after.conversations).toMatchObject([
    { pendingAppeals: 0, evaluation: { id: latest, total: 75 } },
  ]);
  expect(after.checklistResults.map(({ evaluation }) => evaluation.id)).toEqual([
    latest,
    third,
    first,
  ]);
  const historical = after.checklistResults.find(({ evaluation }) => evaluation.id === first)!;
  expect(historical.evaluation).toMatchObject({
    checklistId: checklist.id,
    revision: 1,
    total: 100,
  });
  expect(historical.evaluation.criteria[0]).toMatchObject({ weight: 10, answer: "yes" });
  expect(historical.evaluation.failures.some(({ criterionId }) => criterionId === "opening")).toBe(
    false,
  );
  const revised = after.checklistResults.find(({ evaluation }) => evaluation.id === third)!;
  expect(revised.evaluation).toMatchObject({ checklistId: checklist.id, revision: 2 });
  expect(revised.evaluation.criteria[0]).toMatchObject({ weight: 1, answer: "no" });
  expect(after.checklistResults.every((row) => !Object.hasOwn(row, "transcript"))).toBe(true);
  const detail = await (
    await cqa.conversations[":id"].$get({ param: { id: conversationId } }, { headers })
  ).json();
  expect(detail.evaluations.map(({ id }) => id)).toEqual([latest, third, second, first]);
  expect(await (await cqa.dashboard.$get({}, { headers: other })).json()).toEqual({
    conversations: [],
    checklistResults: [],
  });
});

test("returns JSON errors for malformed and invalid imports", async () => {
  const headers = await openWorkspace();
  const malformed = await fetch(`${origin}/api/cqa/conversations`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: "{",
  });
  expect(malformed.status).toBe(400);
  expect(await malformed.json()).toMatchObject({ error: { code: "BAD_REQUEST" } });

  const invalid = await cqa.conversations.$post(
    { json: { group: "CONTROL", records: [] } },
    { headers },
  );
  expect(invalid.status).toBe(400);
  expect(await invalid.json()).toMatchObject({
    error: { code: "VALIDATION_ERROR", issues: [{ path: ["records"] }] },
  });
});

test("keeps checklist snapshots and appeals after deleting a custom checklist", async () => {
  const headers = await openWorkspace();
  const other = await openWorkspace();
  const conversationId = await importExample(headers);
  const { checklists, defaultId } = await (await cqa.checklists.$get({}, { headers })).json();
  const draft = { name: "Custom review", criteria: checklists[0].criteria };
  const created = await cqa.checklists.$post({ json: draft }, { headers });
  if (created.status !== 201) throw new Error(await created.text());
  const { checklist } = await created.json();

  const evaluationId = crypto.randomUUID();
  const run = {
    param: { id: conversationId },
    json: { id: evaluationId, checklistId: checklist.id },
  };
  const endpoint = cqa.conversations[":id"].evaluations;
  expect((await endpoint.$post(run, { headers })).status).toBe(503);
  expect(
    (await endpoint.$post(run, { headers: { ...headers, "X-CQA-Test-Model": "invalid" } })).status,
  ).toBe(502);
  const modelHeaders = { ...headers, "X-CQA-Test-Model": "valid" };
  expect((await endpoint.$post(run, { headers: modelHeaders })).status).toBe(201);
  expect((await endpoint.$post(run, { headers })).status).toBe(200);

  const update = {
    param: { id: checklist.id },
    json: {
      ...draft,
      revision: 1,
      criteria: [{ ...draft.criteria[0], title: "Revised opening" }, ...draft.criteria.slice(1)],
    },
  };
  expect((await cqa.checklists[":id"].$put(update, { headers })).status).toBe(200);
  expect((await cqa.checklists[":id"].$put(update, { headers })).status).toBe(409);
  const newId = crypto.randomUUID();
  expect(
    (await endpoint.$post({ ...run, json: { ...run.json, id: newId } }, { headers: modelHeaders }))
      .status,
  ).toBe(201);

  const evaluationEndpoint = cqa.evaluations[":id"];
  const evaluationRequest = { param: { id: evaluationId } };
  const before = await evaluationEndpoint.$get(evaluationRequest, { headers });
  expect(before.status).toBe(200);
  const history = await (
    await cqa.conversations[":id"].$get({ param: { id: conversationId } }, { headers })
  ).json();
  expect(history.evaluations.map(({ origin }) => origin)).toEqual(["live", "live"]);
  expect(await before.json()).toMatchObject({
    evaluation: {
      total: 75,
      origin: "live",
      checklist: { revision: 1 },
      criteria: [
        {
          criterion: { title: "Opening the conversation" },
          original: { answer: "no", evidence: [2] },
        },
        ...draft.criteria.slice(1).map((item) => ({ criterion: { id: item.id } })),
      ],
    },
  });
  const revised = await evaluationEndpoint.$get({ param: { id: newId } }, { headers });
  expect((await revised.json()).evaluation.checklist).toMatchObject({
    revision: 2,
    criteria: [{ ...draft.criteria[0], title: "Revised opening" }, ...draft.criteria.slice(1)],
  });
  expect((await evaluationEndpoint.$get(evaluationRequest, { headers: other })).status).toBe(404);

  const remove = cqa.checklists[":id"].$delete;
  const target = { param: { id: checklist.id } };
  expect((await remove(target)).status).toBe(401);
  expect((await remove({ param: { id: defaultId } }, { headers })).status).toBe(404);
  expect((await remove(target, { headers: other })).status).toBe(200);
  const afterOtherDelete = await (await cqa.checklists.$get({}, { headers })).json();
  expect(afterOtherDelete.checklists.map(({ id }) => id)).toEqual([defaultId, checklist.id]);

  expect((await remove(target, { headers })).status).toBe(200);
  expect((await remove(target, { headers })).status).toBe(200);
  const afterDelete = await (await cqa.checklists.$get({}, { headers })).json();
  expect(afterDelete.checklists.map(({ id }) => id)).toEqual([defaultId]);
  expect((await endpoint.$post(run, { headers })).status).toBe(200);
  expect(
    (await endpoint.$post({ ...run, json: { ...run.json, id: crypto.randomUUID() } }, { headers }))
      .status,
  ).toBe(404);

  const appeal = {
    ...evaluationRequest,
    json: { criterionId: "opening", comment: "The operator introduced herself." },
  };
  const submitted = await evaluationEndpoint.appeals.$post(appeal, { headers });
  expect(submitted.status).toBe(201);
  expect((await evaluationEndpoint.appeals.$post(appeal, { headers })).status).toBe(409);
  const { appeals } = await (await cqa.appeals.$get({}, { headers })).json();
  expect(await (await cqa.dashboard.$get({}, { headers })).json()).toMatchObject({
    conversations: [
      { id: conversationId, pendingAppeals: 1, evaluation: { id: newId, total: 75 } },
    ],
  });
  expect(appeals[0]).toMatchObject({
    comment: appeal.json.comment,
    original: { answer: "no" },
    decision: null,
    score: { original: 75, final: 75 },
    evidence: [{ number: 2, ...example.records[0].transcript[1] }],
  });

  const decision = cqa.appeals[":id"].decision;
  const review = {
    param: { id: appeals[0].id },
    json: { answer: "yes" as const, reason: "The greeting and name are in turn 2." },
  };
  expect((await decision.$put(review, { headers: other })).status).toBe(404);
  expect(
    (await decision.$put({ ...review, json: { ...review.json, answer: 10 } }, { headers })).status,
  ).toBe(400);
  const submissions = await Promise.all([
    decision.$put(review, { headers }),
    decision.$put(review, { headers }),
  ]);
  expect(submissions.map(({ status }) => status).sort((a, b) => a - b)).toEqual([200, 409]);

  const after = await evaluationEndpoint.$get(evaluationRequest, { headers });
  expect(after.status).toBe(200);
  const { evaluation } = await after.json();
  expect(evaluation).toMatchObject({
    originalTotal: 75,
    total: 100,
    appeals: [{ decision: review.json }],
  });
  expect(evaluation.criteria[0]).toMatchObject({
    original: { answer: "no" },
    originalPoints: 0,
    finalAnswer: "yes",
    finalPoints: 10,
  });
  const decided = await (await cqa.appeals.$get({}, { headers })).json();
  expect(decided.appeals[0]).toMatchObject({ score: { original: 75, final: 100 } });

  // A decision on an older evaluation clears its appeal without changing the latest score.
  expect(await (await cqa.dashboard.$get({}, { headers })).json()).toMatchObject({
    conversations: [{ pendingAppeals: 0, evaluation: { id: newId, total: 75 } }],
  });
  const latestAppeal = await evaluationEndpoint.appeals.$post(
    { ...appeal, param: { id: newId } },
    { headers },
  );
  if (latestAppeal.status !== 201) throw new Error(await latestAppeal.text());
  const latestAppealId = (await latestAppeal.json()).appeal.id;
  expect(
    (await decision.$put({ ...review, param: { id: latestAppealId } }, { headers })).status,
  ).toBe(200);
  expect(await (await cqa.dashboard.$get({}, { headers })).json()).toMatchObject({
    conversations: [{ pendingAppeals: 0, evaluation: { id: newId, total: 100, revision: 2 } }],
  });
});

test("dashboard failures follow reviewer decisions and keep the model's explanation", async () => {
  const headers = await openWorkspace();
  const conversationId = await importExample(headers);
  const { defaultId } = await (await cqa.checklists.$get({}, { headers })).json();
  const evaluationId = crypto.randomUUID();
  const run = await cqa.conversations[":id"].evaluations.$post(
    { param: { id: conversationId }, json: { id: evaluationId, checklistId: defaultId } },
    { headers: { ...headers, "X-CQA-Test-Model": "valid" } },
  );
  expect(run.status).toBe(201);
  const failures = async () => {
    const { conversations } = await (await cqa.dashboard.$get({}, { headers })).json();
    return conversations[0].evaluation!;
  };
  // The test model answers No for opening, 10 for management, Yes for empathy, No for violations.
  const before = await failures();
  expect(before.total).toBe(75);
  expect(before.failures.map(({ criterionId }) => criterionId)).toEqual(["opening"]);
  expect(before.failures[0]).toMatchObject({ reviewed: false, model: { answer: "no" } });
  expect(before.failures[0].explanation).toBe(before.failures[0].model.explanation);

  const appeal = async (criterionId: string) => {
    const response = await cqa.evaluations[":id"].appeals.$post(
      {
        param: { id: evaluationId },
        json: { criterionId, comment: `Please review ${criterionId}.` },
      },
      { headers },
    );
    expect(response.status, await response.clone().text()).toBe(201);
    const body = await response.json();
    if (!("appeal" in body)) throw new Error(body.error.message);
    return body.appeal.id;
  };
  const decide = async (id: string, answer: "yes" | "no" | "na" | number, reason: string) => {
    const response = await cqa.appeals[":id"].decision.$put(
      { param: { id }, json: { answer, reason } },
      { headers },
    );
    expect(response.status, await response.clone().text()).toBe(200);
  };

  // A pending appeal changes nothing yet.
  const closingAppeal = await appeal("closing");
  const pending = await failures();
  expect(pending.total).toBe(75);
  expect(pending.failures.map(({ criterionId }) => criterionId)).toEqual(["opening"]);

  await decide(await appeal("empathy"), "no", "The customer's complaint was ignored.");
  await decide(await appeal("opening"), "yes", "The greeting and name are in turn 2.");
  await decide(await appeal("management"), 4, "The customer had to ask twice.");
  await decide(await appeal("violations"), "yes", "The operator shared another client's balance.");
  await decide(closingAppeal, "na", "The chat was cut off.");

  const after = await failures();
  // opening 10 + empathy 0 + management 6 of 40 applicable points.
  expect(after.total).toBe(40);
  expect(after.seriousViolation).toBe(true);
  const byId = new Map(after.failures.map((failure) => [failure.criterionId, failure]));
  expect([...byId.keys()].sort()).toEqual(["empathy", "management", "violations"]);
  expect(byId.get("empathy")).toMatchObject({
    answer: "no",
    lost: 15,
    reviewed: true,
    explanation: "The customer's complaint was ignored.",
    model: { answer: "yes" },
    evidence: [{ number: 2 }],
  });
  expect(byId.get("empathy")!.model.explanation).toContain("Checked");
  expect(byId.get("management")).toMatchObject({ answer: 4, lost: 9, reviewed: true });
  expect(byId.get("violations")).toMatchObject({
    kind: "flag",
    answer: "yes",
    lost: null,
    reviewed: true,
    explanation: "The operator shared another client's balance.",
  });
  // The same state is served again after a reload.
  expect(await failures()).toEqual(after);
});

test("exports selected conversations as results.json in the organizers' format", async () => {
  const headers = await openWorkspace();
  const other = await openWorkspace();
  const conversationId = await importExample(headers);
  const { checklists, defaultId } = await (await cqa.checklists.$get({}, { headers })).json();
  const exportRun = (json: Parameters<typeof cqa.results.export.$post>[0]["json"], h = headers) =>
    cqa.results.export.$post({ json }, { headers: h });

  // Not evaluated yet: an error entry, never a zero score.
  const before = await exportRun({ ids: [conversationId], checklistId: defaultId });
  expect(before.status).toBe(200);
  expect(await before.json()).toMatchObject({
    file: { results: [{ conversation_id: "example-kz", status: "error", score: null }] },
    summary: { ok: 0, errors: 1 },
  });

  const evaluated = await cqa.conversations[":id"].evaluations.$post(
    { param: { id: conversationId }, json: { id: crypto.randomUUID(), checklistId: defaultId } },
    { headers: { ...headers, "X-CQA-Test-Model": "valid" } },
  );
  expect(evaluated.status).toBe(201);

  const response = await exportRun({ ids: [conversationId], checklistId: defaultId });
  if (response.status !== 200) throw new Error(await response.text());
  const { file, summary } = await response.json();
  expect(summary).toEqual({ ok: 1, errors: 0, models: { "test-model": 1 } });
  expect(file).toMatchObject({
    schema_version: "1.0",
    team_name: "ММ.. Птицы",
    model: { mode: "local", name: "test-model" },
  });
  const [entry] = file.results;
  expect(entry).toMatchObject({ conversation_id: "example-kz", status: "ok" });
  if (entry.status !== "ok") throw new Error("expected ok");
  expect(entry.criteria.map(({ criterion_id }) => criterion_id)).toEqual([
    "contact",
    "discovery",
    "identification",
    "consultation",
    "empathy",
    "dialogue",
    "closure",
    "critical",
  ]);
  // The test model answers opening "no", violations "no", N/A where allowed, else the top answer.
  expect(entry.criteria.map(({ value }) => value)).toEqual([
    false,
    null,
    null,
    null,
    true,
    10,
    null,
    false,
  ]);
  expect(entry.score).toEqual({ final_score: 75, critical_flag: false });

  // A checklist that is not the default eight criteria cannot be exported.
  const custom = await cqa.checklists.$post(
    { json: { name: "Custom", criteria: checklists[0].criteria.slice(1) } },
    { headers },
  );
  if (custom.status !== 201) throw new Error(await custom.text());
  const { checklist } = await custom.json();
  const customExport = await exportRun({ ids: [conversationId], checklistId: checklist.id });
  expect(customExport.status).toBe(422);
  expect(await customExport.json()).toMatchObject({ error: { code: "CHECKLIST_NOT_EXPORTABLE" } });

  // A saved copy of the default criteria exports, but only evaluations of its current revision.
  const copy = await cqa.checklists.$post(
    { json: { name: "Copy", criteria: checklists[0].criteria } },
    { headers },
  );
  if (copy.status !== 201) throw new Error(await copy.text());
  const saved = (await copy.json()).checklist;
  const evaluate = (checklistId: string) =>
    cqa.conversations[":id"].evaluations.$post(
      { param: { id: conversationId }, json: { id: crypto.randomUUID(), checklistId } },
      { headers: { ...headers, "X-CQA-Test-Model": "valid" } },
    );
  expect((await evaluate(saved.id)).status).toBe(201);
  const revised = await cqa.checklists[":id"].$put(
    {
      param: { id: saved.id },
      json: { name: "Copy", revision: saved.revision, criteria: saved.criteria },
    },
    { headers },
  );
  expect(revised.status).toBe(200);
  const stale = await exportRun({ ids: [conversationId], checklistId: saved.id });
  expect(stale.status).toBe(200);
  expect(await stale.json()).toMatchObject({ file: { results: [{ status: "error" }] } });
  expect((await evaluate(saved.id)).status).toBe(201);
  const fresh = await exportRun({ ids: [conversationId], checklistId: saved.id });
  expect(fresh.status).toBe(200);
  expect(await fresh.json()).toMatchObject({ file: { results: [{ status: "ok" }] } });
  // Another workspace cannot export these conversations.
  expect((await exportRun({ ids: [conversationId], checklistId: defaultId }, other)).status).toBe(
    404,
  );
});
