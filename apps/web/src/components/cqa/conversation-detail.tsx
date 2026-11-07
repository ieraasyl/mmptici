import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "@/components/ui/breadcrumb";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Message, MessageContent, MessageHeader } from "@/components/ui/message";
import { Badge } from "@/components/ui/badge";
import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUpRight01Icon, HeadphonesIcon, SparklesIcon } from "@hugeicons/core-free-icons";
import {
  channelName,
  checklistsQuery,
  conversationQuery,
  conversationsQuery,
  cqa,
  dateLabel,
  dashboardQuery,
  evaluationQuery,
  languageName,
  speakerName,
  type Conversation,
  type EvaluationHistory,
} from "@/lib/cqa";
import { ApiRequestError, request } from "@/lib/request";
import { selectChecklist, useSelectedChecklist } from "@/lib/selected-checklist";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, ErrorMessage, Loading, PageHeading } from "./ui";
import { EvaluationResult } from "./evaluation-result";
import { RecordingPlayer } from "./recording-player";

export function ConversationDetail({
  id,
  selectedEvaluation,
  onSelectEvaluation,
}: {
  id: string;
  selectedEvaluation?: string;
  onSelectEvaluation: (id: string) => void;
}) {
  const query = useQuery(conversationQuery(id));

  return (
    <>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link to="/" />}>Conversations</BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      {query.error && (
        <ErrorMessage
          error={query.error}
          retry={() => {
            void query.refetch();
          }}
        />
      )}
      {query.isPending && <Loading>Loading transcript…</Loading>}
      {query.data && (
        <Detail
          conversation={query.data.conversation}
          history={query.data.evaluations}
          selectedEvaluation={selectedEvaluation}
          onSelectEvaluation={onSelectEvaluation}
        />
      )}
    </>
  );
}

