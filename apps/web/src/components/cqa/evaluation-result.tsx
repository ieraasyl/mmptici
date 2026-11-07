import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUpRight01Icon, JusticeScale01Icon } from "@hugeicons/core-free-icons";
import { answerLabel, type Turn } from "@app/contracts";
import {
  appealsQuery,
  cqa,
  dashboardQuery,
  evaluationQuery,
  pointLabel,
  scoreLabel,
  type Evaluation,
} from "@/lib/cqa";
import { ApiRequestError, request } from "@/lib/request";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { ErrorMessage } from "./ui";

export function EvaluationResult({
  evaluation,
  transcript,
}: {
  evaluation: Evaluation;
  transcript: Turn[];
}) {
  const [appealFor, setAppealFor] = useState("");
  const [submitted, setSubmitted] = useState<string[]>([]);
  const hasDecisions = evaluation.appeals.some((item) => item.decision);
  const appealByCriterion = new Map(evaluation.appeals.map((item) => [item.criterionId, item]));

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Evaluation score</h2>
          </CardTitle>
          <CardDescription>
            {evaluation.checklist.name} · v{evaluation.checklist.revision}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {evaluation.hasViolationCheck && (
              <Badge variant={evaluation.seriousViolation ? "destructive" : "secondary"}>
                {evaluation.seriousViolation
                  ? "Serious violation flagged"
                  : "No serious violations flagged"}
              </Badge>
            )}
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-4xl font-semibold tracking-tight tabular-nums">
                {scoreLabel(evaluation.total)}
              </span>
              {hasDecisions && (
                <span className="text-sm text-muted-foreground">
                  Original {scoreLabel(evaluation.originalTotal)}
                </span>
              )}
            </div>
            {evaluation.sections.length > 0 && (
              <dl className="divide-y border-t pt-1">
                {evaluation.sections.map(({ name, score }) => (
                  <div className="flex justify-between gap-3 py-2 text-sm" key={name}>
                    <dt className="text-muted-foreground">{name}</dt>
                    <dd className="font-medium tabular-nums">{scoreLabel(score)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Criterion results</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="divide-y">
            {evaluation.criteria.map(
              ({ criterion, original, originalPoints, finalAnswer, finalPoints }, index) => {
                const appeal = appealByCriterion.get(criterion.id);
                return (
                  <li key={criterion.id} className="space-y-3 py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">
                          {String(index + 1).padStart(2, "0")} · {criterion.section}
                        </p>
                        <h3 className="mt-1 text-sm font-semibold wrap-anywhere">
                          {criterion.title}
                        </h3>
                      </div>
                      <Badge
                        variant={
                          criterion.kind === "flag" && finalAnswer === "yes"
                            ? "destructive"
                            : finalAnswer === "na" || finalAnswer === "no"
                              ? "outline"
                              : "secondary"
                        }
                      >
                        {answerLabel(finalAnswer)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {criterion.kind === "flag"
                        ? "Unweighted flag"
                        : `Weight ${pointLabel(criterion.weight)} · ${finalPoints === null ? "Excluded from score" : `${pointLabel(finalPoints)} points`}`}
                    </p>
                    <p className="text-sm/relaxed wrap-anywhere">{original.explanation}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">Evidence</span>
                      {original.evidence.map((turn) => (
                        <Button
                          variant="outline"
                          size="xs"
                          nativeButton={false}
                          render={<a href={`#turn-${turn}`} />}
                          key={turn}
                          aria-label={`Jump to transcript turn ${turn}`}
                          onClick={() =>
                            document.getElementById(`turn-${turn}`)?.focus({ preventScroll: true })
                          }
                        >
                          #{turn} · {transcript[turn - 1]?.timestamp}
                          <HugeiconsIcon
                            icon={ArrowUpRight01Icon}
                            data-icon="inline-end"
                            aria-hidden="true"
                          />
                        </Button>
                      ))}
                    </div>
                    {appeal ? (
                      <div className="space-y-2 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Badge variant={appeal.decision ? "default" : "outline"}>
                            {appeal.decision ? "Appeal resolved" : "Appeal pending"}
                          </Badge>
                          <Link
                            to="/appeals"
                            search={{ appeal: appeal.id }}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            View appeal
                          </Link>
                        </div>
                        <p className="wrap-anywhere">
                          <strong>Appeal</strong> {appeal.comment}
                        </p>
                        {appeal.decision && (
                          <>
                            <p>
                              Original {answerLabel(original.answer)}
                              {originalPoints !== null &&
                                ` (${pointLabel(originalPoints)} points)`}{" "}
                              · Final {answerLabel(finalAnswer)}
                            </p>
                            <p className="wrap-anywhere">
                              <strong>Reviewer’s reason</strong> {appeal.decision.reason}
                            </p>
                          </>
                        )}
                      </div>
                    ) : submitted.includes(criterion.id) ? (
                      <p className="text-sm text-muted-foreground" role="status">
                        Appeal submitted. Reload the evaluation to see it.
                      </p>
                    ) : appealFor === criterion.id ? (
                      <AppealForm
                        evaluationId={evaluation.id}
                        criterionId={criterion.id}
                        onClose={() => setAppealFor("")}
                        onSubmitted={() => {
                          setSubmitted((items) => [...items, criterion.id]);
                          setAppealFor("");
                        }}
                      />
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAppealFor(criterion.id)}
                        aria-label={`Appeal ${criterion.title}`}
                      >
                        <HugeiconsIcon
                          icon={JusticeScale01Icon}
                          data-icon="inline-start"
                          aria-hidden="true"
                        />{" "}
                        Appeal rating
                      </Button>
                    )}
                  </li>
                );
              },
            )}
          </ol>
        </CardContent>
      </Card>
    </>
  );
}

function AppealForm({
  evaluationId,
  criterionId,
  onClose,
  onSubmitted,
}: {
  evaluationId: string;
  criterionId: string;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [comment, setComment] = useState("");
  const client = useQueryClient();
  const submit = useMutation({
    mutationFn: async () => {
      try {
        return await request((init) =>
          cqa.evaluations[":id"].appeals.$post(
            {
              param: { id: evaluationId },
              json: { criterionId, comment: comment.trim() },
            },
            { init },
          ),
        );
      } catch (error) {
        if (!(error instanceof ApiRequestError && error.code === "INVALID_RESPONSE")) throw error;
      }
    },
    onSuccess: async (data) => {
      const query = evaluationQuery(evaluationId);
      await client.cancelQueries(query);
      if (data?.appeal) {
        const appeal = data.appeal;
        client.setQueryData(
          query.queryKey,
          (current) =>
            current && {
              evaluation: {
                ...current.evaluation,
                appeals: [
                  ...current.evaluation.appeals.filter((item) => item.id !== appeal.id),
                  appeal,
                ],
              },
            },
        );
      }
      onSubmitted();
      void client.invalidateQueries(query);
      void client.invalidateQueries(appealsQuery);
      void client.invalidateQueries(dashboardQuery);
    },
  });

  function save(event: FormEvent) {
    event.preventDefault();
    if (!submit.isPending && comment.trim()) submit.mutate();
  }

  return (
    <form className="space-y-3" onSubmit={save}>
      <Field>
        <FieldLabel htmlFor="appeal-comment">Why are you appealing this rating?</FieldLabel>
        <Textarea
          id="appeal-comment"
          value={comment}
          required
          maxLength={2000}
          rows={3}
          disabled={submit.isPending}
          onChange={(event) => setComment(event.target.value)}
        />
      </Field>
      {submit.error && <ErrorMessage error={submit.error} />}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" type="submit" disabled={!comment.trim() || submit.isPending}>
          {submit.isPending ? "Submitting…" : "Submit appeal"}
        </Button>
        <Button
          size="sm"
          type="button"
          variant="outline"
          disabled={submit.isPending}
          onClick={onClose}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
