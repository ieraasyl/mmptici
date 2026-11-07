import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Fragment, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowUpRight01Icon,
  Chat01Icon,
  Database01Icon,
  FileImportIcon,
  JusticeScale01Icon,
  Mic01Icon,
  Task01Icon,
} from "@hugeicons/core-free-icons";
import { datasetFileSchema } from "@app/contracts";
import {
  cqa,
  appealsQuery,
  channelName,
  conversationsQuery,
  dashboardQuery,
  type DashboardConversation,
  languageName,
  modelLabel,
  originLabel,
  scoreLabel,
} from "@/lib/cqa";
import { request } from "@/lib/request";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { EmptyState, ErrorMessage, Loading, PageHeading } from "./ui";
import { BatchEvaluate } from "./batch-evaluate";

const PAGE_SIZE = 12;

const sortOptions = [
  { value: "", label: "Sort by ID" },
  { value: "asc", label: "Lowest score first" },
  { value: "desc", label: "Highest score first" },
];

export function ConversationList() {
  const list = useQuery(conversationsQuery);
  // Latest evaluation per conversation (score, violation, model) comes from the dashboard summary.
  const summary = useQuery(dashboardQuery);
  const appeals = useQuery(appealsQuery);
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("");
  const [channel, setChannel] = useState("");
  const [group, setGroup] = useState("");
  const [sort, setSort] = useState("");
  const [page, setPage] = useState(1);

  const importDataset = useMutation({
    onMutate: () => {
      toast.add({
        id: "conversation-import",
        title: "Importing conversations…",
        description: undefined,
        type: "loading",
        timeout: 0,
      });
    },
    mutationFn: async (file: File | "dev") => {
      if (file === "dev") {
        const result = await request((init) => cqa.conversations["import-dev"].$post({}, { init }));
        // The DEV data ships with finished evaluations (several models), so nothing has to be re-run.
        await request((init) => cqa.evaluations["import-dev"].$post({}, { init }));
        return result;
      }
      if (file.size > 5 * 1024 * 1024) throw new Error("Import a JSON file under 5 MB.");
      const text = await file.text();
      let value: unknown;
      try {
        value = JSON.parse(text);
      } catch {
        throw new Error("This file does not contain valid JSON.");
      }
      const parsed = datasetFileSchema.safeParse(value);
      if (!parsed.success) {
        const issue = parsed.error.issues.find(({ code }) => code !== "invalid_union");
        throw new Error(
          issue?.message ??
            "Use the organizer’s dataset JSON or a conversation record with a transcript, channel, and language.",
        );
      }
      return request((init) => cqa.conversations.$post({ json: parsed.data }, { init }));
    },
    onSuccess: ({ imported, skipped }) => {
      const count = imported || skipped;
      const conversations = count === 1 ? "conversation" : "conversations";
      toast.add({
        id: "conversation-import",
        title:
          imported > 0
            ? `Imported ${count} ${conversations}.`
            : `${count} ${conversations} already imported.`,
        description:
          imported > 0 && skipped > 0 ? `Skipped ${skipped} already in this dataset.` : undefined,
        type: imported > 0 ? "success" : "info",
        timeout: 5_000,
      });
      setSearch("");
      setLanguage("");
      setChannel("");
      setGroup("");
      setPage(1);
      void queryClient.invalidateQueries(conversationsQuery);
      void queryClient.invalidateQueries(dashboardQuery);
    },
    onError: (error) => {
      toast.add({
        id: "conversation-import",
        title: "Import failed",
        description: error.message,
        type: "error",
        timeout: 8_000,
      });
    },
    // The conversations may have been saved even when the bundled scores failed to load.
    onSettled: () => {
      void queryClient.invalidateQueries(conversationsQuery);
      void queryClient.invalidateQueries(dashboardQuery);
    },
  });

  const conversations = list.data?.conversations ?? [];
  const groups = [...new Set(conversations.map((item) => item.group))];
  const filters = [
    {
      label: "Language",
      all: "All languages",
      value: language,
      onChange: setLanguage,
      options: Object.entries(languageName),
    },
    {
      label: "Channel",
      all: "All channels",
      value: channel,
      onChange: setChannel,
      options: Object.entries(channelName),
    },
    {
      label: "Dataset",
      all: "All datasets",
      value: group,
      onChange: setGroup,
      options: groups.map((name) => [name, name] as const),
    },
  ];
  const latest = new Map(
    (summary.data?.conversations ?? []).map((item) => [item.id, item.evaluation] as const),
  );
  const term = search.trim().toLowerCase();
  const matching = conversations.filter(
    (item) =>
      item.sourceId.toLowerCase().includes(term) &&
      (!language || item.language === language) &&
      (!channel || item.channel === channel) &&
      (!group || item.group === group),
  );
  // Unscored conversations (not evaluated or N/A) stay at the end in both directions.
  const filtered = sort
    ? matching.toSorted((a, b) => {
        const left = latest.get(a.id)?.total ?? null;
        const right = latest.get(b.id)?.total ?? null;
        if (left === null || right === null)
          return (left === null ? 1 : 0) - (right === null ? 1 : 0);
        return sort === "asc" ? left - right : right - left;
      })
    : matching;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pageNumbers =
    pageCount <= 7
      ? Array.from({ length: pageCount }, (_, index) => index + 1)
      : [...new Set([1, currentPage - 1, currentPage, currentPage + 1, pageCount])].filter(
          (number) => number >= 1 && number <= pageCount,
        );
  const stats = [
    { label: "Conversations", value: list.data && conversations.length, icon: Chat01Icon },
    {
      label: "Evaluated",
      value: list.data && conversations.filter((item) => item.evaluated).length,
      icon: Task01Icon,
    },
    {
      label: "Pending appeals",
      value: appeals.data?.appeals.filter((item) => !item.decision).length,
      icon: JusticeScale01Icon,
    },
  ];

  return (
    <>
      <PageHeading
        title="Conversations"
        actions={
          <>
            <Button
              variant="outline"
              size="lg"
              disabled={importDataset.isPending}
              onClick={() => importDataset.mutate("dev")}
            >
              <HugeiconsIcon icon={Database01Icon} data-icon="inline-start" aria-hidden="true" />{" "}
              Load DEV dataset
            </Button>
            <Button
              size="lg"
              disabled={importDataset.isPending}
              onClick={() => fileInput.current?.click()}
            >
              <HugeiconsIcon icon={FileImportIcon} data-icon="inline-start" aria-hidden="true" />{" "}
              Import JSON
            </Button>
            <input
              type="file"
              accept=".json,application/json"
              hidden
              ref={fileInput}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (file) importDataset.mutate(file);
              }}
            />
          </>
        }
      >
        Review chats and calls, run checklist evaluations, and inspect the evidence.
      </PageHeading>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map(({ label, value, icon }) => (
          <Card key={label} size="sm">
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle>{value ?? "…"}</CardTitle>
              <CardAction>
                <HugeiconsIcon icon={icon} size={19} aria-hidden="true" />
              </CardAction>
            </CardHeader>
          </Card>
        ))}
      </div>

      {list.error && (
        <ErrorMessage
          error={list.error}
          retry={() => {
            void list.refetch();
          }}
        />
      )}
      {appeals.error && (
        <ErrorMessage
          error={appeals.error}
          retry={() => {
            void appeals.refetch();
          }}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Conversation library</h2>
          </CardTitle>
          <CardDescription>
            {list.data
              ? `${filtered.length} of ${conversations.length} conversations`
              : "Imported transcripts"}
          </CardDescription>
          {conversations.length > 0 && (
            <CardAction>
              <BatchEvaluate conversations={filtered} />
            </CardAction>
          )}
        </CardHeader>
        {conversations.length > 0 && (
          <CardContent>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-48">
                <Input
                  aria-label="Search conversation IDs"
                  placeholder="Search by ID"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                />
              </div>
              {filters
                .filter(({ options }) => options.length > 1)
                .map((filter) => {
                  const items = [
                    { value: "", label: filter.all },
                    ...filter.options.map(([value, label]) => ({ value, label })),
                  ];
                  return (
                    <Select
                      key={filter.label}
                      items={items}
                      value={filter.value}
                      onValueChange={(value) => {
                        filter.onChange(value ?? "");
                        setPage(1);
                      }}
                    >
                      <SelectTrigger aria-label={filter.label} className="w-36 max-w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {items.map(({ value, label }) => (
                            <SelectItem key={value} value={value}>
                              <span className="wrap-anywhere whitespace-normal">{label}</span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  );
                })}
              <Select
                items={sortOptions}
                value={sort}
                onValueChange={(value) => {
                  setSort(value ?? "");
                  setPage(1);
                }}
              >
                <SelectTrigger aria-label="Sort" className="w-44 max-w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {sortOptions.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        )}
        {list.isPending && <Loading>Loading conversations…</Loading>}
        {list.data && conversations.length === 0 && (
          <EmptyState title="No conversations yet">
            Import the organizer’s JSON file to add transcripts to this workspace.
          </EmptyState>
        )}
        {conversations.length > 0 && filtered.length === 0 && (
          <EmptyState title="No matching conversations">
            Try another ID or change the filters.
          </EmptyState>
        )}
        {visible.length > 0 && (
          <>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Conversation</TableHead>
                    <TableHead scope="col">Language</TableHead>
                    <TableHead scope="col">Channel</TableHead>
                    <TableHead scope="col">Score</TableHead>
                    <TableHead scope="col">Model</TableHead>
                    <TableHead scope="col">Review</TableHead>
                    <TableHead scope="col">
                      <span className="sr-only">Open</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Link
                          className="font-semibold wrap-anywhere hover:text-primary hover:underline"
                          to="/conversations/$id"
                          params={{ id: item.id }}
                        >
                          {item.sourceId}
                        </Link>
                        <div className="mt-0.5 text-xs text-muted-foreground">{item.group}</div>
                      </TableCell>
                      <TableCell>{languageName[item.language]}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5 whitespace-nowrap text-muted-foreground">
                          <HugeiconsIcon
                            icon={item.channel === "voice call" ? Mic01Icon : Chat01Icon}
                            size={15}
                            aria-hidden="true"
                          />
                          {channelName[item.channel]}
                        </span>
                      </TableCell>
                      <LatestCells evaluated={item.evaluated} evaluation={latest.get(item.id)} />
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          nativeButton={false}
                          aria-label={`Open ${item.sourceId}`}
                          render={<Link to="/conversations/$id" params={{ id: item.id }} />}
                        >
                          <HugeiconsIcon icon={ArrowUpRight01Icon} aria-hidden="true" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            {pageCount > 1 && (
              <CardFooter>
                <p className="sr-only" role="status">
                  Page {currentPage} of {pageCount}
                </p>
                <Pagination aria-label="Conversation pages">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        nativeButton
                        disabled={currentPage === 1}
                        onClick={() => setPage(currentPage - 1)}
                      />
                    </PaginationItem>
                    {pageNumbers.map((number, index) => (
                      <Fragment key={number}>
                        {number - (pageNumbers[index - 1] ?? number) > 1 && (
                          <PaginationItem className="hidden sm:list-item">
                            <PaginationEllipsis />
                          </PaginationItem>
                        )}
                        <PaginationItem
                          className={number === currentPage ? undefined : "hidden sm:list-item"}
                        >
                          <PaginationLink
                            nativeButton
                            isActive={number === currentPage}
                            aria-label={`Page ${number}`}
                            onClick={() => setPage(number)}
                          >
                            {number}
                          </PaginationLink>
                        </PaginationItem>
                      </Fragment>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        nativeButton
                        disabled={currentPage === pageCount}
                        onClick={() => setPage(currentPage + 1)}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </CardFooter>
            )}
          </>
        )}
      </Card>
    </>
  );
}

function LatestCells({
  evaluated,
  evaluation,
}: {
  evaluated: boolean;
  evaluation: DashboardConversation["evaluation"] | undefined;
}) {
  if (!evaluation)
    return (
      <TableCell colSpan={3}>
        <Badge variant="secondary">{evaluated ? "Evaluated" : "Not evaluated"}</Badge>
      </TableCell>
    );
  return (
    <>
      <TableCell>
        <span className="font-semibold tabular-nums">{scoreLabel(evaluation.total)}</span>
      </TableCell>
      <TableCell>
        <span className="text-sm whitespace-nowrap text-muted-foreground" title={evaluation.model}>
          {modelLabel(evaluation.model)}
        </span>
        <Badge variant={evaluation.origin === "live" ? "secondary" : "outline"} className="ml-1">
          {originLabel[evaluation.origin]}
        </Badge>
      </TableCell>
      <TableCell>
        {evaluation.seriousViolation ? (
          <Badge variant="destructive">Serious violation</Badge>
        ) : (
          <span className="text-sm text-muted-foreground">No flags</span>
        )}
      </TableCell>
    </>
  );
}
