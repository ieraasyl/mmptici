// Evaluates an organizer dataset with the app's own evaluator and checkpoints every result.
//
//   vp run submission:run --input <organizer-json> --run <run-json>
//   vp run submission:run --resume <run-json>
//   vp run submission:run --retry-failed <run-json>
//
// A run file records the input, evaluator, checklist, and model it was made with. Resume
// and retry refuse to continue when any of those changed. Reads HF_TOKEN and optional
// CQA_MODEL from the environment or apps/api/.dev.vars; neither is ever written anywhere.
// Exit status 1 when any conversation is left failed, 2 for usage.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultChecklist } from "../../apps/api/src/checklist.ts";
import {
  createHfClient,
  DEFAULT_MAX_TOKENS,
  DEFAULT_MODEL,
  DEFAULT_RETRY_DELAYS_MS,
  evaluateConversation,
  EvaluationError,
  InferenceApiError,
  type LlmClient,
} from "../../apps/api/src/inference/index.ts";
import type { ConversationRecord } from "../../packages/contracts/src/index.ts";
import { parseCli, required, runMain, UsageError, type Io } from "../calibrate/cli.ts";
import { promptFingerprint } from "../calibrate/run.ts";
import { mapLimit, meteredClient } from "../calibrate/run-lib.ts";
import {
  emptyRecord,
  fingerprintChecklist,
  fingerprintRecords,
  parseRunFile,
  RUN_FILE_VERSION,
  RunStore,
  runFileExists,
  type RunFile,
  type RunSettings,
} from "./run-file.ts";
import { parseDataset } from "./validate.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
export const MAX_CONCURRENCY = 4;
/** evaluateConversation's default: one corrective retry after a reply fails validation. */
const MAX_VALIDATION_RETRIES = 1;

export type EvaluatorFingerprint = { promptVersion: string; sources: Record<string, string> };

export type RunDeps = {
  /** Builds the model client; tests pass a fake. */
  createClient?: (model: string) => LlmClient;
  /** Fingerprints the evaluator; tests override it to simulate a changed prompt. */
  fingerprint?: () => EvaluatorFingerprint;
  now?: () => Date;
};

function readVar(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  const file = `${root}apps/api/.dev.vars`;
  if (!existsSync(file)) return undefined;
  return readFileSync(file, "utf8")
    .match(new RegExp(`^${name}=(.+)$`, "m"))?.[1]
    ?.trim();
}

/** The app's inference settings: one sample at T=0 with the client's default budget and retries. */
export function currentSettings(model: string): RunSettings {
  return {
    provider: "hf-router",
    name: model,
    temperature: 0,
    maxTokens: DEFAULT_MAX_TOKENS,
    maxValidationRetries: MAX_VALIDATION_RETRIES,
    retryDelaysMs: [...DEFAULT_RETRY_DELAYS_MS],
  };
}

function currentCommit(): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root }).toString().trim();
  } catch {
    return "unknown";
  }
}

export function loadDataset(path: string): ConversationRecord[] {
  return parseDataset(JSON.parse(readFileSync(path, "utf8")));
}

export function newRunFile(input: {
  path: string;
  records: readonly ConversationRecord[];
  settings: RunSettings;
  fingerprint: EvaluatorFingerprint;
  now: Date;
}): RunFile {
  const at = input.now.toISOString();
  return {
    version: RUN_FILE_VERSION,
    createdAt: at,
    updatedAt: at,
    commit: currentCommit(),
    input: {
      path: resolve(input.path),
      fingerprint: fingerprintRecords(input.records),
      count: input.records.length,
      ids: input.records.map((r) => r.conversation_id),
    },
    evaluator: input.fingerprint,
    checklist: {
      id: defaultChecklist.id,
      revision: defaultChecklist.revision,
      fingerprint: fingerprintChecklist(defaultChecklist),
      snapshot: defaultChecklist,
    },
    model: input.settings,
    records: Object.fromEntries(input.records.map((r) => [r.conversation_id, emptyRecord()])),
  };
}

