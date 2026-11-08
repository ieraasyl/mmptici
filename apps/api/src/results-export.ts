import type { Answer, Checklist, Rating } from "@app/contracts";
import { scoreEvaluation } from "./evaluation.ts";

// Builds results.json in the organizers' format 1.0 (CQA_Student_Guide_Appendix_Results.pdf):
// one entry per conversation, the 8 criterion codes in the appendix order, true/false/null or
// the raw scale step, and a status "error" entry for anything that cannot be exported.

/** The header the team submits with every results.json. */
export const RESULTS_HEADER = {
  teamName: "ММ..ПТИЦЫ",
  mode: "local",
  modelName: "Qwen/Qwen3.8-27B",
} as const;

type Header = { teamName: string; mode: "local" | "external_api" | "hybrid"; modelName: string };

/** App criterion id → the appendix criterion_id, in the appendix order. */
export const RESULT_CODES = {
  opening: "contact",
  understanding: "discovery",
  verification: "identification",
  guidance: "consultation",
  empathy: "empathy",
  management: "dialogue",
  closing: "closure",
  violations: "critical",
} as const;

type ResultValue = boolean | number | null;

export type ResultCriterion = {
  criterion_id: string;
  value: ResultValue;
  rationale: string;
  evidence_turns: number[];
};

export type ResultEntry =
  | {
      conversation_id: string;
      status: "ok";
      criteria: ResultCriterion[];
      score: { final_score: number | null; critical_flag: boolean };
    }
  | { conversation_id: string; status: "error"; criteria: []; score: null; error: string };

export type ResultsFile = {
  schema_version: "1.0";
  team_name: string;
  model: { mode: Header["mode"]; name: string };
  results: ResultEntry[];
};

export type ExportItem = {
  /** The organizers' conversation_id. */
  sourceId: string;
  turnCount: number;
  /** The evaluation to export; null when the conversation has none for the chosen checklist. */
  evaluation: { checklist: Checklist; ratings: Rating[]; model: string } | null;
};

function toValue(answer: Answer): ResultValue {
  if (answer === "yes") return true;
  if (answer === "no") return false;
  if (answer === "na") return null;
  return answer;
}

function toEntry(item: ExportItem): ResultEntry {
  const error = (message: string): ResultEntry => ({
    conversation_id: item.sourceId,
    status: "error",
    criteria: [],
    score: null,
    error: message,
  });
  const { evaluation } = item;
  if (!evaluation) return error("Not evaluated with the selected checklist.");
  // Every criterion of the checklist used, in its order. The 8 default criteria get the
  // appendix codes; any other criterion keeps its own id.
  const byId = new Map(evaluation.ratings.map((rating) => [rating.criterionId, rating]));
  const criteria: ResultCriterion[] = [];
  for (const { id } of evaluation.checklist.criteria) {
    const rating = byId.get(id);
    if (!rating) return error(`The stored evaluation has no rating for "${id}".`);
    criteria.push({
      criterion_id: RESULT_CODES[id as keyof typeof RESULT_CODES] ?? id,
      value: toValue(rating.answer),
      rationale: rating.explanation,
      evidence_turns: rating.evidence,
    });
  }
  // Original AI ratings only: appeal decisions never change the submitted file.
  const score = scoreEvaluation(evaluation.checklist, evaluation.ratings, []);
  return {
    conversation_id: item.sourceId,
    status: "ok",
    criteria,
    score: { final_score: score.total, critical_flag: score.seriousViolation },
  };
}

/** Checks the appendix rules that the builder cannot guarantee on its own. */
function findProblems(results: ResultEntry[], items: ExportItem[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const id of results.map((entry) => entry.conversation_id)) {
    if (seen.has(id)) {
      problems.push(
        `Conversation ID "${id}" appears more than once. Select conversations from one dataset.`,
      );
    }
    seen.add(id);
  }
  results.forEach((entry, index) => {
    if (entry.status !== "ok") return;
    const turns = items[index].turnCount;
    for (const criterion of entry.criteria) {
      if (!criterion.evidence_turns.every((turn) => turn >= 1 && turn <= turns)) {
        problems.push(
          `${entry.conversation_id}/${criterion.criterion_id}: evidence outside turns 1–${turns}.`,
        );
      }
    }
  });
  return problems;
}

export function buildResultsFile(
  items: ExportItem[],
  meta: Header = RESULTS_HEADER,
): { file: ResultsFile; problems: string[]; models: Record<string, number> } {
  const results = items.map(toEntry);
  const models: Record<string, number> = {};
  items.forEach((item, index) => {
    if (results[index].status === "ok" && item.evaluation) {
      models[item.evaluation.model] = (models[item.evaluation.model] ?? 0) + 1;
    }
  });
  return {
    file: {
      schema_version: "1.0",
      team_name: meta.teamName,
      model: { mode: meta.mode, name: meta.modelName },
      results,
    },
    problems: findProblems(results, items),
    models,
  };
}
