import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  ArrowRight01Icon,
  CheckListIcon,
  Delete02Icon,
} from "@hugeicons/core-free-icons";
import {
  checklistSchema,
  type Checklist,
  type ChecklistDraft,
  type Criterion,
} from "@app/contracts";
import { cqa, checklistsQuery } from "@/lib/cqa";
import { ApiRequestError, request } from "@/lib/request";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ErrorMessage, Loading, PageHeading, StatusMessage } from "./ui";

type CriterionFields = Omit<Criterion, "scale" | "weight"> & { scale: string; weight: string };

function blankCriterion(): CriterionFields {
  return {
    id: crypto.randomUUID(),
    title: "",
    section: "",
    guidance: "",
    weight: "10",
    kind: "binary",
    scale: "",
    allowNA: false,
  };
}

export function ChecklistEditor() {
  const query = useQuery(checklistsQuery);
  const [selection, select] = useState<string>();
  const [notice, setNotice] = useState("");
  const defaultId = query.data?.defaultId;
  const active = selection ?? defaultId;
  const checklist = query.data?.checklists.find(({ id }) => id === active);

  function choose(id: string) {
    setNotice("");
    select(id);
  }

  return (
    <>
      <PageHeading
        title="Checklists"
        actions={
          <Button size="lg" onClick={() => choose("new")}>
            <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" aria-hidden="true" /> New
            checklist
          </Button>
        }
      >
        Define what the evaluator should look for and how much each criterion counts.
      </PageHeading>
      {query.error && (
        <ErrorMessage
          error={query.error}
          retry={() => {
            void query.refetch();
          }}
        />
      )}
      {notice && <StatusMessage>{notice}</StatusMessage>}
      {query.isPending && <Loading>Loading checklists…</Loading>}
      {query.data && (
        <div className="grid items-start gap-5 xl:flex">
          <Card size="sm" className="xl:w-64 xl:shrink-0">
            <CardHeader>
              <CardTitle>
                <h2>Available checklists</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {query.data.checklists.map((item) => (
                  <li key={item.id}>
                    <Button
                      type="button"
                      aria-current={item.id === active}
                      variant={item.id === active ? "secondary" : "ghost"}
                      className="h-auto w-full justify-start"
                      onClick={() => choose(item.id)}
                    >
                      <HugeiconsIcon
                        icon={CheckListIcon}
                        size={16}
                        className="mt-0.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 text-left whitespace-normal">
                        <span className="block font-medium wrap-anywhere">{item.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {item.id === defaultId ? "Starter" : `Version ${item.revision}`} ·{" "}
                          {item.criteria.length} criteria
                        </span>
                      </span>
                      <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        size={15}
                        className="mt-0.5 shrink-0"
                        aria-hidden="true"
                      />
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          {(checklist || active === "new") && (
            <ChecklistForm
              key={checklist?.id ?? "new"}
              checklist={checklist}
              starter={checklist?.id === defaultId}
              onSaved={(saved) => {
                select(saved.id);
                setNotice(`Saved ${saved.name}, version ${saved.revision}.`);
              }}
              onDeleted={(deleted) => {
                select(undefined);
                setNotice(`Deleted ${deleted.name}.`);
              }}
              onRefresh={() => {
                setNotice("Checklist saved. Reload the list if it hasn’t appeared.");
              }}
            />
          )}
        </div>
      )}
    </>
  );
}

function ChecklistForm({
  checklist,
  starter,
  onSaved,
  onDeleted,
  onRefresh,
}: {
  checklist?: Checklist;
  starter: boolean;
  onSaved: (saved: Checklist) => void;
  onDeleted: (deleted: Checklist) => void;
  onRefresh: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(
    starter && checklist ? `${checklist.name} (custom)` : (checklist?.name ?? ""),
  );
  const [revision, setRevision] = useState(checklist?.revision);
  const [criteria, setCriteria] = useState<CriterionFields[]>(
    () =>
      checklist?.criteria.map((item) => ({
        ...item,
        scale: item.scale.join(", "),
        weight: String(item.weight),
      })) ?? [blankCriterion()],
  );
  const [expanded, setExpanded] = useState(() => [criteria[0].id]);
  const [inputError, setInputError] = useState<Error>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const save = useMutation({
    mutationFn: async (draft: ChecklistDraft) => {
      try {
        if (!checklist || starter)
          return await request((init) => cqa.checklists.$post({ json: draft }, { init }));
        return await request((init) =>
          cqa.checklists[":id"].$put(
            {
              param: { id: checklist.id },
              json: { ...draft, revision },
            },
            { init },
          ),
        );
      } catch (error) {
        if (error instanceof ApiRequestError && error.code === "INVALID_RESPONSE") return undefined;
        throw error;
      }
    },
    onSuccess: (data) => {
      if (data?.checklist) {
        const saved = data.checklist;
        setRevision(saved.revision);
        queryClient.setQueryData(
          checklistsQuery.queryKey,
          (current) =>
            current && {
              ...current,
              checklists: [...current.checklists.filter((item) => item.id !== saved.id), saved],
            },
        );
        onSaved(saved);
      } else {
        onRefresh();
      }
      void queryClient.invalidateQueries(checklistsQuery);
    },
  });
  const remove = useMutation({
    mutationFn: async ({ id }: Checklist) => {
      try {
        await request((init) => cqa.checklists[":id"].$delete({ param: { id } }, { init }));
      } catch (error) {
        if (!(error instanceof ApiRequestError && error.code === "INVALID_RESPONSE")) throw error;
      }
    },
    onSuccess: async (_data, deleted) => {
      await queryClient.cancelQueries(checklistsQuery);
      queryClient.setQueryData(
        checklistsQuery.queryKey,
        (current) =>
          current && {
            ...current,
            checklists: current.checklists.filter(({ id }) => id !== deleted.id),
          },
      );
      onDeleted(deleted);
      void queryClient.invalidateQueries(checklistsQuery);
    },
  });

  function update(id: string, changes: Partial<CriterionFields>) {
    setCriteria((items) => items.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (confirmDelete || save.isPending) return;
    setInputError(undefined);
    const parsed = checklistSchema.safeParse({
      name,
      criteria: criteria.map((item) => ({
        ...item,
        weight: item.kind === "flag" ? 0 : item.weight.trim() ? Number(item.weight) : NaN,
        allowNA: item.kind !== "flag" && item.allowNA,
        scale:
          item.kind === "numeric"
            ? item.scale.split(",").map((part) => (part.trim() ? Number(part) : NaN))
            : [],
      })),
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const index = issue.path[1];
      const field = issue.path[2];
      if (typeof index === "number") {
        setExpanded((items) => [...new Set([...items, criteria[index].id])]);
      }
      setInputError(
        new Error(
          typeof index === "number"
            ? `Criterion ${index + 1}${typeof field === "string" ? `, ${field}` : ""}. ${issue.message}`
            : issue.message,
        ),
      );
      return;
    }
    save.mutate(parsed.data);
  }

  return (
    <Card className="xl:flex-1">
      <form noValidate onSubmit={submit} className="flex flex-col gap-5">
        <CardHeader>
          <CardTitle>
            <h2>
              {starter
                ? "Customize the starter checklist"
                : checklist
                  ? "Edit checklist"
                  : "New checklist"}
            </h2>
          </CardTitle>
          <CardDescription>
            {starter
              ? "Saving creates a copy you can select for future evaluations."
              : "Past evaluations keep the checklist version they used."}
          </CardDescription>
          {revision && !starter && (
            <CardAction>
              <Badge variant="secondary">Version {revision}</Badge>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Field className="max-w-lg">
              <FieldLabel htmlFor="checklist-name">Checklist name</FieldLabel>
              <Input
                id="checklist-name"
                value={name}
                required
                maxLength={100}
                disabled={save.isPending}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">Criteria</h3>
              <span className="text-sm text-muted-foreground">
                Total weight{" "}
                {criteria.reduce(
                  (sum, item) => sum + (item.kind === "flag" ? 0 : Number(item.weight) || 0),
                  0,
                )}
              </span>
            </div>
            <Accordion multiple value={expanded} onValueChange={setExpanded}>
              {criteria.map((item, index) => (
                <CriterionEditor
                  key={item.id}
                  item={item}
                  index={index}
                  disabled={save.isPending}
                  onChange={(changes) => update(item.id, changes)}
                  onRemove={
                    criteria.length > 1
                      ? () => {
                          setCriteria((items) => items.filter(({ id }) => id !== item.id));
                          setExpanded((items) => items.filter((id) => id !== item.id));
                        }
                      : undefined
                  }
                />
              ))}
            </Accordion>
            <Button
              type="button"
              variant="outline"
              disabled={criteria.length >= 20 || save.isPending}
              onClick={() => {
                const item = blankCriterion();
                setExpanded((items) => [...items, item.id]);
                setCriteria((items) => [...items, item]);
              }}
            >
              <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" aria-hidden="true" /> Add
              criterion
            </Button>
            {(inputError || save.error) && <ErrorMessage error={(inputError || save.error)!} />}
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <div className="flex flex-wrap justify-end gap-2">
            {checklist && !starter && (
              <AlertDialog
                open={confirmDelete}
                onOpenChange={(open) => {
                  if (remove.isPending) return;
                  if (open) remove.reset();
                  setConfirmDelete(open);
                }}
              >
                <AlertDialogTrigger
                  render={<Button type="button" size="lg" variant="destructive" />}
                  disabled={save.isPending}
                >
                  Delete checklist
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete checklist?</AlertDialogTitle>
                    <AlertDialogDescription className="wrap-anywhere">
                      This removes {checklist.name} from the evaluation picker. Past evaluations
                      keep the version they used.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  {remove.error && <ErrorMessage error={remove.error} />}
                  <AlertDialogFooter>
                    <AlertDialogCancel type="button" disabled={remove.isPending}>
                      Cancel
                    </AlertDialogCancel>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(checklist)}
                    >
                      {remove.isPending ? "Deleting…" : "Delete checklist"}
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button type="submit" size="lg" disabled={save.isPending || confirmDelete}>
              {save.isPending ? "Saving…" : "Save checklist"}
            </Button>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}

function CriterionEditor({
  item,
  index,
  disabled,
  onChange,
  onRemove,
}: {
  item: CriterionFields;
  index: number;
  disabled: boolean;
  onChange: (changes: Partial<CriterionFields>) => void;
  onRemove?: () => void;
}) {
  const id = item.id;
  return (
    <AccordionItem value={id}>
      <AccordionTrigger>
        <span className="wrap-anywhere">
          {String(index + 1).padStart(2, "0")} · {item.title || "New criterion"}
        </span>
        <Badge variant="outline">{item.kind === "flag" ? "Flag" : `Weight ${item.weight}`}</Badge>
      </AccordionTrigger>
      <AccordionContent>
        <fieldset disabled={disabled} className="space-y-4">
          <legend className="sr-only">Criterion {index + 1}</legend>
          <FieldGroup className="grid sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={`title-${id}`}>Criterion title</FieldLabel>
              <Input
                id={`title-${id}`}
                required
                maxLength={150}
                value={item.title}
                onChange={(event) => onChange({ title: event.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`section-${id}`}>Section</FieldLabel>
              <Input
                id={`section-${id}`}
                required
                maxLength={100}
                value={item.section}
                onChange={(event) => onChange({ section: event.target.value })}
              />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor={`guidance-${id}`}>Evaluation instructions</FieldLabel>
              <Textarea
                id={`guidance-${id}`}
                required
                maxLength={2400}
                rows={3}
                value={item.guidance}
                onChange={(event) => onChange({ guidance: event.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`kind-${id}`}>Answer type</FieldLabel>
              <NativeSelect
                id={`kind-${id}`}
                value={item.kind}
                onChange={(event) => onChange({ kind: event.target.value as Criterion["kind"] })}
              >
                <NativeSelectOption value="binary">Yes / No</NativeSelectOption>
                <NativeSelectOption value="numeric">Numeric scale</NativeSelectOption>
                <NativeSelectOption value="flag">Serious violation flag</NativeSelectOption>
              </NativeSelect>
            </Field>
            {item.kind !== "flag" && (
              <Field>
                <FieldLabel htmlFor={`weight-${id}`}>Weight</FieldLabel>
                <Input
                  id={`weight-${id}`}
                  type="number"
                  required
                  min="0"
                  max="100"
                  step="any"
                  value={item.weight}
                  onChange={(event) => onChange({ weight: event.target.value })}
                />
              </Field>
            )}
            {item.kind === "numeric" && (
              <Field>
                <FieldLabel htmlFor={`scale-${id}`}>Scale values</FieldLabel>
                <Input
                  id={`scale-${id}`}
                  required
                  placeholder="0, 5, 10"
                  value={item.scale}
                  onChange={(event) => onChange({ scale: event.target.value })}
                />
              </Field>
            )}
            {item.kind !== "flag" && (
              <Field orientation="horizontal">
                <Switch
                  id={`na-${id}`}
                  checked={item.allowNA}
                  disabled={disabled}
                  onCheckedChange={(allowNA) => onChange({ allowNA })}
                />
                <FieldLabel htmlFor={`na-${id}`}>Allow N/A</FieldLabel>
              </Field>
            )}
          </FieldGroup>
          {onRemove && (
            <Button type="button" variant="destructive" size="sm" onClick={onRemove}>
              <HugeiconsIcon icon={Delete02Icon} data-icon="inline-start" aria-hidden="true" />{" "}
              Remove criterion
            </Button>
          )}
        </fieldset>
      </AccordionContent>
    </AccordionItem>
  );
}
