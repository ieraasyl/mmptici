import { DataTable } from "@/components/ui/data-table";
import { dataTableFeatures } from "@/components/ui/data-table-features";
import { useTable, type RowSelectionState } from "@tanstack/react-table";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, Database01Icon, FileImportIcon } from "@hugeicons/core-free-icons";
import { datasetFileSchema } from "@app/contracts";
import { cqa, channelName, conversationsQuery, dashboardQuery, languageName } from "@/lib/cqa";
import { request } from "@/lib/request";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { EmptyState, ErrorMessage, Loading, PageHeading } from "./ui";
import { BatchEvaluate } from "./batch-evaluate";
import { conversationColumns } from "./conversation-columns";

export function ConversationList() {
  const list = useQuery(conversationsQuery);
  // Scores and review status come from the same conversation summary used by the dashboard.
  const summary = useQuery(dashboardQuery);
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [language, setLanguage] = useState("");
  const [channel, setChannel] = useState("");
  const [group, setGroup] = useState("");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  function clearSelection() {
    setRowSelection({});
  }

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
      table.resetColumnFilters();
      setLanguage("");
      setChannel("");
      setGroup("");
      clearSelection();
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
  });

  const conversations = list.data?.conversations ?? [];
  const groups = [...new Set(conversations.map((item) => item.group))];
  const filters = [
    {
      id: "conversation-language",
      label: "Language",
      all: "All languages",
      value: language,
      onChange: setLanguage,
      options: Object.entries(languageName),
    },
    {
      id: "conversation-channel",
      label: "Channel",
      all: "All channels",
      value: channel,
      onChange: setChannel,
      options: Object.entries(channelName),
    },
    {
      id: "conversation-dataset",
      label: "Dataset",
      all: "All datasets",
      value: group,
      onChange: setGroup,
      options: groups.map((name) => [name, name] as const),
    },
  ];
  const tableData = useMemo(() => {
    const latest = new Map(summary.data?.conversations.map((item) => [item.id, item]));
    return (list.data?.conversations ?? [])
      .filter(
        (item) =>
          (!language || item.language === language) &&
          (!channel || item.channel === channel) &&
          (!group || item.group === group),
      )
      .map((item) => ({ ...item, summary: latest.get(item.id) }));
  }, [list.data, summary.data, language, channel, group]);
  const table = useTable({
    features: dataTableFeatures,
    columns: conversationColumns,
    data: tableData,
    getRowId: (item) => item.id,
    sortDescFirst: false,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
  });
  const filtered = table.getSortedRowModel().rows.map((row) => row.original);
  const hasFilters = Boolean(
    language || channel || group || table.getColumn("conversation")?.getFilterValue(),
  );
  const hasSelection = Object.keys(rowSelection).length > 0;
  const selectedConversations = filtered.filter(({ id }) => rowSelection[id]);
  const evaluatedCount = conversations.filter(({ evaluated }) => evaluated).length;
  const importMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />} disabled={importDataset.isPending}>
        Import
        <HugeiconsIcon icon={ArrowDown01Icon} data-icon="inline-end" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => fileInput.current?.click()}>
            <HugeiconsIcon icon={FileImportIcon} aria-hidden="true" />
            Import JSON
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => importDataset.mutate("dev")}>
            <HugeiconsIcon icon={Database01Icon} aria-hidden="true" />
            Load DEV dataset
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      <PageHeading title="Conversations" hideTitle />
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

      {list.error && (
        <ErrorMessage
          error={list.error}
          retry={() => {
            void list.refetch();
          }}
        />
      )}

      {list.isPending && <Loading>Loading conversations…</Loading>}
      {list.data && conversations.length === 0 && (
        <EmptyState title="No conversations yet" actions={importMenu}>
          Import the organizer’s JSON file to add transcripts to this workspace.
        </EmptyState>
      )}
      {conversations.length > 0 && (
        <BatchEvaluate
          conversations={hasSelection ? selectedConversations : filtered}
          onClearSelection={hasSelection ? clearSelection : undefined}
        >
          {(checklist, actions) => (
            <DataTable
              table={table}
              label="Conversations"
              tableClassName="min-w-236 table-fixed"
              filter={{
                column: "conversation",
                label: "Search by ID",
                onChange: clearSelection,
              }}
              selectable
              unselectedStatus={`${evaluatedCount} of ${conversations.length} evaluated`}
              toolbarControls={
                <div className="grid w-full grid-cols-2 items-end gap-2 max-sm:*:odd:last:col-span-2 sm:contents">
                  {filters
                    .filter(({ options }) => options.length > 1)
                    .map((filter) => {
                      const items = [
                        { value: "", label: filter.all },
                        ...filter.options.map(([value, label]) => ({ value, label })),
                      ];
                      return (
                        <Field key={filter.id} className="min-w-0 max-w-full sm:w-auto">
                          <FieldLabel htmlFor={filter.id}>{filter.label}</FieldLabel>
                          <Select
                            items={items}
                            value={filter.value}
                            onValueChange={(value) => {
                              filter.onChange(value ?? "");
                              clearSelection();
                            }}
                          >
                            <SelectTrigger
                              id={filter.id}
                              title={items.find(({ value }) => value === filter.value)?.label}
                            >
                              <SelectValue />
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
                        </Field>
                      );
                    })}
                  {checklist}
                </div>
              }
              toolbarActions={
                <div className="flex w-full flex-wrap items-center gap-2 max-sm:*:grow sm:contents">
                  {hasFilters && (
                    <p className="text-sm text-muted-foreground max-sm:basis-full sm:py-1.5">
                      {filtered.length} {filtered.length === 1 ? "match" : "matches"}
                    </p>
                  )}
                  {importMenu}
                  {actions}
                </div>
              }
            />
          )}
        </BatchEvaluate>
      )}
    </>
  );
}
