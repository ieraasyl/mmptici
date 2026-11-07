// Batch evaluation of DEV dialogs with the app's own evaluator, for calibration.
//
//   node tools/calibrate/run.ts --set tuning
//   node tools/calibrate/run.ts --set dev --concurrency 6
//   node tools/calibrate/run.ts --set tuning --samples 3 --temperature 0.6
//   node tools/calibrate/run.ts --set heldout --frozen p-1a2b3c4d
//   node tools/calibrate/run.ts --rerun-failed tools/calibrate/runs/<name>.json
//
// Sets: tuning, heldout, all20, dev (all DEV except held-out), all, or comma-separated IDs.
// Reads HF_TOKEN and optional CQA_MODEL from the environment or apps/api/.dev.vars.
// Writes tools/calibrate/runs/<name>.json (git-ignored), the input for compare.py --run.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { defaultChecklist } from "../../apps/api/src/checklist.ts";
import { scoreEvaluation } from "../../apps/api/src/evaluation.ts";
import {
  createHfClient,
  DEFAULT_MODEL,
  evaluateConversation,
  EvaluationError,
} from "../../apps/api/src/inference/index.ts";
import {
  aggregate,
  contentVersion,
  costUsd,
  mapLimit,
  selectIds,
  withRetry,
  type SampleRating,
} from "./run-lib.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));

const { values: args } = parseArgs({
  options: {
    set: { type: "string", default: "tuning" },
    samples: { type: "string", default: "1" },
    temperature: { type: "string" },
    concurrency: { type: "string", default: "4" },
    model: { type: "string" },
    frozen: { type: "string" },
    name: { type: "string" },
    out: { type: "string", default: `${root}tools/calibrate/runs` },
    "rerun-failed": { type: "string" },
  },
});

function readVar(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  const file = `${root}apps/api/.dev.vars`;
  if (!existsSync(file)) return undefined;
  return readFileSync(file, "utf8")
    .match(new RegExp(`^${name}=(.+)$`, "m"))?.[1]
    ?.trim();
}

// --rerun-failed re-evaluates only the dialogs that failed in an earlier run file, with that
// run's settings, and writes the results back into the same file.
type RunFile = {
  promptVersion: string;
  model: string;
  set: string;
  samples: number;
  temperature: number;
  dialogs: { conversationId: string; ratings: unknown[] }[];
};
const rerunPath = args["rerun-failed"];
const prior: RunFile | undefined = rerunPath
  ? JSON.parse(readFileSync(rerunPath, "utf8"))
  : undefined;

const apiKey = readVar("HF_TOKEN");
if (!apiKey) throw new Error("HF_TOKEN not found in the environment or apps/api/.dev.vars");
const model = prior?.model ?? (args.model || readVar("CQA_MODEL") || DEFAULT_MODEL);
const samples = prior?.samples ?? Number(args.samples);
const temperature =
  prior?.temperature ??
  (args.temperature === undefined ? (samples > 1 ? 0.6 : 0) : Number(args.temperature));
const concurrency = Number(args.concurrency);
if (!Number.isInteger(samples) || samples < 1)
  throw new Error("--samples must be a positive integer");

type Record_ = {
  conversation_id: string;
  channel: "agent chat" | "voice call";
  language: "RU" | "KZ" | "EN";
  transcript: {
    timestamp: string;
    speaker: "client" | "operator" | "bot" | "system";
    text: string;
  }[];
};
const records: Record_[] = JSON.parse(readFileSync(`${root}data/invoke.json`, "utf8")).data.records;
const byId = new Map(records.map((r) => [r.conversation_id, r]));
const sets = JSON.parse(readFileSync(`${root}tools/calibrate/labels/sets.json`, "utf8"));

const promptVersion =
  args.frozen ??
  contentVersion(
    readFileSync(`${root}apps/api/src/inference/prompt.ts`, "utf8"),
    readFileSync(`${root}apps/api/src/inference/validate.ts`, "utf8"),
    JSON.stringify(defaultChecklist),
  );
if (prior && prior.promptVersion !== promptVersion) {
  throw new Error(
    `${rerunPath} was made with prompt ${prior.promptVersion}, but the current prompt is ${promptVersion}. Start a new run instead.`,
  );
}
const ids = prior
  ? prior.dialogs.filter((d) => d.ratings.length === 0).map((d) => d.conversationId)
  : selectIds(
      args.set!,
      sets,
      records.map((r) => r.conversation_id),
      args.frozen,
    );
