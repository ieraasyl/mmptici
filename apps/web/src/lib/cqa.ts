import { queryOptions } from "@tanstack/react-query";
import type { EvaluationOrigin } from "@app/contracts";
import type { InferResponseType } from "hono/client";
import { api } from "./api";
import { request } from "./request";

export const cqa = api.cqa;

export const dashboardQuery = queryOptions({
  queryKey: ["dashboard"],
  queryFn: ({ signal }) => request((init) => cqa.dashboard.$get({}, { init }), { signal }),
});

export type DashboardConversation = InferResponseType<
  typeof cqa.dashboard.$get,
  200
>["conversations"][number];

export type DashboardData = InferResponseType<typeof cqa.dashboard.$get, 200>;
export type DashboardChecklistResult = DashboardData["checklistResults"][number];

export const conversationsQuery = queryOptions({
  queryKey: ["conversations"],
  queryFn: ({ signal }) => request((init) => cqa.conversations.$get({}, { init }), { signal }),
});

export const conversationQuery = (id: string) =>
  queryOptions({
    queryKey: ["conversation", id],
    queryFn: ({ signal }) =>
      request((init) => cqa.conversations[":id"].$get({ param: { id } }, { init }), { signal }),
  });

export const checklistsQuery = queryOptions({
  queryKey: ["checklists"],
  queryFn: ({ signal }) => request((init) => cqa.checklists.$get({}, { init }), { signal }),
});

export const evaluationQuery = (id: string) =>
  queryOptions({
    queryKey: ["evaluation", id],
    queryFn: ({ signal }) =>
      request((init) => cqa.evaluations[":id"].$get({ param: { id } }, { init }), { signal }),
  });

export const appealsQuery = queryOptions({
  queryKey: ["appeals"],
  queryFn: ({ signal }) => request((init) => cqa.appeals.$get({}, { init }), { signal }),
});

export type ConversationSummary = InferResponseType<
  typeof cqa.conversations.$get,
  200
>["conversations"][number];
const conversationEndpoint = cqa.conversations[":id"];
const evaluationEndpoint = cqa.evaluations[":id"];
export type Conversation = InferResponseType<typeof conversationEndpoint.$get, 200>["conversation"];
export type EvaluationHistory = InferResponseType<
  typeof conversationEndpoint.$get,
  200
>["evaluations"];
export type Evaluation = InferResponseType<typeof evaluationEndpoint.$get, 200>["evaluation"];
export type Appeal = InferResponseType<typeof cqa.appeals.$get, 200>["appeals"][number];

export const languageName = { RU: "Russian", KZ: "Kazakh", EN: "English" };
export const channelName = { "agent chat": "Chat", "voice call": "Call" };
export const speakerName = {
  operator: "Operator",
  client: "Customer",
  bot: "Bot",
  system: "System",
};
export const scoreLabel = (score: number | null) => (score === null ? "N/A" : `${score}%`);
export const pointLabel = (points: number) =>
  new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(points);
export const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
export const originLabel: Record<EvaluationOrigin, string> = {
  live: "Live",
  imported: "Imported",
  unknown: "Unknown origin",
};
/** "Qwen/Qwen3.8-27B:cerebras" -> "Qwen3.8-27B"; names without an org or provider stay as they are. */
export const modelLabel = (model: string) => model.split("/").at(-1)!.split(":")[0];
