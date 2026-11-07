import type {
  AppealDecision,
  Checklist,
  ChecklistDraft,
  ConversationRecord,
  Rating,
  Turn,
} from "@app/contracts";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const cqaConversations = sqliteTable(
  "cqa_conversations",
  {
    id: text().primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    group: text("dataset_group").notNull(),
    sourceId: text("source_id").notNull(),
    channel: text().$type<ConversationRecord["channel"]>().notNull(),
    language: text().$type<ConversationRecord["language"]>().notNull(),
    transcript: text({ mode: "json" }).$type<Turn[]>().notNull(),
    audioUrl: text("audio_url"),
  },
  (table) => [
    uniqueIndex("cqa_conversations_source").on(table.workspaceId, table.group, table.sourceId),
  ],
);

export const cqaChecklists = sqliteTable(
  "cqa_checklists",
  {
    id: text().primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    name: text().notNull(),
    revision: integer().notNull(),
    criteria: text({ mode: "json" }).$type<ChecklistDraft["criteria"]>().notNull(),
  },
  (table) => [index("cqa_checklists_workspace").on(table.workspaceId)],
);

export const cqaEvaluations = sqliteTable(
  "cqa_evaluations",
  {
    id: text().primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => cqaConversations.id),
    checklist: text({ mode: "json" }).$type<Checklist>().notNull(),
    ratings: text({ mode: "json" }).$type<Rating[]>().notNull(),
    model: text().notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("cqa_evaluations_conversation").on(table.conversationId, table.createdAt)],
);

export const cqaAppeals = sqliteTable(
  "cqa_appeals",
  {
    id: text().primaryKey(),
    evaluationId: text("evaluation_id")
      .notNull()
      .references(() => cqaEvaluations.id),
    criterionId: text("criterion_id").notNull(),
    comment: text().notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    decision: text({ mode: "json" }).$type<AppealDecision>(),
    decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
  },
  (table) => [uniqueIndex("cqa_appeals_criterion").on(table.evaluationId, table.criterionId)],
);