function Detail({
  conversation,
  history,
  selectedEvaluation,
  onSelectEvaluation,
}: {
  conversation: Conversation;
  history: EvaluationHistory;
  selectedEvaluation?: string;
  onSelectEvaluation: (id: string) => void;
}) {
  const selectedChecklist = useSelectedChecklist();
  const pendingRun = useRef<{ id: string; checklistId: string } | null>(null);
  const queryClient = useQueryClient();
  const checklists = useQuery(checklistsQuery);
  const checklistItems =
    checklists.data?.checklists.map(({ id, name, revision }) => ({
      value: id,
      label: `${name} · v${revision}`,
    })) ?? [];
  const checklistId = checklistItems.some(({ value }) => value === selectedChecklist)
    ? selectedChecklist
    : (checklists.data?.defaultId ?? "");
  const evaluationId = selectedEvaluation || history[0]?.id || "";
  const historyItems = history.map(({ id, model, checklistName, revision, createdAt }) => ({
    value: id,
    label: `${model} · ${checklistName} · v${revision} · ${dateLabel(createdAt)}`,
  }));
  if (evaluationId && !historyItems.some(({ value }) => value === evaluationId)) {
    historyItems.unshift({ value: evaluationId, label: "Selected evaluation" });
  }
  const result = useQuery({ ...evaluationQuery(evaluationId), enabled: !!evaluationId });
  const evaluate = useMutation({
    mutationFn: async (input: { id: string; checklistId: string }) => {
      try {
        await request((init) =>
          cqa.conversations[":id"].evaluations.$post(
            {
              param: { id: conversation.id },
              json: input,
            },
            { init },
          ),
        );
      } catch (error) {
        if (!(error instanceof ApiRequestError && error.code === "INVALID_RESPONSE")) throw error;
      }
      return input.id;
    },
    onSuccess: (id) => {
      pendingRun.current = null;
      onSelectEvaluation(id);
      void queryClient.invalidateQueries(conversationQuery(conversation.id));
      void queryClient.invalidateQueries(conversationsQuery);
      void queryClient.invalidateQueries(dashboardQuery);
    },
  });

  function run() {
    if (!checklistId || evaluate.isPending) return;
    if (pendingRun.current?.checklistId !== checklistId) {
      pendingRun.current = { id: crypto.randomUUID(), checklistId };
    }
    evaluate.mutate(pendingRun.current);
  }

  return (
    <>
      <PageHeading
        title={conversation.sourceId}
        actionsClassName="w-full min-w-0 lg:w-auto lg:flex-1 lg:justify-end"
        actions={
          conversation.audioUrl && (
            <>
              <RecordingPlayer
                key={conversation.audioUrl}
                src={cqa.conversations[":id"].recording.$path({ param: { id: conversation.id } })}
              />
              <Button
                variant="outline"
                size="lg"
                nativeButton={false}
                render={
                  <a href={conversation.audioUrl} target="_blank" rel="noopener noreferrer" />
                }
              >
                <HugeiconsIcon icon={HeadphonesIcon} data-icon="inline-start" aria-hidden="true" />{" "}
                Open recording
                <HugeiconsIcon
                  icon={ArrowUpRight01Icon}
                  data-icon="inline-end"
                  aria-hidden="true"
                />
              </Button>
            </>
          )
        }
      >
        {conversation.group} · {languageName[conversation.language]} ·{" "}
        {channelName[conversation.channel]} · {conversation.transcript.length} turns
      </PageHeading>

      <Card>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <Field className="w-full sm:w-72">
                <FieldLabel htmlFor="run-checklist">Checklist for this evaluation</FieldLabel>
                <Select
                  items={checklistItems}
                  value={checklistId || null}
                  disabled={!checklists.data || evaluate.isPending}
                  onValueChange={(value) => selectChecklist(value ?? "")}
                >
                  <SelectTrigger id="run-checklist" className="w-full">
                    <SelectValue
                      placeholder={
                        checklists.isPending ? "Loading checklists…" : "No checklist loaded"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {checklistItems.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Button size="lg" disabled={!checklistId || evaluate.isPending} onClick={run}>
                <HugeiconsIcon icon={SparklesIcon} data-icon="inline-start" aria-hidden="true" />
                {evaluate.isPending ? "Evaluating…" : "Run evaluation"}
              </Button>
            </div>
            <Accordion>
              <AccordionItem value="model">
                <AccordionTrigger>Model and estimated cost</AccordionTrigger>
                <AccordionContent>
                  <p>
                    Qwen3.8 27B on Cerebras through the Hugging Face router. A run makes one model
                    call, plus one retry if the answer fails validation. At $0.99 per million input
                    and $1.49 per million output tokens, a typical chat costs about $0.007 (about
                    1,700 input and 3,800 output tokens, most of them reasoning). Actual cost varies
                    with transcript length.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            {evaluate.isPending && (
              <p className="text-sm text-muted-foreground" role="status">
                Evaluating the transcript against the selected checklist…
              </p>
            )}
            {checklists.error && (
              <ErrorMessage
                error={checklists.error}
                retry={() => {
                  void checklists.refetch();
                }}
              />
            )}
            {evaluate.error && <ErrorMessage error={evaluate.error} />}
          </div>
        </CardContent>
      </Card>

      <div className="grid items-start gap-5 xl:grid-cols-5">
        <Transcript conversation={conversation} />
        <div className="min-w-0 space-y-4 xl:col-span-3">
          {history.length > 0 && (
            <Field>
              <FieldLabel htmlFor="evaluation-history">Evaluation history</FieldLabel>
              <Select
                items={historyItems}
                value={evaluationId}
                onValueChange={(value) => {
                  if (value !== null) onSelectEvaluation(value);
                }}
              >
                <SelectTrigger id="evaluation-history" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {historyItems.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          )}
          {!evaluationId && (
            <Card>
              <EmptyState title="No evaluation yet">
                Select a checklist and run an evaluation to see scores and evidence here.
              </EmptyState>
            </Card>
          )}
          {evaluationId && result.isPending && <Loading>Loading evaluation…</Loading>}
          {result.error && (
            <ErrorMessage
              error={result.error}
              retry={() => {
                void result.refetch();
              }}
            />
          )}
          {result.data?.evaluation.conversationId === conversation.id && (
            <EvaluationResult
              key={result.data.evaluation.id}
              evaluation={result.data.evaluation}
              transcript={conversation.transcript}
            />
          )}
          {result.data && result.data.evaluation.conversationId !== conversation.id && (
            <ErrorMessage
              error={new Error("This evaluation belongs to a different conversation.")}
            />
          )}
        </div>
      </div>
    </>
  );
}

function Transcript({ conversation }: { conversation: Conversation }) {
  const hash = useLocation({ select: (location) => location.hash });
  useEffect(() => {
    const id = hash.replace(/^#/, "");
    if (!/^turn-\d+$/.test(id)) return;
    const target = document.getElementById(id);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "center" });
  }, [hash]);

  return (
    <Card className="xl:sticky xl:top-5 xl:col-span-2">
      <CardHeader>
        <CardTitle>
          <h2>Transcript</h2>
        </CardTitle>
        <CardAction>
          <Badge variant="secondary">{languageName[conversation.language]}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ScrollArea className="**:data-[slot=scroll-area-viewport]:max-h-144">
          <ol aria-label="Transcript turns" className="space-y-3">
            {conversation.transcript.map((turn, index) => (
              <li
                id={`turn-${index + 1}`}
                tabIndex={-1}
                key={index}
                className="scroll-m-5 rounded-lg p-1 target:bg-accent target:ring-1 target:ring-ring"
              >
                <Message align={turn.speaker === "operator" ? "end" : "start"}>
                  <MessageContent>
                    <MessageHeader>
                      <span className="wrap-anywhere tabular-nums">
                        #{index + 1} · {speakerName[turn.speaker]} · {turn.timestamp}
                      </span>
                    </MessageHeader>
                    <Bubble variant={turn.speaker === "operator" ? "default" : "secondary"}>
                      <BubbleContent
                        lang={
                          conversation.language === "KZ"
                            ? "kk"
                            : conversation.language.toLowerCase()
                        }
                      >
                        <p className="wrap-anywhere whitespace-pre-wrap">{turn.text}</p>
                      </BubbleContent>
                    </Bubble>
                  </MessageContent>
                </Message>
              </li>
            ))}
          </ol>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
