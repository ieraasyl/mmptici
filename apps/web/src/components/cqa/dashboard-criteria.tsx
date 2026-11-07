import { useMemo } from "react";
import { useTable, type ColumnDef } from "@tanstack/react-table";
import { pointLabel } from "@/lib/cqa";
import type { dashboardView } from "@/lib/dashboard";
import { DataTable } from "@/components/ui/data-table";
import { dataTableFeatures } from "@/components/ui/data-table-features";

type CriterionRow = ReturnType<typeof dashboardView>["breakdown"][number];
type CriterionColumn = ColumnDef<typeof dataTableFeatures, CriterionRow>;

export function DashboardCriteria({
  rows,
  mixedChecklists,
}: {
  rows: CriterionRow[];
  mixedChecklists: boolean;
}) {
  const columns = useMemo<CriterionColumn[]>(() => {
    const criterion: CriterionColumn = {
      id: "criterion",
      accessorKey: "title",
      header: "Criterion",
      sortFn: "text",
      meta: { cellClassName: "wrap-anywhere whitespace-normal" },
      cell: ({ row: { original: row } }) => (
        <>
          <span className="font-medium">{row.title}</span>
          {mixedChecklists && (
            <p className="mt-1 text-xs text-muted-foreground">{row.checklistLabel}</p>
          )}
        </>
      ),
    };

    return [
      criterion,
      {
        id: "average",
        accessorFn: (row) => row.average ?? undefined,
        header: "Avg score",
        sortFn: "basic",
        sortUndefined: "last",
        meta: { align: "right" },
        cell: ({ row: { original: row } }) =>
          row.average === null ? (
            <span className="text-muted-foreground">N/A</span>
          ) : (
            <span className="font-medium tabular-nums">{pointLabel(row.average)}%</span>
          ),
      },
      {
        id: "below-full-score",
        accessorFn: (row) => row.belowFullScoreRate ?? undefined,
        header: "Below full score",
        sortFn: "basic",
        sortUndefined: "last",
        meta: { align: "right" },
        cell: ({ row: { original: row } }) => (
          <div className="tabular-nums">
            {row.applied ? (
              <>
                <span className="font-medium">
                  {row.belowFullScore} / {row.applied}
                </span>
                <span className="block text-xs text-muted-foreground sm:ml-1 sm:inline">
                  ({Math.round(row.belowFullScoreRate ?? 0)}%)
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">N/A</span>
            )}
            {row.na > 0 && (
              <span className="block text-xs text-muted-foreground">{row.na} marked N/A</span>
            )}
          </div>
        ),
      },
    ];
  }, [mixedChecklists]);
  const performanceTable = useTable({
    features: dataTableFeatures,
    columns,
    data: rows,
    getRowId: (row) => row.key,
    sortDescFirst: false,
  });

  return (
    <section className="min-w-0 space-y-3 xl:col-span-8" aria-labelledby="criterion-heading">
      <div className="space-y-1">
        <h2 id="criterion-heading" className="text-base font-medium">
          Checklist performance
        </h2>
      </div>
      {rows.length ? (
        <>
          <DataTable table={performanceTable} label="Checklist performance" />
          <p className="text-xs text-muted-foreground">
            Scores and rates exclude conversations marked N/A for each criterion.
          </p>
        </>
      ) : (
        <p className="py-8 text-sm text-muted-foreground">No scored criteria in this selection.</p>
      )}
    </section>
  );
}