/** Everything that must be unchanged before a run file may be continued. */
export function continuationIssues(
  file: RunFile,
  current: {
    records: readonly ConversationRecord[];
    settings: RunSettings;
    promptVersion: string;
  },
): string[] {
  const issues: string[] = [];
  const inputFingerprint = fingerprintRecords(current.records);
  if (file.input.fingerprint !== inputFingerprint)
    issues.push(`the input changed (${file.input.fingerprint} recorded, ${inputFingerprint} now)`);
  const ids = current.records.map((r) => r.conversation_id);
  if (ids.join("\n") !== file.input.ids.join("\n"))
    issues.push("the input conversation IDs or their order changed");
  if (file.evaluator.promptVersion !== current.promptVersion)
    issues.push(
      `the evaluator changed (prompt ${file.evaluator.promptVersion} recorded, ${current.promptVersion} now)`,
    );
  const checklistFingerprint = fingerprintChecklist(defaultChecklist);
  if (file.checklist.fingerprint !== checklistFingerprint)
    issues.push("the default checklist changed");
  for (const key of Object.keys(current.settings) as (keyof RunSettings)[]) {
    const recorded = JSON.stringify(file.model[key]);
    const now = JSON.stringify(current.settings[key]);
    if (recorded !== now)
      issues.push(`model.${String(key)} changed (${recorded} recorded, ${now} now)`);
  }
  return issues;
}

