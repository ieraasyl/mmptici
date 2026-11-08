import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { bodyLimit } from "hono/body-limit";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import {
  answerOptions,
  checklistSchema,
  createAppealSchema,
  datasetFileSchema,
  datasetSchema,
  decideAppealSchema,
  exportResultsSchema,
  precomputedEvaluationsSchema,
  runEvaluationSchema,
  saveChecklistSchema,
  type Dataset,
} from "@app/contracts";
import { and, asc, createDb, desc, eq, exists, isNull } from "@app/db";
import { cqaAppeals, cqaChecklists, cqaConversations, cqaEvaluations } from "@app/db/schema";
import devDataset from "../../../../data/invoke.json";
import devEvaluations from "../../../../data/evaluations-dev.json";
import { defaultChecklist } from "../checklist.ts";
import type { Bindings } from "../env.ts";
import { validationError } from "../errors.ts";
import { scoreEvaluation } from "../evaluation.ts";
import {
  createHfClient,
  evaluateConversation,
  EvaluationError,
  InferenceApiError,
} from "../inference/index.ts";
import { resolveRecordingUrl } from "../recording.ts";
import { readDashboard } from "../dashboard.ts";
import { importPrecomputed } from "../precomputed.ts";
import { buildResultsFile } from "../results-export.ts";

type Db = ReturnType<typeof createDb>;
type CqaEnv = { Bindings: Bindings; Variables: { workspace: string; db: Db } };
const workspaceIdPattern = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/;
const cookieName = (url: URL) => (url.protocol === "https:" ? "__Host-cqa" : "cqa");

const workspace = createMiddleware<CqaEnv>(async (c, next) => {
  const url = new URL(c.req.url);
  const id = getCookie(c, cookieName(url));
  c.header("Cache-Control", "private, no-store");
  if (!id || !workspaceIdPattern.test(id)) {
    throw new HTTPException(401, { message: "Reload the page to open your workspace." });
  }
  const origin = c.req.header("Origin");
  if (c.req.method !== "GET" && origin && origin !== url.origin) {
    throw new HTTPException(403, { message: "Open the app to make changes to this workspace." });
  }
  c.set("workspace", id);
  c.set("db", createDb(c.env.DB));
  await next();
});

function findConversation(db: Db, workspaceId: string, id: string) {
  return db
    .select()
    .from(cqaConversations)
    .where(and(eq(cqaConversations.workspaceId, workspaceId), eq(cqaConversations.id, id)))
    .get();
}

async function importConversations(db: Db, workspaceId: string, { group, records }: Dataset) {
  const inserts = records.map((record) =>
    db
      .insert(cqaConversations)
      .values({
        id: crypto.randomUUID(),
        workspaceId,
        group,
        sourceId: record.conversation_id,
        channel: record.channel,
        language: record.language,
        transcript: record.transcript,
        audioUrl: record.audio_url,
      })
      .onConflictDoNothing()
      .returning({ id: cqaConversations.id }),
  );
  const [first, ...rest] = inserts;
  const results = await db.batch([first, ...rest]);
  const imported = results.reduce((count, rows) => count + rows.length, 0);
  return { imported, skipped: records.length - imported };
}

function findChecklist(db: Db, workspaceId: string, id: string) {
  if (id === defaultChecklist.id) return defaultChecklist;
  return db
    .select({
      id: cqaChecklists.id,
      name: cqaChecklists.name,
      revision: cqaChecklists.revision,
      criteria: cqaChecklists.criteria,
    })
    .from(cqaChecklists)
    .where(and(eq(cqaChecklists.workspaceId, workspaceId), eq(cqaChecklists.id, id)))
    .get();
}

function findEvaluation(db: Db, workspaceId: string, id: string) {
  return db
    .select({ evaluation: cqaEvaluations, conversation: cqaConversations })
    .from(cqaEvaluations)
    .innerJoin(cqaConversations, eq(cqaEvaluations.conversationId, cqaConversations.id))
    .where(and(eq(cqaConversations.workspaceId, workspaceId), eq(cqaEvaluations.id, id)))
    .get();
}

