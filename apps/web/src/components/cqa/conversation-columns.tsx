import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { Mic01Icon, Chat01Icon } from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";
import type { dataTableFeatures } from "@/components/ui/data-table-features";
import { DataTableCopyItem, DataTableRowActions } from "@/components/ui/data-table-row-actions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  channelName,
  languageName,
  modelLabel,
  scoreLabel,
  type ConversationSummary,
  type DashboardConversation,
} from "@/lib/cqa";
import { ConversationReview } from "./conversation-review";

type ConversationRow = ConversationSummary & { summary: DashboardConversation | undefined };

export const conversationColumns: ColumnDef<typeof dataTableFeatures, ConversationRow>[] = [
  {
    id: "conversation",
    accessorKey: "sourceId",
    header: "Conversation",
    filterFn: "includesString",
    sortFn: "alphanumeric",
    meta: { cellClassName: "wrap-anywhere whitespace-normal" },
    cell: ({ row: { original: item } }) => (
      <>
        <Link
          className="font-medium hover:underline"
          to="/conversations/$id"
          params={{ id: item.id }}
        >
          {item.sourceId}
        </Link>
        <p className="text-xs text-muted-foreground">{item.group}</p>
      </>
    ),
  },
  {
    id: "language",
    accessorFn: (item) => languageName[item.language],
    header: "Language",
    sortFn: "text",
    meta: { align: "center" },
  },
  {
    id: "channel",
    accessorFn: (item) => channelName[item.channel],
    header: "Channel",
    sortFn: "text",
    meta: { align: "center" },
    cell: ({ row: { original: item } }) => (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-muted-foreground">
        <HugeiconsIcon
          icon={item.channel === "voice call" ? Mic01Icon : Chat01Icon}
          size={15}
          aria-hidden="true"
        />
        {channelName[item.channel]}
      </span>
    ),
  },
  {
    id: "score",
    accessorFn: (item) => item.summary?.evaluation?.total ?? undefined,
    header: "Score",
    sortFn: "basic",
    sortUndefined: "last",
    meta: { align: "center" },
    cell: ({ row: { original: item } }) => {
      const evaluation = item.summary?.evaluation;
      return evaluation ? (
        <span className="font-medium tabular-nums">{scoreLabel(evaluation.total)}</span>
      ) : null;
    },
  },
  {
    id: "model",
    accessorFn: (item) => {
      const model = item.summary?.evaluation?.model;
      return model ? modelLabel(model) : undefined;
    },
    header: "Model",
    sortFn: "text",
    sortUndefined: "last",
    meta: { align: "center", cellClassName: "wrap-anywhere whitespace-normal" },
    cell: ({ row }) => {
      const model = row.original.summary?.evaluation?.model;
      return model ? (
        <span className="text-sm text-muted-foreground" title={model}>
          {modelLabel(model)}
        </span>
      ) : null;
    },
  },
  {
    id: "review",
    header: "Review",
    meta: { align: "center", cellClassName: "whitespace-normal" },
    cell: ({ row: { original: item } }) => {
      const summary = item.summary;
      return summary?.evaluation ? (
        <ConversationReview
          className="justify-center"
          seriousViolation={summary.evaluation.seriousViolation}
          pendingAppeals={summary.pendingAppeals}
        />
      ) : (
        <Badge variant="secondary">{item.evaluated ? "Evaluated" : "Not evaluated"}</Badge>
      );
    },
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    meta: { headerClassName: "w-12", align: "right" },
    cell: ({ row: { original: item } }) => (
      <DataTableRowActions label={`Actions for ${item.sourceId} in ${item.group}`}>
        <DataTableCopyItem value={item.sourceId}>Copy conversation ID</DataTableCopyItem>
        <DropdownMenuItem render={<Link to="/conversations/$id" params={{ id: item.id }} />}>
          Open conversation
        </DropdownMenuItem>
      </DataTableRowActions>
    ),
  },
];
