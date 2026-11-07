import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTable, type ColumnDef } from "@tanstack/react-table";
import { answerLabel } from "@app/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { dataTableFeatures } from "@/components/ui/data-table-features";
import { Sheet, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { appealsQuery, dateLabel, type Appeal } from "@/lib/cqa";
import { AppealReview } from "./appeal-review";
import { EmptyState, ErrorMessage, Loading, PageHeading } from "./ui";

type AppealColumn = ColumnDef<typeof dataTableFeatures, Appeal>;

const columns: AppealColumn[] = [
  {
    id: "appeal",
    accessorFn: ({ conversation, criterion }) => `${conversation.sourceId} ${criterion.title}`,
    header: "Appeal",
    filterFn: "includesString",
    enableSorting: false,
    meta: { cellClassName: "wrap-anywhere whitespace-normal" },
    cell: ({ row: { original: appeal } }) => (
      <>
        <div className="font-medium">{appeal.criterion.title}</div>
        <div className="text-xs text-muted-foreground">
          {appeal.conversation.sourceId} · {appeal.conversation.group}
        </div>
        <div className="mt-1 sm:hidden">
          <AppealRating appeal={appeal} />
        </div>
      </>
    ),
  },
  {
    id: "rating",
    header: "Rating",
    meta: { headerClassName: "hidden sm:table-cell", cellClassName: "hidden sm:table-cell" },
    cell: ({ row }) => <AppealRating appeal={row.original} />,
  },
  {
    id: "date",
    accessorFn: (appeal) => (appeal.decision ? (appeal.decidedAt ?? undefined) : appeal.createdAt),
    header: ({ table }) => (table.options.data[0]?.decision ? "Resolved" : "Submitted"),
    sortFn: "basic",
    sortUndefined: "last",
    meta: { headerClassName: "hidden md:table-cell", cellClassName: "hidden md:table-cell" },
    cell: ({ getValue }) => {
      const date = getValue<string | undefined>();
      return date ? (
        <span className="text-muted-foreground">{dateLabel(date)}</span>
      ) : (
        <span className="text-muted-foreground">Decision saved</span>
      );
    },
  },
  {
    id: "review",
    header: () => <span className="sr-only">Actions</span>,
    meta: { align: "right" },
    cell: ({ row: { original: appeal } }) => (
      <SheetTrigger
        id={appeal.id}
        render={<Button size="sm" variant="outline" />}
        aria-label={`${appeal.decision ? "View" : "Review"} appeal for ${appeal.criterion.title}, ${appeal.conversation.sourceId} in ${appeal.conversation.group}`}
      >
        {appeal.decision ? "View" : "Review"}
      </SheetTrigger>
    ),
  },
];

function AppealRating({ appeal }: { appeal: Appeal }) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="sr-only">Original rating</span>
      <Badge variant="outline">{answerLabel(appeal.original.answer)}</Badge>
      {appeal.decision && (
        <>
          <span aria-hidden="true" className="text-muted-foreground">
            →
          </span>
          <span className="sr-only">Final rating</span>
          <Badge variant="secondary">{answerLabel(appeal.decision.answer)}</Badge>
        </>
      )}
    </div>
  );
}

export function AppealQueue({
  appealId,
  resolved,
  onChange,
}: {
  appealId?: string;
  resolved: boolean;
  onChange: (appealId: string | undefined, resolved: boolean) => void;
}) {
  const query = useQuery(appealsQuery);
  const activeTab = useRef<HTMLButtonElement>(null);
  const [closingAppeal, setClosingAppeal] = useState<Appeal>();
  const { pending, completed, selected } = useMemo(() => {
    const items = query.data?.appeals ?? [];
    return {
      pending: items.filter((item) => !item.decision),
      completed: items.filter((item) => item.decision),
      selected: items.find((item) => item.id === appealId),
    };
  }, [query.data, appealId]);
  const showResolved = selected ? !!selected.decision : resolved;
  const status = showResolved ? "resolved" : "pending";
  const rows = showResolved ? completed : pending;
  const review = selected ?? closingAppeal;

  return (
    <>
      <PageHeading title="Appeals" hideTitle />
      {query.error && <ErrorMessage error={query.error} retry={() => void query.refetch()} />}
      {query.isPending && <Loading>Loading appeals…</Loading>}
      {appealId && query.isSuccess && !query.isFetching && !selected && (
        <ErrorMessage error={new Error("This appeal is unavailable in this workspace.")} />
      )}
      {query.data && (
        <Sheet
          open={!!selected}
          triggerId={review?.id ?? null}
          onOpenChange={(open, { trigger }) => {
            if (open && trigger?.id) {
              onChange(trigger.id, showResolved);
            } else if (!open) {
              setClosingAppeal(selected);
              onChange(undefined, showResolved);
            }
          }}
          onOpenChangeComplete={(open) => {
            if (!open) setClosingAppeal(undefined);
          }}
        >
          <Tabs value={status} onValueChange={(value) => onChange(undefined, value === "resolved")}>
            <TabsList aria-label="Appeal status">
              <TabsTrigger value="pending" ref={showResolved ? undefined : activeTab}>
                Pending ({pending.length})
              </TabsTrigger>
              <TabsTrigger value="resolved" ref={showResolved ? activeTab : undefined}>
                Resolved ({completed.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value={status} className="min-w-0">
              {rows.length > 0 ? (
                <AppealsTable key={status} appeals={rows} status={status} />
              ) : showResolved ? (
                <EmptyState title="No resolved appeals">Completed reviews appear here.</EmptyState>
              ) : (
                <EmptyState
                  title="No pending appeals"
                  actions={
                    <Button variant="outline" nativeButton={false} render={<Link to="/" />}>
                      Open conversations
                    </Button>
                  }
                >
                  Open a conversation’s evaluation to appeal a rating.
                </EmptyState>
              )}
            </TabsContent>
          </Tabs>
          {review && <AppealReview key={review.id} appeal={review} activeTab={activeTab} />}
        </Sheet>
      )}
    </>
  );
}

function AppealsTable({ appeals, status }: { appeals: Appeal[]; status: "pending" | "resolved" }) {
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: appeals,
    getRowId: (appeal) => appeal.id,
    initialState: { sorting: [{ id: "date", desc: true }] },
  });

  return (
    <DataTable
      table={table}
      label={status === "resolved" ? "Resolved appeals" : "Pending appeals"}
      filter={{ column: "appeal", label: "Search ID or criterion" }}
    />
  );
}
