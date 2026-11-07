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
  datasetSchema,
  decideAppealSchema,
  runEvaluationSchema,
  saveChecklistSchema,
} from "@app/contracts";
import { and, asc, createDb, desc, eq, exists, isNull } from "@app/db";
import { cqaAppeals, cqaChecklists, cqaConversations, cqaEvaluations } from "@app/db/schema";
import { defaultChecklist } from "../checklist.ts";
import type { Bindings } from "../env.ts";
import { validationError } from "../errors.ts";
import { evaluateConversation, evaluationModel, scoreEvaluation } from "../evaluation.ts";

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

function summarizeAppeal(row: {
  appeal: typeof cqaAppeals.$inferSelect;
  evaluation: typeof cqaEvaluations.$inferSelect;
  conversation: typeof cqaConversations.$inferSelect;
}) {
  const { appeal, evaluation, conversation } = row;
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
      const db = c.get("db");
      const { group, records } = c.req.valid("json");
      const workspaceId = c.get("workspace");
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
      return c.json({ imported, skipped: records.length - imported }, 201);
    },
  )
  .get("/conversations/:id", async (c) => {
    const db = c.get("db");
    const conversation = await findConversation(db, c.get("workspace"), c.req.param("id"));
    if (!conversation) throw new HTTPException(404, { message: "Conversation not found." });
    const evaluations = await db
      .select({
        id: cqaEvaluations.id,
        checklist: cqaEvaluations.checklist,
        createdAt: cqaEvaluations.createdAt,
      })
      .from(cqaEvaluations)
      .where(eq(cqaEvaluations.conversationId, conversation.id))
      .orderBy(desc(cqaEvaluations.createdAt), desc(cqaEvaluations.id));
    const { id, sourceId, group, channel, language, transcript, audioUrl } = conversation;
    return c.json({
      conversation: { id, sourceId, group, channel, language, transcript, audioUrl },
      evaluations: evaluations.map(({ id, checklist, createdAt }) => ({
        id,
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
      if (!conversation || !checklist)
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
      if (!c.env.AI)
        return c.json(
          {
            error: {
              code: "AI_UNAVAILABLE",
              message:
                "Workers AI is unavailable. Connect a Cloudflare account to run an evaluation.",
            },
          },
          503,
        );

      let ratings;
      try {
        ratings = await evaluateConversation(c.env.AI, conversation, checklist);
      } catch (cause) {
        console.warn("CQA evaluation failed", cause instanceof Error ? cause.name : "UnknownError");
        return c.json(
          {
            error: {
              code: "EVALUATION_FAILED",
              message:
                "Workers AI could not return a complete evaluation. Try again and check the Workers AI connection if the problem persists.",
            },
          },
          502,
        );
      }
      const saved = await db
        .insert(cqaEvaluations)
        .values({
          id,
          conversationId: conversation.id,
          checklist,
          ratings,
          model: evaluationModel,
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
    return c.json({ appeals: appeals.map(summarizeAppeal) });
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
  );
