// Evaluate one DEV dialog from data/invoke.json with the app's default checklist,
// using the same evaluator code the app runs.
//
//   node apps/api/scripts/evaluate-one.ts [conversation_id | index]          → print the prompt only
//   node apps/api/scripts/evaluate-one.ts [conversation_id | index] --call   → call the model and score
//
// Reads HF_TOKEN (and optional CQA_MODEL) from the environment or apps/api/.dev.vars.

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ConversationRecord } from "@app/contracts";
import { defaultChecklist } from "../src/checklist.ts";
import { scoreEvaluation } from "../src/evaluation.ts";
import {
  buildPrompt,
  createHfClient,
  evaluateConversation,
  EvaluationError,
} from "../src/inference/index.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const args = process.argv.slice(2);
const call = args.includes("--call");
const pick = args.find((a) => !a.startsWith("--")) ?? "0";

const records: ConversationRecord[] = JSON.parse(readFileSync(`${root}data/invoke.json`, "utf8"))
  .data.records;
const record = /^\d+$/.test(pick)
  ? records[Number(pick)]
  : records.find((r) => r.conversation_id === pick);
if (!record) throw new Error(`Dialog "${pick}" not found in data/invoke.json`);

if (!call) {
  for (const m of buildPrompt(record, defaultChecklist)) {
    console.log(`===== ${m.role.toUpperCase()} =====\n${m.content}\n`);
  }
  process.exit(0);
}

function readVar(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  const file = `${root}apps/api/.dev.vars`;
  if (!existsSync(file)) return undefined;
  return readFileSync(file, "utf8")
    .match(new RegExp(`^${name}=(.+)$`, "m"))?.[1]
    .trim();
}

const apiKey = readVar("HF_TOKEN");
if (!apiKey) throw new Error("HF_TOKEN not found in the environment or apps/api/.dev.vars");
const llm = createHfClient({ apiKey, model: readVar("CQA_MODEL") });

const started = Date.now();
let run;
try {
  run = await evaluateConversation(llm, record, defaultChecklist);
} catch (cause) {
  if (cause instanceof EvaluationError) {
    cause.attempts.forEach((a, i) =>
      console.log(`--- attempt ${i + 1}\n${a.raw}\nErrors: ${a.errors.join("; ")}`),
    );
  }
  throw cause;
}
const seconds = ((Date.now() - started) / 1000).toFixed(1);

run.attempts.forEach((a, i) => {
  if (a.errors.length) console.log(`Attempt ${i + 1} errors:\n- ${a.errors.join("\n- ")}\n`);
  if (a.warnings.length) console.log(`Attempt ${i + 1} warnings:\n- ${a.warnings.join("\n- ")}\n`);
});

const score = scoreEvaluation(defaultChecklist, run.ratings, []);
const cost = (run.usage.promptTokens * 0.99 + run.usage.completionTokens * 1.49) / 1e6;
console.log(
  `===== ${record.conversation_id} · ${run.model} · ${seconds}s · ${run.attempts.length} call(s) =====`,
);
console.log(
  `tokens: ${run.usage.promptTokens} in / ${run.usage.completionTokens} out · ≈ $${cost.toFixed(4)}`,
);
for (const { criterion, original, finalPoints } of score.criteria) {
  const pts =
    criterion.kind === "flag"
      ? "flag"
      : finalPoints === null
        ? "N/A"
        : `${+finalPoints.toFixed(2)}/${criterion.weight}`;
  console.log(
    `${criterion.id.padEnd(14)} ${String(original.answer).padEnd(4)} ${pts.padEnd(9)} ${original.explanation} [${original.evidence.join(", ")}]`,
  );
}
console.log(
  `\nTOTAL: ${score.total ?? "—"}   serious violation: ${score.seriousViolation ? "YES" : "no"}`,
);
for (const s of score.sections) console.log(`  ${s.name}: ${s.score ?? "N/A"}`);
