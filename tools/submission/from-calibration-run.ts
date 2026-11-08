// Turns a saved calibration run (tools/calibrate/runs/<name>.json, written by calibrate:run with
// the app's evaluator) into a submission run file, so its model answers can be exported without
// calling the model again. The run file records the calibration run's own evaluator fingerprint
// and model; it is an explicit import, never mixed with runs made by submission:run.
//
//   vp run submission:from-run --from tools/calibrate/runs/<name>.json --input <organizer-json> --run <run-json>

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defaultChecklist } from "../../apps/api/src/checklist.ts";
import { DEFAULT_MAX_TOKENS } from "../../apps/api/src/inference/index.ts";
import { ratingSchema, type ConversationRecord } from "../../packages/contracts/src/index.ts";
import { parseCli, required, runMain, UsageError, type Io } from "../calibrate/cli.ts";
import {
  emptyRecord,
  fingerprintChecklist,
  fingerprintRecords,
  parseRunFile,
  RUN_FILE_VERSION,
  RunStore,
  runFileExists,
  type RunFile,
  type RunRecord,
} from "./run-file.ts";
import { loadDataset } from "./run.ts";

type CalibrationRun = {
  promptVersion: string;
  provider?: string;
  model: string;
  samples?: number;
  temperature?: number;
  commit?: string;
  createdAt?: string;
  provenance?: { sources?: Record<string, string>; retry?: unknown };
  dialogs: {
    conversationId: string;
    ratings?: unknown[] | null;
    run?: {
      errors?: string[];
      usage?: { promptTokens: number; completionTokens: number };
      latencyMs?: number;
      requests?: number;
    };
  }[];
};

export function convertCalibrationRun(input: {
  from: CalibrationRun;
  fromPath: string;
  inputPath: string;
  records: readonly ConversationRecord[];
  now: Date;
}): RunFile {
  const { from } = input;
  if ((from.samples ?? 1) !== 1) {
    throw new UsageError(
      `${input.fromPath} used ${from.samples} samples per dialog; only single-sample runs can be submitted`,
    );
  }
  const byId = new Map(from.dialogs.map((dialog) => [dialog.conversationId, dialog]));
  const at = input.now.toISOString();
  const records: Record<string, RunRecord> = {};
  for (const { conversation_id } of input.records) {
    const dialog = byId.get(conversation_id);
    if (!dialog) {
      records[conversation_id] = emptyRecord();
      continue;
    }
    const ratings = (dialog.ratings ?? []).map((rating) => ratingSchema.parse(rating));
    const errors = dialog.run?.errors ?? [];
    if (ratings.length) {
      records[conversation_id] = {
        status: "succeeded",
        attempts: dialog.run?.requests ?? 1,
        finishedAt: from.createdAt ?? at,
        ratings,
        model: from.model,
        usage: dialog.run?.usage,
        latencyMs: dialog.run?.latencyMs,
        failures: errors.map((error) => ({ at: from.createdAt ?? at, error })),
      };
    } else {
      const error = errors.join(" ") || "The calibration run has no ratings for this dialog.";
      records[conversation_id] = {
        status: "failed",
        attempts: dialog.run?.requests ?? 1,
        finishedAt: from.createdAt ?? at,
        error,
        failures: [{ at: from.createdAt ?? at, error }],
      };
    }
  }
  return {
    version: RUN_FILE_VERSION,
    createdAt: at,
    updatedAt: at,
    commit: `${from.commit ?? "unknown"} (calibration run ${resolve(input.fromPath)})`,
    input: {
      path: resolve(input.inputPath),
      fingerprint: fingerprintRecords(input.records),
      count: input.records.length,
      ids: input.records.map((r) => r.conversation_id),
    },
    evaluator: { promptVersion: from.promptVersion, sources: from.provenance?.sources ?? {} },
    checklist: {
      id: defaultChecklist.id,
      revision: defaultChecklist.revision,
      fingerprint: fingerprintChecklist(defaultChecklist),
      snapshot: defaultChecklist,
    },
    model: {
      provider: from.provider ?? "hf-router",
      name: from.model,
      temperature: from.temperature ?? 0,
      maxTokens: DEFAULT_MAX_TOKENS,
      maxValidationRetries: 1,
      retryDelaysMs: [],
    },
    records,
  };
}

export async function main(argv: string[], io: Io): Promise<number> {
  const { options } = parseCli(argv, {
    from: { type: "string" },
    input: { type: "string" },
    run: { type: "string" },
  });
  const fromPath = required(options.from, "from");
  const runPath = required(options.run, "run");
  const inputPath = required(options.input, "input");
  if (runFileExists(runPath)) throw new UsageError(`${runPath} already exists; choose a new path`);
  const from = JSON.parse(readFileSync(fromPath, "utf8")) as CalibrationRun;
  const records = loadDataset(inputPath);
  const file = convertCalibrationRun({ from, fromPath, inputPath, records, now: new Date() });
  parseRunFile(file, runPath);
  const store = new RunStore(runPath, file);
  await store.save();
  const statuses = Object.values(file.records).map((r) => r.status);
  const count = (status: string) => statuses.filter((s) => s === status).length;
  io.out(
    `${from.model} · prompt ${from.promptVersion} · ${count("succeeded")} succeeded, ${count("failed")} failed, ${count("pending")} missing from the calibration run`,
  );
  io.out(`wrote ${runPath}`);
  return count("succeeded") === file.input.count ? 0 : 1;
}

if (import.meta.main) runMain(main);
