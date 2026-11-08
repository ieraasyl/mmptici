import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { FileExportIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cqa } from "@/lib/cqa";
import { ApiRequestError, request } from "@/lib/request";

function download(file: unknown) {
  const blob = new Blob([`${JSON.stringify(file, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "results.json";
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Downloads results.json in the organizers' format 1.0 from evaluations already saved in the
 * app (no model calls): each conversation's latest evaluation with the active checklist, with
 * the original AI ratings. Conversations without one are listed with status "error".
 */
export function ResultsExport({
  conversations,
  selected,
  checklistId,
}: {
  conversations: { id: string }[];
  selected: boolean;
  checklistId: string;
}) {
  const [pending, setPending] = useState(false);
  const count = conversations.length;

  async function exportResults() {
    setPending(true);
    try {
      const { file, summary } = await request((init) =>
        cqa.results.export.$post(
          { json: { ids: conversations.map(({ id }) => id), checklistId } },
          { init },
        ),
      );
      download(file);
      toast.add({
        title: `Downloaded results.json with ${file.results.length} ${file.results.length === 1 ? "conversation" : "conversations"}.`,
        description:
          summary.errors > 0
            ? `${summary.errors} not evaluated with this checklist yet, saved as status "error". Evaluate them and export again.`
            : "Save it as results/prod/results.json, then commit and push.",
        type: summary.errors > 0 ? "error" : "success",
        timeout: 10_000,
      });
    } catch (error) {
      toast.add({
        title: "Export failed",
        description: error instanceof ApiRequestError ? error.message : "Try again in a moment.",
        type: "error",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant="outline"
      disabled={!checklistId || count === 0 || pending}
      onClick={() => void exportResults()}
    >
      <HugeiconsIcon icon={FileExportIcon} data-icon="inline-start" aria-hidden="true" />
      {pending ? "Exporting…" : selected ? `Export selected (${count})` : "Export results.json"}
    </Button>
  );
}
