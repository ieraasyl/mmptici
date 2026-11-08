import { useRef, useState, type FormEvent, type RefObject } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { answerLabel, answerOptions, type Answer } from "@app/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  appealsQuery,
  cqa,
  dashboardQuery,
  dateLabel,
  evaluationQuery,
  scoreLabel,
  speakerName,
  type Appeal,
} from "@/lib/cqa";
import { ApiRequestError, request } from "@/lib/request";
import { ErrorMessage } from "./ui";

export function AppealReview({
  appeal,
  activeTab,
}: {
  appeal: Appeal;
  activeTab: RefObject<HTMLButtonElement | null>;
}) {
  const { conversation, decision, evaluationId } = appeal;
  const title = useRef<HTMLHeadingElement>(null);

  return (
    <SheetContent
      className="data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
      initialFocus={title}
      finalFocus={() => document.getElementById(appeal.id) ?? activeTab.current}
    >
      <SheetHeader>
        <SheetTitle ref={title} tabIndex={-1} className="mr-10 wrap-anywhere">
          {appeal.criterion.title}
        </SheetTitle>
        <SheetDescription className="mr-10 wrap-anywhere">
          {conversation.sourceId} · {conversation.group}
          <span className="block">Submitted {dateLabel(appeal.createdAt)}</span>
        </SheetDescription>
      </SheetHeader>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 pb-6">
        <section className="space-y-1">
          <h3 className="font-medium">Appeal comment</h3>
          <p className="wrap-anywhere whitespace-pre-wrap">{appeal.comment}</p>
        </section>
        <section className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">Original rating</h3>
            <Badge variant="outline">{answerLabel(appeal.original.answer)}</Badge>
          </div>
          <p className="wrap-anywhere text-muted-foreground">{appeal.original.explanation}</p>
        </section>
        <section className="space-y-2">
          <h3 className="font-medium">Cited transcript turns</h3>
          <ul className="space-y-3">
            {appeal.evidence.map((turn) => (
              <li key={turn.number} className="space-y-1 border-l-2 pl-3">
                <Link
                  to="/conversations/$id"
                  params={{ id: conversation.id }}
                  search={{ evaluation: evaluationId }}
                  hash={`turn-${turn.number}`}
                  className="text-xs font-medium underline underline-offset-4"
                >
                  #{turn.number} · {speakerName[turn.speaker]} · {turn.timestamp}
                </Link>
                <blockquote className="wrap-anywhere whitespace-pre-wrap text-muted-foreground">
                  {turn.text}
                </blockquote>
              </li>
            ))}
          </ul>
        </section>
        {decision ? (
          <section className="space-y-2 border-t pt-5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-medium">Final rating</h3>
              <Badge>{answerLabel(decision.answer)}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {decision.answer === appeal.original.answer
                ? "Original rating confirmed"
                : "Rating changed"}
              {appeal.decidedAt && ` · ${dateLabel(appeal.decidedAt)}`}
            </p>
            <p className="text-xs text-muted-foreground">
              Conversation score {scoreLabel(appeal.score.original)} →{" "}
              {scoreLabel(appeal.score.final)}
              {appeal.score.violationOriginal !== appeal.score.violationFinal &&
                (appeal.score.violationFinal
                  ? " · serious violation added"
                  : " · serious violation removed")}
            </p>
            <p className="wrap-anywhere whitespace-pre-wrap">{decision.reason}</p>
          </section>
        ) : (
          <div className="border-t pt-5">
            <DecisionForm appeal={appeal} />
          </div>
        )}
      </div>
      <SheetFooter>
        <Button
          variant="outline"
          nativeButton={false}
          render={
            <Link
              to="/conversations/$id"
              params={{ id: conversation.id }}
              search={{ evaluation: evaluationId }}
            />
          }
        >
          Open full evaluation
          <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" aria-hidden="true" />
        </Button>
      </SheetFooter>
    </SheetContent>
  );
}

function DecisionForm({ appeal }: { appeal: Appeal }) {
  const client = useQueryClient();
  const [answer, setAnswer] = useState<Answer>(appeal.original.answer);
  const [reason, setReason] = useState("");
  const options = answerOptions(appeal.criterion).map((value) => ({
    value,
    label: `${answerLabel(value)}${value === appeal.original.answer ? " (confirm original)" : ""}`,
  }));
  const save = useMutation({
    mutationFn: async (decision: { answer: Answer; reason: string }) => {
      try {
        return await request((init) =>
          cqa.appeals[":id"].decision.$put(
            {
              param: { id: appeal.id },
              json: decision,
            },
            { init },
          ),
        );
      } catch (error) {
        if (error instanceof ApiRequestError && error.code === "INVALID_RESPONSE") return undefined;
        throw error;
      }
    },
    onSuccess: async (data, submitted) => {
      await client.cancelQueries(appealsQuery);
      const decision = data?.decision ?? submitted;
      client.setQueryData(
        appealsQuery.queryKey,
        (current) =>
          current && {
            appeals: current.appeals.map((item) =>
              item.id === appeal.id
                ? { ...item, decision, decidedAt: data?.decidedAt ?? null }
                : item,
            ),
          },
      );
      void client.invalidateQueries(appealsQuery);
      void client.invalidateQueries(evaluationQuery(appeal.evaluationId));
      void client.invalidateQueries(dashboardQuery);
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!save.isPending && reason.trim()) save.mutate({ answer, reason: reason.trim() });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h3 className="font-medium">Decide appeal</h3>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`answer-${appeal.id}`}>Final rating</FieldLabel>
          <Select<Answer>
            items={options}
            disabled={save.isPending}
            value={answer}
            onValueChange={(value) => {
              if (value !== null) setAnswer(value);
            }}
          >
            <SelectTrigger id={`answer-${appeal.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {options.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor={`reason-${appeal.id}`}>Reason for decision</FieldLabel>
          <Textarea
            id={`reason-${appeal.id}`}
            required
            maxLength={2000}
            rows={3}
            disabled={save.isPending}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
      </FieldGroup>
      {save.error && <ErrorMessage error={save.error} />}
      <Button type="submit" disabled={save.isPending || !reason.trim()}>
        {save.isPending ? "Saving…" : "Save decision"}
      </Button>
    </form>
  );
}
