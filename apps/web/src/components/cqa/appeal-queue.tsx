import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { answerLabel, answerOptions, type Answer } from "@app/contracts";
import {
  appealsQuery,
  cqa,
  dashboardQuery,
  dateLabel,
  evaluationQuery,
  speakerName,
  type Appeal,
} from "@/lib/cqa";
import { ApiRequestError, request } from "@/lib/request";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, ErrorMessage, Loading, PageHeading } from "./ui";

export function AppealQueue() {
  const query = useQuery(appealsQuery);
  const [filter, setFilter] = useState<"pending" | "resolved">("pending");
  const pending = query.data?.appeals.filter((item) => !item.decision) ?? [];
  const resolved = query.data?.appeals.filter((item) => item.decision) ?? [];

  return (
    <>
      <PageHeading title="Appeals">
        Review disputed ratings against the cited transcript turns.
      </PageHeading>
      {query.error && (
        <ErrorMessage
          error={query.error}
          retry={() => {
            void query.refetch();
          }}
        />
      )}
      {query.isPending && <Loading>Loading appeals…</Loading>}
      {query.data && (
        <Tabs
          value={filter}
          onValueChange={(value) => setFilter(value === "resolved" ? "resolved" : "pending")}
        >
          <TabsList aria-label="Appeal status">
            <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
            <TabsTrigger value="resolved">Resolved ({resolved.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="pending">
            <div className="space-y-4">
              {pending.length === 0 && (
                <EmptyState title="No pending appeals">
                  Appeals submitted from a conversation’s evaluation appear here.
                </EmptyState>
              )}
              {pending.map((appeal) => (
                <AppealCard
                  key={appeal.id}
                  appeal={appeal}
                  onDecided={() => setFilter("resolved")}
                />
              ))}
            </div>
          </TabsContent>
          <TabsContent value="resolved">
            <div className="space-y-4">
              {resolved.length === 0 && (
                <EmptyState title="No resolved appeals">
                  Appeals appear here after a reviewer saves a decision.
                </EmptyState>
              )}
              {resolved.map((appeal) => (
                <AppealCard key={appeal.id} appeal={appeal} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </>
  );
}

function AppealCard({ appeal, onDecided }: { appeal: Appeal; onDecided?: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="wrap-anywhere">{appeal.criterion.title}</h2>
        </CardTitle>
        <CardDescription>
          <Link
            to="/conversations/$id"
            params={{ id: appeal.conversation.id }}
            search={{ evaluation: appeal.evaluationId }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            {appeal.conversation.sourceId}
            <HugeiconsIcon icon={ArrowUpRight01Icon} size={13} aria-hidden="true" />
          </Link>
          <span className="block">Submitted {dateLabel(appeal.createdAt)}</span>
        </CardDescription>
        <CardAction>
          <Badge variant={appeal.decision ? "secondary" : "outline"}>
            {appeal.decision ? "Resolved" : "Pending review"}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="min-w-0 space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Appeal comment</h3>
              <p className="text-sm wrap-anywhere whitespace-pre-wrap">{appeal.comment}</p>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">
                Original rating <Badge>{answerLabel(appeal.original.answer)}</Badge>
              </h3>
              <p className="text-sm wrap-anywhere text-muted-foreground">
                {appeal.original.explanation}
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Cited transcript turns</h3>
              {appeal.evidence.map((turn) => (
                <blockquote key={turn.number} className="rounded-md border p-3">
                  <Link
                    to="/conversations/$id"
                    params={{ id: appeal.conversation.id }}
                    search={{ evaluation: appeal.evaluationId }}
                    hash={`turn-${turn.number}`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    #{turn.number} · {speakerName[turn.speaker]} · {turn.timestamp}
                  </Link>
                  <p className="mt-1 text-sm wrap-anywhere whitespace-pre-wrap">{turn.text}</p>
                </blockquote>
              ))}
            </div>
          </div>
          {appeal.decision ? (
            <div className="space-y-3">
              <h3 className="font-semibold">Reviewer decision</h3>
              <p className="text-sm">
                {appeal.decision.answer === appeal.original.answer
                  ? "Confirmed original rating"
                  : "Changed rating"}{" "}
                · {answerLabel(appeal.decision.answer)}
              </p>
              <p className="text-sm wrap-anywhere whitespace-pre-wrap">{appeal.decision.reason}</p>
              {appeal.decidedAt && (
                <p className="text-xs text-muted-foreground">{dateLabel(appeal.decidedAt)}</p>
              )}
            </div>
          ) : (
            <DecisionForm appeal={appeal} onDecided={onDecided} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DecisionForm({ appeal, onDecided }: { appeal: Appeal; onDecided?: () => void }) {
  const client = useQueryClient();
  const [answer, setAnswer] = useState<Answer>(appeal.original.answer);
  const [reason, setReason] = useState("");
  const options = answerOptions(appeal.criterion);
  const save = useMutation({
    mutationFn: async () => {
      try {
        return await request((init) =>
          cqa.appeals[":id"].decision.$put(
            {
              param: { id: appeal.id },
              json: { answer, reason: reason.trim() },
            },
            { init },
          ),
        );
      } catch (error) {
        if (error instanceof ApiRequestError && error.code === "INVALID_RESPONSE") return undefined;
        throw error;
      }
    },
    onSuccess: async (data) => {
      await client.cancelQueries(appealsQuery);
      const decision = data?.decision ?? { answer, reason: reason.trim() };
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
      onDecided?.();
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!save.isPending && reason.trim()) save.mutate();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h3 className="font-semibold">Decide appeal</h3>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`answer-${appeal.id}`}>Final rating</FieldLabel>
          <NativeSelect
            id={`answer-${appeal.id}`}
            disabled={save.isPending}
            value={String(answer)}
            onChange={(event) => {
              const selected = options.find((option) => String(option) === event.target.value);
              if (selected !== undefined) setAnswer(selected);
            }}
          >
            {options.map((option) => (
              <NativeSelectOption key={option} value={String(option)}>
                {answerLabel(option)}
                {option === appeal.original.answer ? " (confirm original)" : ""}
              </NativeSelectOption>
            ))}
          </NativeSelect>
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