function describeError(error: unknown): string {
  if (error instanceof EvaluationError) {
    const last = error.attempts.at(-1)?.errors ?? [];
    return [error.message, ...last.slice(0, 3)].join(" ");
  }
  if (error instanceof InferenceApiError) return `Inference API error ${error.status}`;
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

export async function evaluateRun(
  store: RunStore,
  records: readonly ConversationRecord[],
  ids: readonly string[],
  llm: LlmClient,
  options: { concurrency: number; io: Io; now: () => Date },
): Promise<{ succeeded: number; failed: number; stopped: number }> {
  const byId = new Map(records.map((r) => [r.conversation_id, r]));
  const checklist = store.file.checklist.snapshot;
  let fatal: string | null = null;
  const result = { succeeded: 0, failed: 0, stopped: 0 };
  const concurrency = Math.max(1, Math.min(MAX_CONCURRENCY, options.concurrency));

  await mapLimit([...ids], concurrency, async (id) => {
    if (fatal) {
      result.stopped += 1;
      return;
    }
    const record = byId.get(id)!;
    const started = options.now();
    await store.update(id, { status: "running", startedAt: started.toISOString() });
    const { client, accounting } = meteredClient(llm);
    try {
      const run = await evaluateConversation(client, record, checklist);
      const current = store.file.records[id];
      await store.update(id, {
        status: "succeeded",
        attempts: current.attempts + 1,
        finishedAt: options.now().toISOString(),
        ratings: run.ratings,
        model: run.model,
        usage: accounting.usage,
        latencyMs: Date.now() - started.getTime(),
        error: undefined,
      });
      result.succeeded += 1;
      options.io.out(`${id.padEnd(12)} ok      ${accounting.requests} request(s)`);
    } catch (error) {
      const message = describeError(error);
      const current = store.file.records[id];
      await store.update(id, {
        status: "failed",
        attempts: current.attempts + 1,
        finishedAt: options.now().toISOString(),
        usage: accounting.usage,
        latencyMs: Date.now() - started.getTime(),
        error: message,
        failures: [...current.failures, { at: options.now().toISOString(), error: message }],
      });
      result.failed += 1;
      options.io.err(`${id.padEnd(12)} FAILED  ${message}`);
      if (error instanceof InferenceApiError && (error.isAuthError || error.isBillingError)) {
        fatal = message;
        options.io.err(
          error.isBillingError
            ? "The provider has no remaining credits; no further conversations are started. Top up, then continue with --resume."
            : "The provider rejected the credentials; no further conversations are started.",
        );
      }
    }
  });
  await store.flush();
  return result;
}

export async function main(argv: string[], io: Io, deps: RunDeps = {}): Promise<number> {
  const { options } = parseCli(argv, {
    input: { type: "string" },
    run: { type: "string" },
    resume: { type: "string" },
    "retry-failed": { type: "string" },
    concurrency: { type: "string", default: String(MAX_CONCURRENCY) },
  });
  const modes = [options.run, options.resume, options["retry-failed"]].filter(Boolean);
  if (modes.length !== 1) {
    throw new UsageError(
      "use exactly one of --run <new-run-json>, --resume <run-json>, --retry-failed <run-json>",
    );
  }
  const concurrency = Number(options.concurrency);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > MAX_CONCURRENCY) {
    throw new UsageError(`--concurrency must be an integer from 1 to ${MAX_CONCURRENCY}`);
  }
  const now = deps.now ?? (() => new Date());
  const model = readVar("CQA_MODEL") || DEFAULT_MODEL;
  const settings = currentSettings(model);
  const fingerprint = (deps.fingerprint ?? promptFingerprint)();

  let store: RunStore;
  let records: ConversationRecord[];
  let ids: string[];
  if (options.run) {
    const inputPath = required(options.input, "input");
    if (runFileExists(options.run)) {
      throw new UsageError(
        `${options.run} already exists; use --resume or --retry-failed, or choose a new path`,
      );
    }
    records = loadDataset(inputPath);
    store = new RunStore(
      options.run,
      newRunFile({ path: inputPath, records, settings, fingerprint, now: now() }),
    );
    await store.save();
    ids = store.file.input.ids;
  } else {
    const path = (options.resume ?? options["retry-failed"])!;
    const file = parseRunFile(JSON.parse(readFileSync(path, "utf8")), path);
    const inputPath = options.input ?? file.input.path;
    records = loadDataset(inputPath);
    const issues = continuationIssues(file, {
      records,
      settings,
      promptVersion: fingerprint.promptVersion,
    });
    if (issues.length) {
      throw new UsageError(`${path} cannot be continued: ${issues.join("; ")}. Start a new run.`);
    }
    store = new RunStore(path, file);
    const retry = Boolean(options["retry-failed"]);
    ids = file.input.ids.filter((id) => {
      const status = file.records[id].status;
      return status === "pending" || status === "running" || (retry && status === "failed");
    });
  }

  const total = store.file.input.ids.length;
  if (ids.length === 0) {
    io.out(`Nothing to evaluate: all ${total} conversations are already done.`);
    return Object.values(store.file.records).some((r) => r.status === "failed") ? 1 : 0;
  }

  let llm: LlmClient;
  if (deps.createClient) llm = deps.createClient(model);
  else {
    const apiKey = readVar("HF_TOKEN");
    if (!apiKey)
      throw new UsageError("HF_TOKEN not found in the environment or apps/api/.dev.vars");
    llm = createHfClient({ apiKey, model, temperature: settings.temperature });
  }

  io.out(
    `${ids.length} of ${total} conversation(s) · ${model} · prompt ${fingerprint.promptVersion} · concurrency ${concurrency}`,
  );
  const result = await evaluateRun(store, records, ids, llm, { concurrency, io, now });
  const statuses = Object.values(store.file.records).map((r) => r.status);
  const count = (status: string) => statuses.filter((s) => s === status).length;
  io.out(
    `\n${result.succeeded} ok · ${result.failed} failed · ${result.stopped} not started in this pass` +
      ` · run file: ${count("succeeded")} succeeded, ${count("failed")} failed, ${count("pending") + count("running")} left`,
  );
  io.out(`wrote ${store.path}`);
  return count("failed") + count("pending") + count("running") > 0 ? 1 : 0;
}

if (import.meta.main) runMain((argv, io) => main(argv, io));
