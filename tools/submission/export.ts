// Writes a Results JSON 1.0 file from a finished run file, in the input's order.
//
//   vp run submission:export --input <organizer-json> --run <run-json> --team-name <name> \
//       --dataset dev|prod --out <results-json> [--mode external_api|local|hybrid]
//
// Refuses while any conversation is still pending or running, when the run was made from a
// different input, or when the checklist no longer fits the eight-criterion format. Every
// score is recomputed with the app's scorer, and the file is validated before it is written.

import { readFileSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { scoreEvaluation } from "../../apps/api/src/evaluation.ts";
import {
  buildSubmissionError,
  buildSubmissionResult,
  submissionChecklistIssues,
  submissionModes,
  SUBMISSION_SCHEMA_VERSION,
  type ConversationRecord,
  type SubmissionFile,
} from "../../packages/contracts/src/index.ts";
import { parseCli, required, runMain, UsageError, type Io } from "../calibrate/cli.ts";
import { fingerprintRecords, parseRunFile, type RunFile } from "./run-file.ts";
import { datasetName, parseDataset, report, validateSubmission } from "./validate.ts";

export function buildSubmission(
  file: RunFile,
  records: readonly ConversationRecord[],
  options: { teamName: string; mode: SubmissionFile["model"]["mode"] },
): SubmissionFile {
  const inputFingerprint = fingerprintRecords(records);
  if (file.input.fingerprint !== inputFingerprint) {
    throw new UsageError("the run file was made from a different input dataset");
  }
  const unfinished = file.input.ids.filter((id) =>
    ["pending", "running"].includes(file.records[id].status),
  );
  if (unfinished.length) {
    throw new UsageError(
      `${unfinished.length} conversation(s) are not finished (${unfinished.slice(0, 5).join(", ")}${unfinished.length > 5 ? ", …" : ""}); resume the run first`,
    );
  }
  const checklist = file.checklist.snapshot;
  const issues = submissionChecklistIssues(checklist);
  if (issues.length) {
    throw new UsageError(
      `the run's checklist does not fit the submission format: ${issues.join("; ")}`,
    );
  }
  const models = new Set<string>();
  const results = records.map(({ conversation_id }) => {
    const record = file.records[conversation_id];
    if (record.status === "succeeded") {
      models.add(record.model!);
      const ratings = record.ratings!;
      return buildSubmissionResult({
        conversationId: conversation_id,
        checklist,
        ratings,
        score: scoreEvaluation(checklist, ratings, []),
      });
    }
    return buildSubmissionError(conversation_id, record.error ?? "The evaluation failed.");
  });
  return {
    schema_version: SUBMISSION_SCHEMA_VERSION,
    team_name: options.teamName,
    model: { mode: options.mode, name: [...models].sort().join(", ") || file.model.name },
    results,
  };
}

export async function writeJson(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

export async function main(argv: string[], io: Io): Promise<number> {
  const { options } = parseCli(argv, {
    input: { type: "string" },
    run: { type: "string" },
    "team-name": { type: "string" },
    dataset: { type: "string" },
    out: { type: "string" },
    mode: { type: "string", default: "external_api" },
  });
  const dataset = datasetName(required(options.dataset, "dataset"));
  const teamName = required(options["team-name"], "team-name").trim();
  if (!teamName) throw new UsageError("--team-name must not be empty");
  const mode = options.mode as SubmissionFile["model"]["mode"];
  if (!submissionModes.includes(mode)) {
    throw new UsageError(`--mode must be one of ${submissionModes.join(", ")}`);
  }
  const out = required(options.out, "out");
  const runPath = required(options.run, "run");
  const records = parseDataset(JSON.parse(readFileSync(required(options.input, "input"), "utf8")));
  const file = parseRunFile(JSON.parse(readFileSync(runPath, "utf8")), runPath);

  const submission = buildSubmission(file, records, { teamName, mode });
  const validation = validateSubmission(records, submission, dataset);
  report(validation, dataset, io);
  if (!validation.ok) {
    io.err(`not written: ${out}`);
    return 1;
  }
  await writeJson(out, submission);
  io.out(`wrote ${out}`);
  return 0;
}

if (import.meta.main) runMain(main);
