import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { SparklesIcon, StopIcon } from "@hugeicons/core-free-icons";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { checklistsQuery, conversationsQuery, cqa, dashboardQuery } from "@/lib/cqa";
import { ApiRequestError, request } from "@/lib/request";
import { selectChecklist, useSelectedChecklist } from "@/lib/selected-checklist";

// Calls the model once per conversation, so keep a few runs in flight rather than all at once.
const CONCURRENCY = 3;

type Target = { id: string; sourceId: string; evaluated: boolean };

/** Runs the selected checklist on the conversations currently shown in the library. */
export function BatchEvaluate({ conversations }: { conversations: Target[] }) {
  const queryClient = useQueryClient();
  const checklists = useQuery(checklistsQuery);
  const selected = useSelectedChecklist();
  const [confirm, setConfirm] = useState(false);
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
  const pending = conversations.filter(({ evaluated }) => !evaluated);
  const running = progress !== null;

  async function run(targets: Target[]) {
    setConfirm(false);
    stop.current = false;
    const tally: { done: number; failed: string[]; fatal: Error | null } = {
      done: 0,
      failed: [],
      fatal: null,
    };
    setProgress({ done: 0, total: targets.length });
    const queue = [...targets];

    async function worker() {
      while (queue.length && !stop.current && !tally.fatal) {
        const { id, sourceId } = queue.shift()!;
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
            tally.failed.push(sourceId);
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

    const { done, failed, fatal } = tally;
    const saved = done - failed.length;
    const skipped = targets.length - done;
    const failedList = failed.length
      ? `${failed.length} failed: ${failed.slice(0, 10).join(", ")}${failed.length > 10 ? ", …" : ""}. Run them again.`
      : "";
    toast.add({
      id: "batch-evaluate",
      title: fatal
        ? "Evaluations stopped"
        : `Evaluated ${saved} ${saved === 1 ? "conversation" : "conversations"}.`,
      description:
        [fatal?.message, failedList, skipped > 0 && `${skipped} not started after you stopped.`]
          .filter(Boolean)
          .join(" ") || undefined,
      type: fatal || failed.length ? "error" : "success",
      timeout: failed.length ? 20_000 : 8_000,
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        items={items}
        value={checklistId}
        onValueChange={(value) => selectChecklist(value ?? "")}
        disabled={running}
      >
        <SelectTrigger aria-label="Checklist for evaluation" className="w-64 max-w-full">
          <SelectValue placeholder="Select checklist" />
        </SelectTrigger>
        <SelectContent
          alignItemWithTrigger={false}
          className="w-auto min-w-(--anchor-width) max-w-96"
        >
          <SelectGroup>
            {items.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                <span className="wrap-anywhere whitespace-normal">{label}</span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {running ? (
        <Button variant="outline" onClick={() => (stop.current = true)} aria-live="polite">
          <HugeiconsIcon icon={StopIcon} data-icon="inline-start" aria-hidden="true" />
          Evaluating {progress.done}/{progress.total} · Stop
        </Button>
      ) : (
        <Button
          disabled={!checklistId || conversations.length === 0}
          onClick={() => setConfirm(true)}
        >
          <HugeiconsIcon icon={SparklesIcon} data-icon="inline-start" aria-hidden="true" />
          Run evaluation
        </Button>
      )}
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Run evaluations?</AlertDialogTitle>
            <AlertDialogDescription className="wrap-anywhere">
              Checklist {checklistLabel} on the {conversations.length} conversations shown with the
              current filters. {pending.length} of them have no saved evaluation. Each run calls the
              model, with a repair or retry call when a reply is unusable, and is saved as a new
              live evaluation; earlier evaluations stay in the history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="outline"
              disabled={pending.length === 0}
              onClick={() => void run(pending)}
            >
              Without any saved evaluation ({pending.length})
            </Button>
            <Button type="button" onClick={() => void run(conversations)}>
              All shown ({conversations.length})
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
