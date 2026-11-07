// Batch evaluation of DEV dialogs with the app's own evaluator, for calibration.
//
//   vp run calibrate:run --set tuning
//   vp run calibrate:run --set dev --concurrency 6
//   vp run calibrate:run --set tuning --samples 3 --temperature 0.6
//   vp run calibrate:run --set heldout --frozen p-1a2b3c4d
//   vp run calibrate:run --rerun-failed tools/calibrate/runs/<name>.json
//
// Sets: tuning, heldout, all20, dev (all DEV except held-out), all, or comma-separated IDs.
// Held-out dialogs need --frozen with the current prompt version, which every run prints.
// Reads HF_TOKEN and optional CQA_MODEL from the environment or apps/api/.dev.vars.
// Writes tools/calibrate/runs/<name>.json (git-ignored), the input for calibrate:compare --run.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { defaultChecklist } from "../../apps/api/src/checklist.ts";
import {
  createHfClient,
  DEFAULT_MODEL,
  type LlmClient,
} from "../../apps/api/src/inference/index.ts";
import {
  checkPromptVersion,
  contentVersion,
  evaluateDialog,
  mapLimit,
  priorPasses,
  selectIds,
  type BatchRecord,
} from "./run-lib.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));

/** Files whose content determines how a dialog is evaluated, relative to the repo root. */
export const FINGERPRINT_SOURCES = [
  "apps/api/src/inference/prompt.ts",
  "apps/api/src/inference/validate.ts",
  "apps/api/src/inference/evaluate.ts",
  "apps/api/src/inference/client.ts",
  "packages/contracts/src/cqa.ts",
];
// Retry settings: six tries with 2 s doubling backoff span about a minute, enough for the
// router's tokens-per-minute quota to reset.
const RETRY = { tries: 6, baseMs: 2000 };
// evaluateConversation's default: one corrective retry after a reply fails validation.
const MAX_VALIDATION_RETRIES = 1;

const sha = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 12);

/** The prompt version for the current code, and the hashes it was computed from. */
export function promptFingerprint(repoRoot = root) {
  const sources = FINGERPRINT_SOURCES.map((path) => ({
    path,
    text: readFileSync(`${repoRoot}${path}`, "utf8"),
  }));
  const checklist = JSON.stringify(defaultChecklist);
  return {
    promptVersion: contentVersion(
      ...sources.flatMap((s) => [s.path, "\0", s.text, "\0"]),
      "checklist\0",
      checklist,
    ),
    sources: {
      ...Object.fromEntries(sources.map((s) => [s.path, sha(s.text)])),
      defaultChecklist: sha(checklist),
    },
  };
}

type Record_ = BatchRecord & { channel: "agent chat" | "voice call" };
type PriorRun = {
  promptVersion: string;
  model: string;
  set: string;
  samples: number;
  temperature: number;
  dialogs: { conversationId: string; ratings: unknown[]; run?: Record<string, unknown> }[];
};

export type RunDeps = {
  /** Builds the model client; tests pass a fake. */
  createClient?: (options: Parameters<typeof createHfClient>[0]) => LlmClient;
  log?: (line: string) => void;
  retry?: { tries?: number; baseMs?: number };
};

function readVar(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  const file = `${root}apps/api/.dev.vars`;
  if (!existsSync(file)) return undefined;
  return readFileSync(file, "utf8")
    .match(new RegExp(`^${name}=(.+)$`, "m"))?.[1]
    ?.trim();
}