function summarizeAppeal(
  row: {
    appeal: typeof cqaAppeals.$inferSelect;
    evaluation: typeof cqaEvaluations.$inferSelect;
    conversation: typeof cqaConversations.$inferSelect;
  },
  evaluationAppeals: (typeof cqaAppeals.$inferSelect)[],
) {
  const { appeal, evaluation, conversation } = row;
  // The evaluation's score before any appeal and after every decision made on it so far.
  const before = scoreEvaluation(evaluation.checklist, evaluation.ratings, []);
  const after = scoreEvaluation(evaluation.checklist, evaluation.ratings, evaluationAppeals);
  const criterion = evaluation.checklist.criteria.find(({ id }) => id === appeal.criterionId)!;
  const original = evaluation.ratings.find(
    ({ criterionId }) => criterionId === appeal.criterionId,
  )!;
  return {
    ...appeal,
    conversation: {
      id: conversation.id,
      sourceId: conversation.sourceId,
      group: conversation.group,
    },
    criterion,
    original,
    score: {
      original: before.total,
      final: after.total,
      violationOriginal: before.seriousViolation,
      violationFinal: after.seriousViolation,
    },
    evidence: original.evidence.map((number) => ({
      number,
      ...conversation.transcript[number - 1],
    })),
  };
}

