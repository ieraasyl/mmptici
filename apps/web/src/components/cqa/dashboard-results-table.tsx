import { useMemo, type ReactNode } from "react";
import { useTable, type ColumnDef } from "@tanstack/react-table";
import { Link } from "@tanstack/react-router";
import { DataTable } from "@/components/ui/data-table";
import { dataTableFeatures } from "@/components/ui/data-table-features";
import { channelName, languageName, scoreLabel, type DashboardConversation } from "@/lib/cqa";
import { dashboardFailures } from "@/lib/dashboard";
import { ConversationReview } from "./conversation-review";
import { DashboardEvidence } from "./dashboard-evidence";

type ResultColumn = ColumnDef<typeof dataTableFeatures, DashboardConversation>;

const conversationColumn: ResultColumn = {
  id: "conversation",
  accessorKey: "sourceId",
  header: "Conversation",
  filterFn: "includesString",
  sortFn: "alphanumeric",
  meta: { cellClassName: "wrap-anywhere whitespace-normal" },
  cell: ({ row: { original: item } }) => (
    <>
      <Link
        to="/conversations/$id"
        params={{ id: item.id }}
        search={{ evaluation: item.evaluation?.id }}
        className="font-medium hover:underline"
      >
        {item.sourceId}
      </Link>
      <p className="text-xs text-muted-foreground">
        {item.group} · {languageName[item.language]} · {channelName[item.channel]}
      </p>
    </>
  ),
};

const checklistColumn: ResultColumn = {
  id: "checklist",
  accessorFn: (item) => item.evaluation?.checklistName,
  header: "Checklist",
  sortFn: "text",
  meta: { align: "center", cellClassName: "wrap-anywhere whitespace-normal" },
  cell: ({ row: { original: item } }) => (
    <>
      {item.evaluation?.checklistName}
      <span className="ml-1 text-xs text-muted-foreground">v{item.evaluation?.revision}</span>
    </>
  ),
};

export function DashboardResultsTable({
  conversations,
  criterion,
  mixedChecklists,
  toolbarControls,
  toolbarActions,
}: {
  conversations: DashboardConversation[];
  criterion: string;
  mixedChecklists: boolean;
  toolbarControls: ReactNode;
  toolbarActions?: ReactNode;
}) {
  const columns = useMemo<ResultColumn[]>(() => {
    const columns: ResultColumn[] = [conversationColumn];
    if (mixedChecklists) columns.push(checklistColumn);
    columns.push(
      {
        id: "score",
        accessorFn: (item) => item.evaluation?.total ?? undefined,
        header: "Score",
        sortFn: "basic",
        sortUndefined: "last",
        meta: { align: "center" },
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">
            {scoreLabel(row.original.evaluation?.total ?? null)}
          </span>
        ),
      },
      {
        id: "lost-points",
        accessorFn: (item) =>
          dashboardFailures(item, criterion).filter(({ kind }) => kind !== "flag").length,
        header: "Below full score",
        meta: { align: "center" },
        sortFn: "basic",
        cell: ({ getValue }) => {
          const count = getValue<number>();
          return `${count} ${count === 1 ? "criterion" : "criteria"}`;
        },
      },
      {
        id: "review",
        header: "Review",
        meta: { align: "center", cellClassName: "whitespace-normal" },
        cell: ({ row: { original: item } }) => (
          <ConversationReview
            className="justify-center"
            seriousViolation={item.evaluation?.seriousViolation ?? false}
            pendingAppeals={item.pendingAppeals}
          />
        ),
      },
      {
        id: "evidence",
        header: () => <span className="sr-only">Evidence</span>,
        meta: { align: "right" },
        cell: ({ row }) => <DashboardEvidence conversation={row.original} criterion={criterion} />,
      },
    );
    return columns;
  }, [criterion, mixedChecklists]);
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: conversations,
    getRowId: (item) => item.evaluation?.id ?? item.id,
    sortDescFirst: false,
  });

  return (
    <DataTable
      table={table}
      label="Conversation results"
      filter={{ column: "conversation", label: "Search by ID" }}
      toolbarControls={toolbarControls}
      toolbarActions={toolbarActions}
      tableClassName={mixedChecklists ? "min-w-252 table-fixed" : "min-w-210 table-fixed"}
    />
  );
}
