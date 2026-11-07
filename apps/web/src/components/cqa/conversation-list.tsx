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
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUpRight01Icon,
  Chat01Icon,
  Database01Icon,
  FileImportIcon,
  JusticeScale01Icon,
  Mic01Icon,
  Task01Icon,
} from "@hugeicons/core-free-icons";
import { datasetFileSchema } from "@app/contracts";
import { cqa, appealsQuery, channelName, conversationsQuery, languageName } from "@/lib/cqa";
import { request } from "@/lib/request";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { EmptyState, ErrorMessage, Loading, PageHeading, StatusMessage } from "./ui";

const PAGE_SIZE = 12;

export function ConversationList() {
  const list = useQuery(conversationsQuery);
  const appeals = useQuery(appealsQuery);
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("");
  const [channel, setChannel] = useState("");
  const [group, setGroup] = useState("");
  const [page, setPage] = useState(0);

  const importDataset = useMutation({
    mutationFn: async (file: File | "dev") => {
      let text: string;
      if (file === "dev") {
        const response = await fetch("/__cqa_dev_dataset");
        if (!response.ok)
          throw new Error(
            "The local DEV dataset is unavailable. Import the organizer’s JSON file.",
          );
        text = await response.text();
      } else {
        if (file.size > 5 * 1024 * 1024) throw new Error("Import a JSON file under 5 MB.");
        text = await file.text();
      }
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
    onSuccess: () => {
      setSearch("");
      setLanguage("");
      setChannel("");
      setGroup("");
      setPage(0);
      void queryClient.invalidateQueries(conversationsQuery);
    },
  });

  const conversations = list.data?.conversations ?? [];
  const groups = [...new Set(conversations.map((item) => item.group))];
  const term = search.trim().toLowerCase();
  const filtered = conversations.filter(
    (item) =>
      item.sourceId.toLowerCase().includes(term) &&
      (!language || item.language === language) &&
      (!channel || item.channel === channel) &&
      (!group || item.group === group),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
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
            {import.meta.env.DEV && (
              <Button
                variant="outline"
                size="lg"
                disabled={importDataset.isPending}
                onClick={() => importDataset.mutate("dev")}
              >
                <HugeiconsIcon icon={Database01Icon} data-icon="inline-start" aria-hidden="true" />{" "}
                Load DEV dataset
              </Button>
            )}
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

      {importDataset.isPending && <Loading>Importing conversations…</Loading>}
      {importDataset.error && <ErrorMessage error={importDataset.error} />}
      {importDataset.data && (
        <StatusMessage>
          Imported {importDataset.data.imported} conversations.
          {importDataset.data.skipped > 0 &&
            ` Skipped ${importDataset.data.skipped} already in this dataset.`}
        </StatusMessage>
      )}
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
                    setPage(0);
                  }}
                />
              </div>
              <NativeSelect
                aria-label="Language"
                value={language}
                onChange={(event) => {
                  setLanguage(event.target.value);
                  setPage(0);
                }}
              >
                <NativeSelectOption value="">All languages</NativeSelectOption>
                {Object.entries(languageName).map(([key, label]) => (
                  <NativeSelectOption key={key} value={key}>
                    {label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <NativeSelect
                aria-label="Channel"
                value={channel}
                onChange={(event) => {
                  setChannel(event.target.value);
                  setPage(0);
                }}
              >
                <NativeSelectOption value="">All channels</NativeSelectOption>
                {Object.entries(channelName).map(([key, label]) => (
                  <NativeSelectOption key={key} value={key}>
                    {label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {groups.length > 1 && (
                <NativeSelect
                  aria-label="Dataset"
                  value={group}
                  onChange={(event) => {
                    setGroup(event.target.value);
                    setPage(0);
                  }}
                >
                  <NativeSelectOption value="">All datasets</NativeSelectOption>
                  {groups.map((item) => (
                    <NativeSelectOption key={item}>{item}</NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
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
                    <TableHead scope="col">Status</TableHead>
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
                      <TableCell>
                        <Badge variant={item.evaluated ? "default" : "secondary"}>
                          {item.evaluated ? "Evaluated" : "Not evaluated"}
                        </Badge>
                      </TableCell>
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
                <div className="flex w-full items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Page {currentPage + 1} of {pageCount}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={currentPage === 0}
                      aria-label="Previous page"
                      onClick={() => setPage(currentPage - 1)}
                    >
                      <HugeiconsIcon icon={ArrowLeft01Icon} aria-hidden="true" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={currentPage + 1 >= pageCount}
                      aria-label="Next page"
                      onClick={() => setPage(currentPage + 1)}
                    >
                      <HugeiconsIcon icon={ArrowRight01Icon} aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </CardFooter>
            )}
          </>
        )}
      </Card>
    </>
  );
}
