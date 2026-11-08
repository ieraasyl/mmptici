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

export function ResultsExport() {
  const [pending, setPending] = useState(false);

  async function exportResults() {
    setPending(true);
    try {
      const { file, summary } = await request((init) => cqa.results.export.$post({}, { init }));
      download(file);
      toast.add({
        title: `Downloaded results.json for ${file.results.length} FBroker chats.`,
        description:
          summary.errors > 0
            ? `Chats without a main checklist evaluation were exported as errors (${summary.errors}).`
            : "Submission path is results/prod/results.json.",
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
    <Button variant="outline" disabled={pending} onClick={() => void exportResults()}>
      <HugeiconsIcon icon={FileExportIcon} data-icon="inline-start" aria-hidden="true" />
      {pending ? "Exporting…" : "Export results.json"}
    </Button>
  );
}