export async function main(argv: string[], deps: RunDeps = {}) {
  const log = deps.log ?? ((line: string) => console.log(line));
  const { values: args } = parseArgs({
    args: argv,
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

  // --rerun-failed re-evaluates only the dialogs that failed in an earlier run file, with that
  // run's settings, and writes the results back into the same file.
  const rerunPath = args["rerun-failed"];
  const prior: PriorRun | undefined = rerunPath
    ? JSON.parse(readFileSync(rerunPath, "utf8"))
    : undefined;

  // Always fingerprint the current code. --frozen is checked against it, never used in its place.
  const fingerprint = promptFingerprint();
  const promptVersion = fingerprint.promptVersion;
  checkPromptVersion(promptVersion, { frozen: args.frozen, prior, priorPath: rerunPath });

  const model = prior?.model ?? (args.model || readVar("CQA_MODEL") || DEFAULT_MODEL);
  const samples = prior?.samples ?? Number(args.samples);
  const temperature =
    prior?.temperature ??
    (args.temperature === undefined ? (samples > 1 ? 0.6 : 0) : Number(args.temperature));
  const concurrency = Number(args.concurrency);
  if (!Number.isInteger(samples) || samples < 1) {
    throw new Error("--samples must be a positive integer");
  }

  const records: Record_[] = JSON.parse(readFileSync(`${root}data/invoke.json`, "utf8")).data
    .records;
  const byId = new Map(records.map((r) => [r.conversation_id, r]));
  const sets = JSON.parse(readFileSync(`${root}tools/calibrate/labels/sets.json`, "utf8"));
  const allIds = records.map((r) => r.conversation_id);
  // The held-out guard applies to reruns as well.
  const ids = prior
    ? selectIds(
        prior.dialogs
          .filter((d) => d.ratings.length === 0)
          .map((d) => d.conversationId)
          .join(","),
        sets,
        allIds,
        args.frozen,
      )
    : selectIds(args.set!, sets, allIds, args.frozen);
  if (ids.length === 0) {
    log("Nothing to evaluate.");
    return 0;
  }

  let llm: LlmClient;
  if (deps.createClient) llm = deps.createClient({ apiKey: "", model, temperature });
  else {
    const apiKey = readVar("HF_TOKEN");
    if (!apiKey) throw new Error("HF_TOKEN not found in the environment or apps/api/.dev.vars");
    llm = createHfClient({ apiKey, model, temperature });
  }
  let commit = "unknown";
  try {
    commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root }).toString().trim();
  } catch {
    // Not a git checkout; the prompt version still identifies the run.
  }

  log(
    `${ids.length} dialog(s) · ${model} · ${samples} sample(s) at T=${temperature} · prompt ${promptVersion}`,
  );
  const priorRuns = new Map(prior?.dialogs.map((d) => [d.conversationId, d.run]) ?? []);
  const started = Date.now();
  const options = {
    llm,
    checklist: defaultChecklist,
    samples,
    retry: deps.retry ?? RETRY,
  };
  const dialogs = await mapLimit(ids, concurrency, async (id) => {
    const dialog = await evaluateDialog(byId.get(id)!, options, priorPasses(priorRuns.get(id)));
    const { failedSamples, latencyMs } = dialog.run;
    log(
      `${id.padEnd(10)} ${String(dialog.total ?? "FAILED").padEnd(7)} ${(latencyMs / 1000).toFixed(1)}s` +
        (failedSamples ? ` · ${failedSamples} failed sample(s)` : ""),
    );
    return dialog;
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
        provenance: {
          sources: fingerprint.sources,
          maxValidationRetries: MAX_VALIDATION_RETRIES,
          retry: options.retry,
          ...(args.frozen ? { frozen: args.frozen } : {}),
        },
        createdAt: new Date().toISOString(),
        dialogs: merged,
      },
      null,
      2,
    ),
  );

  const failed = dialogs.filter((d) => d.total === null && d.ratings.length === 0).length;
  // Cost incurred in this invocation: the latest pass of each dialog evaluated now.
  const latest = dialogs.map((d) => d.run.passes.at(-1)!);
  const cost = latest.reduce((sum, p) => sum + p.costUsd, 0);
  const withoutUsage = latest.reduce((sum, p) => sum + p.responsesWithoutUsage, 0);
  const meanLatency = dialogs.reduce((sum, d) => sum + d.run.latencyMs, 0) / dialogs.length / 1000;
  log(
    `\n${dialogs.length - failed}/${dialogs.length} evaluated${prior ? " in this rerun" : ""} · ${failed} failed · $${cost.toFixed(3)} total` +
      (withoutUsage ? ` (lower bound: ${withoutUsage} response(s) without usage)` : "") +
      ` · ${meanLatency.toFixed(1)}s mean per dialog · ${((Date.now() - started) / 1000).toFixed(0)}s wall`,
  );
  log(`wrote ${path}`);
  return 0;
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
