import type { AppealDecision, Answer, Checklist, Criterion, Rating } from "@app/contracts";

// Scoring for saved evaluations. The model call itself lives in ./inference.

function points(criterion: Criterion, answer: Answer): number | null {
  if (criterion.kind === "flag" || answer === "na") return null;
  if (typeof answer === "number") return (answer / Math.max(...criterion.scale)) * criterion.weight;
  return answer === "yes" ? criterion.weight : 0;
}

function percentage(earned: number, weight: number) {
  return weight === 0 ? null : Math.round((earned / weight) * 10_000) / 100;
}

export function scoreEvaluation(
  checklist: Checklist,
  ratings: Rating[],
  appeals: { criterionId: string; decision: AppealDecision | null }[],
) {
  const decisions = new Map(appeals.map((appeal) => [appeal.criterionId, appeal.decision]));
  const byId = new Map(ratings.map((rating) => [rating.criterionId, rating]));
  const sections = new Map<string, { weight: number; earned: number }>();
  let weight = 0;
  let earned = 0;

  const criteria = checklist.criteria.map((criterion) => {
    const original = byId.get(criterion.id)!;
    const decision = decisions.get(criterion.id);
    const finalAnswer = decision?.answer ?? original.answer;
    const finalPoints = points(criterion, finalAnswer);
    if (criterion.kind !== "flag") {
      const section = sections.get(criterion.section) ?? { weight: 0, earned: 0 };
      if (finalPoints !== null) {
        section.weight += criterion.weight;
        section.earned += finalPoints;
        weight += criterion.weight;
        earned += finalPoints;
      }
      sections.set(criterion.section, section);
    }
    return {
      criterion,
      original,
      originalPoints: points(criterion, original.answer),
      finalAnswer,
      finalPoints,
    };
  });

  return {
    total: percentage(earned, weight),
    seriousViolation: criteria.some(
      ({ criterion, finalAnswer }) => criterion.kind === "flag" && finalAnswer === "yes",
    ),
    hasViolationCheck: criteria.some(({ criterion }) => criterion.kind === "flag"),
    sections: [...sections].map(([name, values]) => ({
      name,
      ...values,
      score: percentage(values.earned, values.weight),
    })),
    criteria,
  };
}