export const cqaRoutes = new Hono<CqaEnv>()
  .get("/workspace", (c) => {
    const url = new URL(c.req.url);
    const name = cookieName(url);
    const id = getCookie(c, name);
    c.header("Cache-Control", "private, no-store");
    if (!id || !workspaceIdPattern.test(id)) {
      setCookie(c, name, crypto.randomUUID(), {
        path: "/",
        httpOnly: true,
        secure: url.protocol === "https:",
        sameSite: "Strict",
        maxAge: 60 * 60 * 24 * 90,
      });
    }
    return c.json({ ready: true });
  })
  .use("*", workspace)
  .get("/dashboard", async (c) => {
    const dashboard = await readDashboard(c.get("db"), c.get("workspace"));
    return c.json(dashboard);
  })
  .get("/conversations", async (c) => {
    const db = c.get("db");
    const evaluations = db
      .select({ id: cqaEvaluations.id })
      .from(cqaEvaluations)
      .where(eq(cqaEvaluations.conversationId, cqaConversations.id));
    const conversations = await db
      .select({
        id: cqaConversations.id,
        sourceId: cqaConversations.sourceId,
        group: cqaConversations.group,
        channel: cqaConversations.channel,
        language: cqaConversations.language,
        evaluated: exists(evaluations).mapWith(Boolean),
      })
      .from(cqaConversations)
      .where(eq(cqaConversations.workspaceId, c.get("workspace")))
      .orderBy(asc(cqaConversations.group), asc(cqaConversations.sourceId));
    return c.json({ conversations });
  })
  .post(
    "/conversations",
    bodyLimit({
      maxSize: 5 * 1024 * 1024,
      onError: () => {
        throw new HTTPException(413, { message: "Import a JSON file under 5 MB." });
      },
    }),
    zValidator("json", datasetSchema, validationError),
    async (c) => {
      const result = await importConversations(
        c.get("db"),
        c.get("workspace"),
        c.req.valid("json"),
      );
      return c.json(result, 201);
    },
  )
  .post("/conversations/import-dev", async (c) => {
    const dataset = datasetFileSchema.parse(devDataset);
    const result = await importConversations(c.get("db"), c.get("workspace"), dataset);
    return c.json(result, 201);
  })
  .post("/evaluations/import-dev", async (c) => {
    const data = precomputedEvaluationsSchema.parse(devEvaluations);
    const result = await importPrecomputed(c.get("db"), c.get("workspace"), defaultChecklist, data);
    return c.json(result, 201);
  })
  .get("/conversations/:id/recording", async (c) => {
    const conversation = await findConversation(c.get("db"), c.get("workspace"), c.req.param("id"));
    if (!conversation?.audioUrl) throw new HTTPException(404, { message: "Recording not found." });

    const source = await resolveRecordingUrl(conversation.audioUrl).catch(() => null);
    return source ? c.redirect(source, 302) : c.body(null, 502);
  })
  .get("/conversations/:id", async (c) => {
    const db = c.get("db");
    const conversation = await findConversation(db, c.get("workspace"), c.req.param("id"));
    if (!conversation) throw new HTTPException(404, { message: "Conversation not found." });
    const evaluations = await db
      .select({
        id: cqaEvaluations.id,
        checklist: cqaEvaluations.checklist,
        model: cqaEvaluations.model,
        createdAt: cqaEvaluations.createdAt,
      })
      .from(cqaEvaluations)
      .where(eq(cqaEvaluations.conversationId, conversation.id))
      .orderBy(desc(cqaEvaluations.createdAt), desc(cqaEvaluations.id));
    const { id, sourceId, group, channel, language, transcript, audioUrl } = conversation;
    return c.json({
      conversation: { id, sourceId, group, channel, language, transcript, audioUrl },
      evaluations: evaluations.map(({ id, checklist, model, createdAt }) => ({
        id,
        model,
        checklistName: checklist.name,
        revision: checklist.revision,
        createdAt,
      })),
    });
  })
  .get("/checklists", async (c) => {
    const checklists = await c
      .get("db")
      .select({
        id: cqaChecklists.id,
        name: cqaChecklists.name,
        revision: cqaChecklists.revision,
        criteria: cqaChecklists.criteria,
      })
      .from(cqaChecklists)
      .where(eq(cqaChecklists.workspaceId, c.get("workspace")))
      .orderBy(asc(cqaChecklists.name));
    return c.json({
      checklists: [defaultChecklist, ...checklists],
      defaultId: defaultChecklist.id,
    });
  })
  .post("/checklists", zValidator("json", checklistSchema, validationError), async (c) => {
    const checklist = { id: crypto.randomUUID(), revision: 1, ...c.req.valid("json") };
    await c
      .get("db")
      .insert(cqaChecklists)
      .values({ ...checklist, workspaceId: c.get("workspace") });
    return c.json({ checklist }, 201);
  })
  .put("/checklists/:id", zValidator("json", saveChecklistSchema, validationError), async (c) => {
    const { revision, ...draft } = c.req.valid("json");
    if (!revision)
      throw new HTTPException(400, { message: "Include the checklist version when saving." });
    const id = c.req.param("id");
    const workspaceId = c.get("workspace");
    const db = c.get("db");
    const current = await findChecklist(db, workspaceId, id);
    if (!current || id === defaultChecklist.id)
      throw new HTTPException(404, { message: "Saved checklist not found." });
    const checklist = { ...draft, id, revision: revision + 1 };
    const rows = await db
      .update(cqaChecklists)
      .set(checklist)
      .where(
        and(
          eq(cqaChecklists.id, id),
          eq(cqaChecklists.workspaceId, workspaceId),
          eq(cqaChecklists.revision, revision),
        ),
      )
      .returning({ id: cqaChecklists.id });
    if (!rows.length)
      throw new HTTPException(409, { message: "This checklist changed. Reload it before saving." });
    return c.json({ checklist });
  })
  .delete("/checklists/:id", async (c) => {
    const id = c.req.param("id");
    if (id === defaultChecklist.id)
      throw new HTTPException(404, { message: "Saved checklist not found." });
    await c
      .get("db")
      .delete(cqaChecklists)
      .where(and(eq(cqaChecklists.id, id), eq(cqaChecklists.workspaceId, c.get("workspace"))));
    return c.json({ id });
  })
  .post(
    "/conversations/:id/evaluations",
    zValidator("json", runEvaluationSchema, validationError),
    async (c) => {
      const db = c.get("db");
      const workspaceId = c.get("workspace");
      const { id, checklistId } = c.req.valid("json");
      const [conversation, checklist, existing] = await Promise.all([
        findConversation(db, workspaceId, c.req.param("id")),
        findChecklist(db, workspaceId, checklistId),
        findEvaluation(db, workspaceId, id),
      ]);
      if (!conversation)
        throw new HTTPException(404, { message: "Conversation or checklist not found." });
      if (existing) {
        if (
          existing.conversation.id !== conversation.id ||
          existing.evaluation.checklist.id !== checklistId
        ) {
          throw new HTTPException(409, { message: "This evaluation ID is already in use." });
        }
        return c.json({ id }, 200);
      }
      if (!checklist)
        throw new HTTPException(404, { message: "Conversation or checklist not found." });
      const llm =
        c.env.LLM ??
        (c.env.HF_TOKEN
          ? createHfClient({ apiKey: c.env.HF_TOKEN, model: c.env.CQA_MODEL })
          : undefined);
      if (!llm)
        return c.json(
          {
            error: {
              code: "AI_UNAVAILABLE",
              message: "The evaluation model is not configured. Set HF_TOKEN to run an evaluation.",
            },
          },
          503,
        );

      let run;
      try {
        run = await evaluateConversation(llm, conversation, checklist);
      } catch (cause) {
        if (cause instanceof InferenceApiError && cause.isAuthError) {
          console.warn("CQA evaluation rejected by the model provider", cause.status);
          return c.json(
            {
              error: {
                code: "AI_UNAVAILABLE",
                message:
                  "The model provider rejected HF_TOKEN. Check the token and its permissions.",
              },
            },
            503,
          );
        }
        if (cause instanceof EvaluationError) {
          console.warn("CQA evaluation rejected", cause.attempts.at(-1)?.errors);
        } else {
          console.warn("CQA evaluation failed", cause instanceof Error ? cause.message : cause);
        }
        return c.json(
          {
            error: {
              code: "EVALUATION_FAILED",
              message:
                "The model could not return a complete evaluation. Try again, and check HF_TOKEN if the problem persists.",
            },
          },
          502,
        );
      }
      const { ratings } = run;
      const saved = await db
        .insert(cqaEvaluations)
        .values({
          id,
          conversationId: conversation.id,
          checklist,
          ratings,
          model: run.model,
          createdAt: new Date(),
        })
        .onConflictDoNothing()
        .returning({ id: cqaEvaluations.id });
      if (!saved.length) {
        const concurrent = await findEvaluation(db, workspaceId, id);
        if (
          concurrent?.conversation.id !== conversation.id ||
          concurrent.evaluation.checklist.id !== checklistId
        ) {
          throw new HTTPException(409, { message: "This evaluation ID is already in use." });
        }
        return c.json({ id }, 200);
      }
      return c.json({ id }, 201);
    },
  )
  .get("/evaluations/:id", async (c) => {
    const db = c.get("db");
    const found = await findEvaluation(db, c.get("workspace"), c.req.param("id"));
    if (!found) throw new HTTPException(404, { message: "Evaluation not found." });
    const { evaluation } = found;
    const appeals = await db
      .select()
      .from(cqaAppeals)
      .where(eq(cqaAppeals.evaluationId, evaluation.id));
    return c.json({
      evaluation: {
        id: evaluation.id,
        conversationId: evaluation.conversationId,
        checklist: evaluation.checklist,
        model: evaluation.model,
        createdAt: evaluation.createdAt,
        appeals,
        originalTotal: scoreEvaluation(evaluation.checklist, evaluation.ratings, []).total,
        ...scoreEvaluation(evaluation.checklist, evaluation.ratings, appeals),
      },
    });
  })
  .post(
    "/evaluations/:id/appeals",
    zValidator("json", createAppealSchema, validationError),
    async (c) => {
      const db = c.get("db");
      const found = await findEvaluation(db, c.get("workspace"), c.req.param("id"));
      if (!found) throw new HTTPException(404, { message: "Evaluation not found." });
      const input = c.req.valid("json");
      if (!found.evaluation.ratings.some(({ criterionId }) => criterionId === input.criterionId)) {
        throw new HTTPException(404, { message: "Criterion not found." });
      }
      const appeal = {
        ...input,
        id: crypto.randomUUID(),
        evaluationId: found.evaluation.id,
        createdAt: new Date(),
        decision: null,
        decidedAt: null,
      };
      const rows = await db
        .insert(cqaAppeals)
        .values(appeal)
        .onConflictDoNothing()
        .returning({ id: cqaAppeals.id });
      if (!rows.length)
        throw new HTTPException(409, { message: "An appeal already exists for this rating." });
      return c.json({ appeal }, 201);
    },
  )
  .get("/appeals", async (c) => {
    const appeals = await c
      .get("db")
      .select({ appeal: cqaAppeals, evaluation: cqaEvaluations, conversation: cqaConversations })
      .from(cqaAppeals)
      .innerJoin(cqaEvaluations, eq(cqaAppeals.evaluationId, cqaEvaluations.id))
      .innerJoin(cqaConversations, eq(cqaEvaluations.conversationId, cqaConversations.id))
      .where(eq(cqaConversations.workspaceId, c.get("workspace")))
      .orderBy(asc(cqaAppeals.decidedAt), desc(cqaAppeals.createdAt));
    const byEvaluation = new Map<string, (typeof cqaAppeals.$inferSelect)[]>();
    for (const { appeal } of appeals) {
      byEvaluation.set(appeal.evaluationId, [
        ...(byEvaluation.get(appeal.evaluationId) ?? []),
        appeal,
      ]);
    }
    return c.json({
      appeals: appeals.map((row) =>
        summarizeAppeal(row, byEvaluation.get(row.appeal.evaluationId)!),
      ),
    });
  })
  .put(
    "/appeals/:id/decision",
    zValidator("json", decideAppealSchema, validationError),
    async (c) => {
      const db = c.get("db");
      const id = c.req.param("id");
      const found = await db
        .select({ appeal: cqaAppeals, checklist: cqaEvaluations.checklist })
        .from(cqaAppeals)
        .innerJoin(cqaEvaluations, eq(cqaAppeals.evaluationId, cqaEvaluations.id))
        .innerJoin(cqaConversations, eq(cqaEvaluations.conversationId, cqaConversations.id))
        .where(and(eq(cqaConversations.workspaceId, c.get("workspace")), eq(cqaAppeals.id, id)))
        .get();
      if (!found) throw new HTTPException(404, { message: "Appeal not found." });
      const decision = c.req.valid("json");
      const criterion = found.checklist.criteria.find(({ id }) => id === found.appeal.criterionId);
      if (!criterion || !answerOptions(criterion).includes(decision.answer)) {
        throw new HTTPException(400, {
          message: "Choose an answer allowed by the original checklist.",
        });
      }
      const decidedAt = new Date();
      const rows = await db
        .update(cqaAppeals)
        .set({ decision, decidedAt })
        .where(and(eq(cqaAppeals.id, id), isNull(cqaAppeals.decidedAt)))
        .returning({ id: cqaAppeals.id });
      if (!rows.length)
        throw new HTTPException(409, { message: "This appeal has already been decided." });
      return c.json({ decision, decidedAt });
    },
  )
  .post("/results/export", zValidator("json", exportResultsSchema, validationError), async (c) => {
    const db = c.get("db");
    const workspaceId = c.get("workspace");
    const { ids: requested, checklistId } = c.req.valid("json");
    const ids = [...new Set(requested)];
    const checklist = await findChecklist(db, workspaceId, checklistId);
    if (!checklist) throw new HTTPException(404, { message: "Checklist not found." });

    const conversations = await db
      .select({
        id: cqaConversations.id,
        sourceId: cqaConversations.sourceId,
        transcript: cqaConversations.transcript,
      })
      .from(cqaConversations)
      .where(eq(cqaConversations.workspaceId, workspaceId));
    const byId = new Map(conversations.map((row) => [row.id, row]));
    if (ids.some((id) => !byId.has(id))) {
      throw new HTTPException(404, {
        message: "Some selected conversations were not found. Reload the page.",
      });
    }

    // The newest evaluation per conversation made with the chosen checklist.
    const evaluations = await db
      .select({
        conversationId: cqaEvaluations.conversationId,
        checklist: cqaEvaluations.checklist,
        ratings: cqaEvaluations.ratings,
        model: cqaEvaluations.model,
      })
      .from(cqaEvaluations)
      .innerJoin(cqaConversations, eq(cqaEvaluations.conversationId, cqaConversations.id))
      .where(eq(cqaConversations.workspaceId, workspaceId))
      .orderBy(desc(cqaEvaluations.createdAt), desc(cqaEvaluations.id));
    const latest = new Map<string, (typeof evaluations)[number]>();
    for (const row of evaluations) {
      if (row.checklist.id === checklistId && !latest.has(row.conversationId)) {
        latest.set(row.conversationId, row);
      }
    }

    const { file, problems, models } = buildResultsFile(
      ids.map((id) => {
        const conversation = byId.get(id)!;
        const evaluation = latest.get(id);
        return {
          sourceId: conversation.sourceId,
          turnCount: conversation.transcript.length,
          evaluation: evaluation
            ? {
                checklist: evaluation.checklist,
                ratings: evaluation.ratings,
                model: evaluation.model,
              }
            : null,
        };
      }),
    );
    if (problems.length) {
      return c.json(
        { error: { code: "EXPORT_INVALID", message: problems.slice(0, 3).join(" ") } },
        422,
      );
    }
    const ok = file.results.filter(({ status }) => status === "ok").length;
    return c.json({ file, summary: { ok, errors: file.results.length - ok, models } });
  });
