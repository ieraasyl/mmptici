import { z } from "zod";

export const languages = ["RU", "KZ", "EN"] as const;
export const channels = ["agent chat", "voice call"] as const;
export const turnSchema = z.object({
  timestamp: z.string().trim().min(1).max(80),
  speaker: z.enum(["client", "operator", "bot", "system"]),
  text: z.string().min(1).max(12_000),
});

const audioUrl = z.url({ protocol: /^https?$/ }).max(8192);
export const conversationSchema = z.object({
  conversation_id: z.string().trim().min(1).max(150),
  channel: z.enum(channels),
  language: z.enum(languages),
  transcript: z
    .array(turnSchema)
    .min(1)
    .max(1500)
    .refine(
      (turns) => turns.reduce((total, turn) => total + turn.text.length, 0) <= 100_000,
      "Keep each transcript under 100,000 characters.",
    ),
  audio_url: z.union([audioUrl, z.literal("").transform(() => null), z.null()]).default(null),
});
const uniqueRecords = ({ records }: { records: { conversation_id: string }[] }) =>
  new Set(records.map((record) => record.conversation_id)).size === records.length;
const duplicateRecord = {
  path: ["records"],
  message: "Each conversation ID must appear only once per import.",
};

export const datasetSchema = z
  .object({
    group: z.string().trim().min(1).max(80),
    records: z.array(conversationSchema).min(1).max(100),
  })
  .refine(uniqueRecords, duplicateRecord);
export const datasetFileSchema = z
  .union([
    z
      .object({
        isSuccess: z.literal(true),
        data: z.object({
          dataset_group_id: datasetSchema.shape.group,
          records: datasetSchema.shape.records,
        }),
      })
      .transform(({ data }) => ({ group: data.dataset_group_id, records: data.records })),
    datasetSchema,
    z
      .array(conversationSchema)
      .min(1)
      .max(100)
      .transform((records) => ({ group: "Imported", records })),
    conversationSchema.transform((record) => ({ group: "Imported", records: [record] })),
  ])
  .refine(uniqueRecords, duplicateRecord);

export const answerSchema = z.union([z.enum(["yes", "no", "na"]), z.number().finite()]);
const criterionId = z
  .string()
  .trim()
  .max(60)
  .regex(/^[a-z0-9][a-z0-9_-]*$/i);

export const criterionSchema = z
  .object({
    id: criterionId,
    title: z.string().trim().min(1).max(150),
    section: z.string().trim().min(1).max(100),
    guidance: z.string().trim().min(1).max(2400),
    weight: z.number().min(0).max(100),
    kind: z.enum(["binary", "numeric", "flag"]),
    scale: z.array(z.number().min(0).max(1000)).max(12),
    allowNA: z.boolean(),
  })
  .superRefine((criterion, ctx) => {
    if (criterion.kind === "flag" && (criterion.weight !== 0 || criterion.allowNA)) {
      ctx.addIssue({
        code: "custom",
        path: ["kind"],
        message: "Serious violations use Yes or No and carry zero weight.",
      });
    }
    if (criterion.kind === "numeric") {
      if (
        criterion.scale.length < 2 ||
        !criterion.scale.some((value) => value > 0) ||
        criterion.scale.some((value, index, values) => index > 0 && value <= values[index - 1])
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["scale"],
          message:
            "Enter at least two distinct scale values in ascending order, including a positive value.",
        });
      }
    } else if (criterion.scale.length) {
      ctx.addIssue({
        code: "custom",
        path: ["scale"],
        message: "Only numeric criteria use a scale.",
      });
    }
  });

export const checklistSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    criteria: z.array(criterionSchema).min(1).max(20),
  })
  .refine(({ criteria }) => new Set(criteria.map(({ id }) => id)).size === criteria.length, {
    path: ["criteria"],
    message: "Each criterion must have a unique ID.",
  });

export const saveChecklistSchema = checklistSchema.safeExtend({
  revision: z.number().int().positive().optional(),
});
export const runEvaluationSchema = z.object({
  id: z.uuid(),
  checklistId: z.uuid(),
});
/** Where a saved evaluation came from: a model call made by the app, a bundled import, or unknown for rows saved before origins were recorded. */
export const evaluationOrigins = ["live", "imported", "unknown"] as const;
export type EvaluationOrigin = (typeof evaluationOrigins)[number];
export const ratingSchema = z.object({
  criterionId,
  answer: answerSchema,
  explanation: z.string().trim().min(1).max(1500),
  evidence: z.array(z.number().int().positive()).min(1).max(5),
});
const modelAnswer = z.union([
  z.enum(["yes", "no", "na"]),
  z
    .string()
    .refine((value) => String(Number(value)) === value)
    .transform(Number)
    .pipe(z.number().finite()),
]);
export const modelRatingsSchema = z.object({
  ratings: z.record(
    criterionId,
    ratingSchema.omit({ criterionId: true }).extend({ answer: modelAnswer }),
  ),
});
/** Evaluations produced outside the app (other models, hand scoring) that ship with the DEV data. */
export const precomputedEvaluationsSchema = z.object({
  checklistId: z.string(),
  evaluations: z.array(
    z.object({
      conversation_id: z.string(),
      model: z.string().trim().min(1).max(100),
      ratings: z.array(ratingSchema),
    }),
  ),
});
export const createAppealSchema = z.object({
  criterionId,
  comment: z.string().trim().min(1).max(2000),
});
export const decideAppealSchema = z.object({
  answer: answerSchema,
  reason: z.string().trim().min(1).max(2000),
});

export type ConversationRecord = z.infer<typeof conversationSchema>;
export type Turn = z.infer<typeof turnSchema>;
export type Answer = z.infer<typeof answerSchema>;
export type Criterion = z.infer<typeof criterionSchema>;
export type ChecklistDraft = z.infer<typeof checklistSchema>;
export type Checklist = ChecklistDraft & { id: string; revision: number };
export type Rating = z.infer<typeof ratingSchema>;
export type AppealDecision = z.infer<typeof decideAppealSchema>;
export type Dataset = z.infer<typeof datasetSchema>;
export type PrecomputedEvaluations = z.infer<typeof precomputedEvaluationsSchema>;

export function answerOptions(criterion: Criterion): Answer[] {
  const answers: Answer[] = criterion.kind === "numeric" ? [...criterion.scale] : ["yes", "no"];
  if (criterion.allowNA) answers.push("na");
  return answers;
}

export function answerLabel(answer: Answer): string {
  if (typeof answer === "number") return String(answer);
  return { yes: "Yes", no: "No", na: "N/A" }[answer];
}
