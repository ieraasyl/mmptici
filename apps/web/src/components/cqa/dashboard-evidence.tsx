import { Link } from "@tanstack/react-router";
import { answerLabel } from "@app/contracts";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { pointLabel, scoreLabel, speakerName, type DashboardConversation } from "@/lib/cqa";
import { dashboardFailures, failureExplanation } from "@/lib/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type DashboardFailure = NonNullable<DashboardConversation["evaluation"]>["failures"][number];

export function FailureDetails({
  conversation,
  failure,
  headingLevel = 3,
}: {
  conversation: DashboardConversation;
  failure: DashboardFailure;
  headingLevel?: 3 | 4;
}) {
  const { evaluation } = conversation;
  if (!evaluation) return null;
  const explanation = failureExplanation(failure);
  const Heading = headingLevel === 3 ? "h3" : "h4";

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Heading className="font-medium wrap-anywhere">{failure.title}</Heading>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={failure.kind === "flag" ? "destructive" : "outline"}>
            {failure.kind === "flag"
              ? "Serious violation"
              : `Final answer: ${answerLabel(failure.answer)}`}
          </Badge>
          {failure.lost !== null && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {pointLabel(failure.lost)} of {failure.weight} points lost
            </span>
          )}
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{explanation.label}</p>
        <p className="text-sm/relaxed wrap-anywhere">{explanation.text}</p>
      </div>
      {explanation.original && (
        <div className="space-y-1 border-l-2 pl-3">
          <p className="text-xs text-muted-foreground">
            Model's original answer: {answerLabel(explanation.original.answer)}
          </p>
          <p className="text-sm/relaxed text-muted-foreground wrap-anywhere">
            {explanation.original.explanation}
          </p>
        </div>
      )}
      {failure.evidence.length ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Cited by the model</p>
          <ul className="space-y-3">
            {failure.evidence.map(({ number, speaker, text }) => (
              <li key={number} className="space-y-1 border-l-2 pl-3">
                <Link
                  to="/conversations/$id"
                  params={{ id: conversation.id }}
                  search={{ evaluation: evaluation.id }}
                  hash={`turn-${number}`}
                  className="text-xs font-medium underline underline-offset-4"
                  aria-label={`Open transcript turn ${number}: ${speakerName[speaker]}`}
                >
                  #{number} · {speakerName[speaker]}
                </Link>
                <blockquote className="text-sm text-muted-foreground wrap-anywhere whitespace-pre-wrap">
                  {text}
                </blockquote>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">The model cited no transcript turns.</p>
      )}
    </div>
  );
}

export function DashboardEvidence({
  conversation,
  criterion,
}: {
  conversation: DashboardConversation;
  criterion: string;
}) {
  const { evaluation } = conversation;
  if (!evaluation) return null;
  const failures = dashboardFailures(conversation, criterion);

  return (
    <Sheet>
      <SheetTrigger
        render={<Button size="sm" variant="outline" />}
        aria-label={`View evidence for ${conversation.sourceId} in ${conversation.group}`}
      >
        View evidence
      </SheetTrigger>
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>
            <span className="mr-8 block wrap-anywhere">{conversation.sourceId}</span>
          </SheetTitle>
          <SheetDescription>
            {evaluation.checklistName} · v{evaluation.revision} · {scoreLabel(evaluation.total)}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6">
          {failures.length ? (
            <ul className="divide-y">
              {failures.map((failure) => (
                <li key={failure.criterionId} className="py-4 first:pt-0">
                  <FailureDetails conversation={conversation} failure={failure} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-sm text-muted-foreground">
              {criterion ? "No lost points for this criterion." : "No checklist points lost."}
            </p>
          )}
        </div>
        <SheetFooter>
          <Button
            nativeButton={false}
            render={
              <Link
                to="/conversations/$id"
                params={{ id: conversation.id }}
                search={{ evaluation: evaluation.id }}
              />
            }
          >
            Open full evaluation
            <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" aria-hidden="true" />
          </Button>
          {conversation.pendingAppeals > 0 && (
            <Button variant="outline" nativeButton={false} render={<Link to="/appeals" />}>
              Review appeals
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