if (ids.length === 0) {
  console.log("Nothing to evaluate.");
  process.exit(0);
}

const llm = createHfClient({ apiKey, model, temperature });
const criterionIds = defaultChecklist.criteria.map((c) => c.id);
let commit = "unknown";
try {
  commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root }).toString().trim();
} catch {
  // Not a git checkout; the prompt version still identifies the run.
}

type SampleResult = {
  ratings: SampleRating[] | null;
  usage: { promptTokens: number; completionTokens: number };
  calls: number;
  errors: string[];
};

async function sample(record: Record_): Promise<SampleResult> {
  try {
    // Six tries with 2 s doubling backoff span about a minute, enough for the router's
    // tokens-per-minute quota to reset.
    const run = await withRetry(() => evaluateConversation(llm, record, defaultChecklist), {
      tries: 6,
      baseMs: 2000,
    });
    return {
      ratings: run.ratings as SampleRating[],
      usage: run.usage,
      calls: run.attempts.length,
      errors: [],
    };
  } catch (error) {
    const attempts = error instanceof EvaluationError ? error.attempts : [];
    return {
      ratings: null,
      usage: { promptTokens: 0, completionTokens: 0 },
      calls: attempts.length,
      errors: attempts.length
        ? attempts.flatMap((a) => a.errors)
        : [error instanceof Error ? error.message : String(error)],
    };
  }
}

console.log(
  `${ids.length} dialog(s) · ${model} · ${samples} sample(s) at T=${temperature} · prompt ${promptVersion}`,
);
const started = Date.now();
const dialogs = await mapLimit(ids, concurrency, async (id) => {
  const record = byId.get(id)!;
  const t0 = Date.now();
  const results = await Promise.all(Array.from({ length: samples }, () => sample(record)));
  const latencyMs = Date.now() - t0;
  const usage = results.reduce(
    (sum, r) => ({
      promptTokens: sum.promptTokens + r.usage.promptTokens,
      completionTokens: sum.completionTokens + r.usage.completionTokens,
    }),
    { promptTokens: 0, completionTokens: 0 },
  );
  const ratings = aggregate(
    results.map((r) => r.ratings),
    criterionIds,
  );
  const scored = ratings ? scoreEvaluation(defaultChecklist, ratings, []) : null;
  const failedSamples = results.filter((r) => r.ratings === null).length;
  console.log(
    `${id.padEnd(10)} ${String(scored?.total ?? "FAILED").padEnd(7)} ${(latencyMs / 1000).toFixed(1)}s` +
      (failedSamples ? ` · ${failedSamples} failed sample(s)` : ""),
  );
  return {
    conversationId: id,
    language: record.language,
    channel: record.channel,
    ratings: ratings ?? [],
    total: scored?.total ?? null,
    seriousViolation: scored?.seriousViolation ?? null,
    run: {
      latencyMs,
      usage,
      costUsd: costUsd(usage),
      failedSamples,
      calls: results.reduce((n, r) => n + r.calls, 0),
      errors: results.flatMap((r) => r.errors),
    },
  };
});

const merged = prior
  ? prior.dialogs.map((d) => dialogs.find((n) => n.conversationId === d.conversationId) ?? d)
  : dialogs;
const name =
  args.name ??
  `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "")}-${promptVersion}-${args.set!.includes(",") ? "ids" : args.set}-s${samples}`;
mkdirSync(args.out!, { recursive: true });
const path = rerunPath ?? `${args.out}/${name}.json`;
writeFileSync(
  path,
  JSON.stringify(
    {
      promptVersion,
      provider: "hf-router",
      model,
      set: prior?.set ?? args.set,
      samples,
      temperature,
      commit,
      createdAt: new Date().toISOString(),
      dialogs: merged,
    },
    null,
    2,
  ),
);

const failed = dialogs.filter((d) => d.total === null && d.ratings.length === 0).length;
const cost = dialogs.reduce((sum, d) => sum + d.run.costUsd, 0);
const meanLatency = dialogs.reduce((sum, d) => sum + d.run.latencyMs, 0) / dialogs.length / 1000;
console.log(
  `\n${dialogs.length - failed}/${dialogs.length} evaluated${prior ? " in this rerun" : ""} · ${failed} failed · $${cost.toFixed(3)} total · ` +
    `${meanLatency.toFixed(1)}s mean per dialog · ${((Date.now() - started) / 1000).toFixed(0)}s wall`,
);
console.log(`wrote ${path}`);
