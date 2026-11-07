import { useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { SparklesIcon, StopIcon } from "@hugeicons/core-free-icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { toast } from "@/components/ui/toast";
import {
  checklistsQuery,
  conversationQuery,
  conversationsQuery,
  cqa,
  dashboardQuery,
} from "@/lib/cqa";
import { ApiRequestError, request } from "@/lib/request";
import { selectChecklist, useSelectedChecklist } from "@/lib/selected-checklist";

// Calls the model once per conversation, so keep a few runs in flight rather than all at once.
const CONCURRENCY = 3;

type Target = { id: string; evaluated: boolean };

export function BatchEvaluate({
  conversations,
  onClearSelection,
  children,
}: {
  conversations: Target[];
  onClearSelection?: () => void;
  children: (checklist: ReactNode, actions: ReactNode) => ReactNode;
}) {
  const queryClient = useQueryClient();
  const checklists = useQuery(checklistsQuery);
  const selected = useSelectedChecklist();
  const [confirmation, setConfirmation] = useState<{
    targets: Target[];
    checklistId: string;
    checklistLabel: string;
    selected: boolean;
  } | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const stop = useRef(false);

  const items =
    checklists.data?.checklists.map(({ id, name, revision }) => ({
      value: id,
      label: `${name} · v${revision}`,
    })) ?? [];
  const checklistId = items.some(({ value }) => value === selected)
    ? selected
    : (checklists.data?.defaultId ?? "");
  const checklistLabel = items.find(({ value }) => value === checklistId)?.label ?? "";
  const pending = confirmation?.targets.filter(({ evaluated }) => !evaluated) ?? [];
  const running = progress !== null;

  async function run(targets: Target[], checklistId: string) {
    setConfirmation(null);
    stop.current = false;
    const tally: { done: number; failed: number; fatal: Error | null } = {
      done: 0,
      failed: 0,
      fatal: null,
    };
    setProgress({ done: 0, total: targets.length });
    const queue = [...targets];

    async function worker() {
      while (queue.length && !stop.current && !tally.fatal) {
        const { id } = queue.shift()!;
        try {
          await request((init) =>
            cqa.conversations[":id"].evaluations.$post(
              { param: { id }, json: { id: crypto.randomUUID(), checklistId } },
              { init },
            ),
          );
        } catch (error) {
          // A malformed response after a confirmed write still counts as a saved run.
          if (!(error instanceof ApiRequestError && error.code === "INVALID_RESPONSE")) {
            tally.failed += 1;
            // A missing or rejected token fails every run the same way, so stop early.
            if (error instanceof ApiRequestError && error.code === "AI_UNAVAILABLE")
              tally.fatal = error;
          }
        }
        tally.done += 1;
        setProgress({ done: tally.done, total: targets.length });
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));
    setProgress(null);
    void queryClient.invalidateQueries(conversationsQuery);
    void queryClient.invalidateQueries(dashboardQuery);
    for (const { id } of targets) {
      void queryClient.invalidateQueries(conversationQuery(id));
    }

    const { done, failed, fatal } = tally;
    const saved = done - failed;
    const skipped = targets.length - done;
    toast.add({
      id: "batch-evaluate",
      title: fatal
        ? "Evaluations stopped"
        : `Evaluated ${saved} ${saved === 1 ? "conversation" : "conversations"}.`,
      description:
        fatal?.message ??
        ([
          failed > 0 && `${failed} failed; try them again.`,
          skipped > 0 && `${skipped} not started after you stopped.`,
        ]
          .filter(Boolean)
          .join(" ") ||
          undefined),
      type: fatal || failed ? "error" : "success",
      timeout: 8_000,
    });
  }

  return children(
    <Field className="w-auto min-w-0 max-w-full sm:max-w-80">
      <FieldLabel htmlFor="batch-checklist">Checklist</FieldLabel>
      <Select
        items={items}
        value={checklistId}
        onValueChange={(value) => selectChecklist(value ?? "")}
        disabled={running}
      >
        <SelectTrigger id="batch-checklist" title={checklistLabel || undefined}>
          <SelectValue placeholder="Select checklist" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {items.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>,
    <AlertDialog
      open={confirmation !== null}
      onOpenChange={(open) => {
        setConfirmation(
          open
            ? {
                targets: conversations,
                checklistId,
                checklistLabel,
                selected: Boolean(onClearSelection),
              }
            : null,
        );
      }}
    >
      {running ? (
        <Button variant="outline" onClick={() => (stop.current = true)} aria-live="polite">
          <HugeiconsIcon icon={StopIcon} data-icon="inline-start" aria-hidden="true" />
          Evaluating {progress.done}/{progress.total} · Stop
        </Button>
      ) : (
        <AlertDialogTrigger
          render={<Button />}
          disabled={!checklistId || conversations.length === 0}
        >
          <HugeiconsIcon icon={SparklesIcon} data-icon="inline-start" aria-hidden="true" />
          {onClearSelection ? `Evaluate selected (${conversations.length})` : "Run evaluation"}
        </AlertDialogTrigger>
      )}
      {onClearSelection && (
        <Button variant="ghost" onClick={onClearSelection}>
          Clear selection
        </Button>
      )}
      {confirmation && (
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Run evaluations?</AlertDialogTitle>
            <AlertDialogDescription className="wrap-anywhere">
              Run {confirmation.checklistLabel} on {confirmation.targets.length}{" "}
              {confirmation.selected ? "selected" : "matching"}{" "}
              {confirmation.targets.length === 1 ? "conversation" : "conversations"}. Each run calls
              the model once and saves a new evaluation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="outline"
              disabled={pending.length === 0}
              onClick={() => void run(pending, confirmation.checklistId)}
            >
              Only not evaluated ({pending.length})
            </AlertDialogAction>
            <AlertDialogAction
              type="button"
              onClick={() => void run(confirmation.targets, confirmation.checklistId)}
            >
              {confirmation.selected ? "All selected" : "All matches"} (
              {confirmation.targets.length})
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>,
  );
}
