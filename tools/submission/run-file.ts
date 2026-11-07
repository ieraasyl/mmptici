// The run file: one checkpointed record per input conversation, plus everything needed to
// refuse a resume when the inputs or the evaluator changed. Written with a temporary file
// and a rename so an interrupted write never damages the last good checkpoint.

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import {
  checklistSchema,
  ratingSchema,
  type Checklist,
  type ConversationRecord,
} from "../../packages/contracts/src/index.ts";

export const RUN_FILE_VERSION = 1;
export const recordStatuses = ["pending", "running", "succeeded", "failed"] as const;
export type RecordStatus = (typeof recordStatuses)[number];

const failureSchema = z.object({ at: z.string(), error: z.string().min(1) });
const usageSchema = z.object({ promptTokens: z.number(), completionTokens: z.number() });

export const runRecordSchema = z
  .object({
    status: z.enum(recordStatuses),
    attempts: z.number().int().nonnegative(),
    startedAt: z.string().optional(),
    finishedAt: z.string().optional(),
    ratings: z.array(ratingSchema).optional(),
    model: z.string().optional(),
    usage: usageSchema.optional(),
    latencyMs: z.number().optional(),
    error: z.string().optional(),
    /** Every failure so far, kept when a retry later succeeds. */
    failures: z.array(failureSchema),
  })
  .superRefine((record, ctx) => {
    if (record.status === "succeeded" && (!record.ratings?.length || !record.model)) {
      ctx.addIssue({
        code: "custom",
        message: "a succeeded record needs ratings and the model that produced them",
      });
    }
    if (record.status === "failed" && !record.error) {
      ctx.addIssue({ code: "custom", message: "a failed record needs an error" });
    }
  });

export const runFileSchema = z.object({
  version: z.literal(RUN_FILE_VERSION),
  createdAt: z.string(),
  updatedAt: z.string(),
  commit: z.string(),
  input: z.object({
    path: z.string(),
    fingerprint: z.string(),
    count: z.number().int(),
    ids: z.array(z.string()),
  }),
  evaluator: z.object({ promptVersion: z.string(), sources: z.record(z.string(), z.string()) }),
  checklist: z.object({
    id: z.string(),
    revision: z.number(),
    fingerprint: z.string(),
    snapshot: checklistSchema.safeExtend({ id: z.string(), revision: z.number() }),
  }),
  model: z.object({
    provider: z.string(),
    name: z.string(),
    temperature: z.number(),
    maxTokens: z.number(),
    maxValidationRetries: z.number(),
    retryDelaysMs: z.array(z.number()),
  }),
  records: z.record(z.string(), runRecordSchema),
});

export type RunRecord = z.infer<typeof runRecordSchema>;
export type RunFile = z.infer<typeof runFileSchema>;
export type RunSettings = RunFile["model"];

const sha = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 16);

/** Identity of the input: IDs, channel, language, and transcripts, in order. */
export function fingerprintRecords(records: readonly ConversationRecord[]): string {
  return sha(
    JSON.stringify(
      records.map(({ conversation_id, channel, language, transcript }) => ({
        conversation_id,
        channel,
        language,
        transcript,
      })),
    ),
  );
}

export function fingerprintChecklist(checklist: Checklist): string {
  return sha(JSON.stringify(checklist));
}

export function emptyRecord(): RunRecord {
  return { status: "pending", attempts: 0, failures: [] };
}

export function parseRunFile(value: unknown, path: string): RunFile {
  const parsed = runFileSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(
      `${path} is not a valid run file: ${issue.path.join(".") || "file"}: ${issue.message}`,
    );
  }
  const file = parsed.data;
  const missing = file.input.ids.filter((id) => !file.records[id]);
  const extra = Object.keys(file.records).filter((id) => !file.input.ids.includes(id));
  if (missing.length || extra.length) {
    throw new Error(
      `${path} is not a valid run file: records do not match input IDs` +
        (missing.length ? ` (missing ${missing.join(", ")})` : "") +
        (extra.length ? ` (unexpected ${extra.join(", ")})` : ""),
    );
  }
  return file;
}

/** Writes checkpoints one after another through a temporary file and a rename. */
export class RunStore {
  private queue: Promise<void> = Promise.resolve();

  constructor(
    readonly path: string,
    readonly file: RunFile,
  ) {}

  update(id: string, patch: Partial<RunRecord>): Promise<void> {
    const current = this.file.records[id] ?? emptyRecord();
    this.file.records[id] = { ...current, ...patch };
    return this.save();
  }

  save(): Promise<void> {
    this.file.updatedAt = new Date().toISOString();
    const snapshot = JSON.stringify(this.file, null, 2);
    this.queue = this.queue.then(async () => {
      await mkdir(dirname(this.path), { recursive: true });
      const temporary = `${this.path}.${process.pid}.tmp`;
      await writeFile(temporary, snapshot, "utf8");
      await rename(temporary, this.path);
    });
    return this.queue;
  }

  /** Waits for every queued write. */
  flush(): Promise<void> {
    return this.queue;
  }
}

export function runFileExists(path: string): boolean {
  return existsSync(path);
}
