import {
  answerOptions,
  type Answer,
  type Checklist,
  type Criterion,
  type Rating,
} from "@app/contracts";

// Checks the model's JSON against the checklist before it is saved.
// errors   → the reply can't be used; they are sent back to the model for a retry.
// warnings → fixed automatically (e.g. evidence trimmed to 5 turns).

export type ValidationResult = {
  ratings: Rating[];
  errors: string[];
  warnings: string[];
};

const MAX_EVIDENCE = 5;
const MAX_EXPLANATION = 1500;

const aliases: Record<string, "yes" | "no" | "na"> = {
  yes: "yes",
  да: "yes",
  иә: "yes",
  no: "no",
  нет: "no",
  жоқ: "no",
  na: "na",
  "n/a": "na",
  "not applicable": "na",
};

/** Pulls the JSON object out of a reply that may include <think> blocks or ```json fences. */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("The reply contains no JSON object.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function normalizeAnswer(criterion: Criterion, raw: unknown): Answer | undefined {
  if (typeof raw !== "string" && typeof raw !== "number") return undefined;
  const text = String(raw).trim().toLowerCase();
  const alias = aliases[text];
  if (criterion.kind === "numeric") {
    if (alias === "na") return "na";
    const value = Number(text);
    return text !== "" && Number.isFinite(value) ? value : undefined;
  }
  return alias;
}

export function validateRatings(
  value: unknown,
  checklist: Checklist,
  turnCount: number,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ratings: Rating[] = [];

  const raw = (value as { ratings?: unknown } | null)?.ratings;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ratings, errors: ['The top-level "ratings" object is missing.'], warnings };
  }
  const byId = raw as Record<string, Record<string, unknown> | undefined>;

  const known = new Set(checklist.criteria.map(({ id }) => id));
  for (const id of Object.keys(byId)) {
    if (!known.has(id))
      errors.push(`Unknown criterionId "${id}". Use only: ${[...known].join(", ")}.`);
  }

  for (const criterion of checklist.criteria) {
    const id = criterion.id;
    const item = byId[id];
    if (!item || typeof item !== "object") {
      errors.push(`${id}: missing. Rate every criterion.`);
      continue;
    }

    const allowed = answerOptions(criterion);
    const answer = normalizeAnswer(criterion, item.answer);
    if (answer === undefined || !allowed.includes(answer)) {
      const why =
        answer === "na" ? "N/A is not allowed for this criterion" : "not an allowed answer";
      errors.push(
        `${id}: answer "${String(item.answer)}" is ${why}. Allowed: ${allowed.join(", ")}.`,
      );
      continue;
    }

    let explanation = typeof item.explanation === "string" ? item.explanation.trim() : "";
    if (!explanation) {
      errors.push(`${id}: the explanation is empty. Explain the rating in one or two sentences.`);
      continue;
    }
    if (explanation.length > MAX_EXPLANATION) {
      explanation = `${explanation.slice(0, MAX_EXPLANATION - 1)}…`;
      warnings.push(`${id}: explanation shortened.`);
    }

    const cited = Array.isArray(item.evidence) ? item.evidence.map(Number) : [];
    const valid = cited.filter((turn) => Number.isInteger(turn) && turn >= 1 && turn <= turnCount);
    if (valid.length < cited.length)
      warnings.push(`${id}: dropped turn numbers outside 1–${turnCount}.`);
    let evidence = [...new Set(valid)].sort((a, b) => a - b);
    if (evidence.length > MAX_EVIDENCE) {
      evidence = evidence.slice(0, MAX_EVIDENCE);
      warnings.push(`${id}: kept the first ${MAX_EVIDENCE} evidence turns.`);
    }
    if (evidence.length === 0) {
      errors.push(`${id}: no valid evidence. Cite 1 to 5 turn numbers between 1 and ${turnCount}.`);
      continue;
    }

    ratings.push({ criterionId: id, answer, explanation, evidence });
  }

  return { ratings, errors, warnings };
}
