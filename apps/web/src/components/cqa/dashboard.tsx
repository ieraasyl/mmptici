import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bar, BarChart, Rectangle, XAxis, YAxis } from "recharts";
import { answerLabel } from "@app/contracts";
import { cn } from "cn";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AlertCircleIcon,
  AnalyticsUpIcon,
  ArrowRight01Icon,
  JusticeScale01Icon,
  RefreshIcon,
  Task01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import {
  channelName,
  dashboardQuery,
  languageName,
  pointLabel,
  speakerName,
  scoreLabel,
  type DashboardConversation,
} from "@/lib/cqa";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Toggle } from "@/components/ui/toggle";
import { EmptyState, ErrorMessage, Loading, PageHeading } from "./ui";

const scoreRanges = [
  { label: "Below 25", min: 0, max: 25 },
  { label: "25 to <50", min: 25, max: 50 },
  { label: "50 to <75", min: 50, max: 75 },
  { label: "75 to 100", min: 75, max: 101 },
];

const scoreChartConfig = {
  count: { label: "Conversations", color: "var(--primary)" },
} satisfies ChartConfig;

type Failure = NonNullable<DashboardConversation["evaluation"]>["failures"][number];
type Option = { value: string; label: string };

const violationOptions: Option[] = [
  { value: "", label: "All results" },
  { value: "yes", label: "Serious violation" },
  { value: "no", label: "No serious violation" },
];
const sortOptions: Option[] = [
  { value: "asc", label: "Lowest score first" },
  { value: "desc", label: "Highest score first" },
  { value: "latest", label: "Latest evaluation first" },
];
const failurePage = 20;

export function Dashboard() {
  const query = useQuery(dashboardQuery);
  const refreshInProgress = useRef(false);
  const [showRefreshing, setShowRefreshing] = useState(false);
  const [refreshConfirmedAt, setRefreshConfirmedAt] = useState<number | null>(null);
  const [group, setGroup] = useState("");
  const [language, setLanguage] = useState("");
  const [checklist, setChecklist] = useState("");
  const [violation, setViolation] = useState("");
  const [criterion, setCriterion] = useState("");
  const [sort, setSort] = useState("asc");
  const [reviewOnly, setReviewOnly] = useState(false);
  const [failureLimit, setFailureLimit] = useState(failurePage);

  useEffect(() => {
    if (refreshConfirmedAt === null) return;
    const timer = setTimeout(() => setRefreshConfirmedAt(null), 1_200);
    return () => clearTimeout(timer);
  }, [refreshConfirmedAt]);

  const all = query.data?.conversations ?? [];
  const datasets = [
    { value: "", label: "All datasets" },
    ...[...new Set(all.map((item) => item.group))]
      .sort()
      .map((name) => ({ value: name, label: name })),
  ];
  const languages = [
    { value: "", label: "All languages" },
    ...Object.entries(languageName).map(([value, label]) => ({ value, label })),
  ];
  const checklists = [
    { value: "", label: "All checklists" },
    ...[
      ...new Map(
        all.flatMap(({ evaluation }) =>
          evaluation
            ? [
                [
                  evaluation.checklistId,
                  `${evaluation.checklistName} · v${evaluation.revision} · ${evaluation.checklistId.slice(0, 8)}`,
                ] as const,
              ]
            : [],
        ),
      ),
    ].map(([value, label]) => ({ value, label })),
  ];
  const criterionTitles = new Map(
    all.flatMap(
      ({ evaluation }) =>
        evaluation?.failures.map(({ criterionId, title }) => [criterionId, title] as const) ?? [],
    ),
  );
  const criteria = [
    { value: "", label: "Any criterion" },
    ...[...criterionTitles].map(([value, label]) => ({ value, label })),
  ];
  const conversations = all.filter(
    (item) =>
      (!group || item.group === group) &&
      (!language || item.language === language) &&
      (!checklist || item.evaluation?.checklistId === checklist) &&
      (!violation ||
        (item.evaluation && item.evaluation.seriousViolation === (violation === "yes"))) &&
      (!criterion ||
        item.evaluation?.failures.some(({ criterionId }) => criterionId === criterion)),
  );
  const filtered = !!(group || language || checklist || violation || criterion);
  const evaluated = conversations.filter((item) => item.evaluation);
  const scores = evaluated.flatMap((item) =>
    item.evaluation?.total == null ? [] : [item.evaluation.total],
  );
  const average = scores.length
    ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 100) / 100
    : null;
  const violations = evaluated.filter((item) => item.evaluation?.seriousViolation).length;
  const pending = conversations.reduce((sum, item) => sum + item.pendingAppeals, 0);
  const coverage = conversations.length
    ? Math.round((evaluated.length / conversations.length) * 100)
    : 0;
  const scoreDistribution = scoreRanges.map(({ label, min, max }) => ({
    label,
    count: scores.filter((score) => score >= min && score < max).length,
  }));
  const ordered = evaluated.toSorted((a, b) => {
    const byDate =
      (b.evaluation?.createdAt ?? "").localeCompare(a.evaluation?.createdAt ?? "") ||
      (b.evaluation?.id ?? "").localeCompare(a.evaluation?.id ?? "");
    if (sort === "latest") return byDate;
    // N/A totals go last in both directions.
    const left = a.evaluation?.total ?? null;
    const right = b.evaluation?.total ?? null;
    if (left === null || right === null) return (left === null ? 1 : 0) - (right === null ? 1 : 0);
    return (sort === "asc" ? left - right : right - left) || byDate;
  });
  const attention = ordered.filter(
    (item) => item.pendingAppeals > 0 || item.evaluation?.seriousViolation,
  );
  const visible = reviewOnly ? attention : ordered;
  const failures = ordered.flatMap((item) =>
    (item.evaluation?.failures ?? [])
      .filter((failure) => !criterion || failure.criterionId === criterion)
      .map((failure) => ({ conversation: item, failure })),
  );
  // Per criterion over the selected evaluations: average points where it applied, how often it was
  // missed (No, below the top of the scale, or a flagged violation) and how often it was N/A.
  type Row = {
    id: string;
    title: string;
    kind: string;
    weight: number;
    applied: number;
    na: number;
    points: number;
    missed: number;
  };
  const breakdownMap = new Map<string, Row>();
  for (const { evaluation } of evaluated) {
    const missed = new Set(evaluation?.failures.map(({ criterionId }) => criterionId));
    for (const item of evaluation?.criteria ?? []) {
      const entry = breakdownMap.get(item.criterionId) ?? {
        id: item.criterionId,
        title: item.title,
        kind: item.kind,
        weight: item.weight,
        applied: 0,
        na: 0,
        points: 0,
        missed: 0,
      };
      if (item.answer === "na") entry.na += 1;
      else {
        entry.applied += 1;
        entry.points += item.points ?? 0;
        if (missed.has(item.criterionId)) entry.missed += 1;
      }
      breakdownMap.set(item.criterionId, entry);
    }
  }
  const breakdown = [...breakdownMap.values()];
  const metrics = [
    {
      label: "Average score",
      value: scoreLabel(average),
      detail: `${scores.length} scored ${scores.length === 1 ? "conversation" : "conversations"}`,
      icon: AnalyticsUpIcon,
    },
    {
      label: "Evaluated",
      value: `${evaluated.length} / ${conversations.length}`,
      detail: `${coverage}% of selected conversations`,
      icon: Task01Icon,
    },
    {
      label: "Serious violations",
      value: violations,
      detail: "Flagged in latest evaluations",
      icon: AlertCircleIcon,
    },
    {
      label: "Pending appeals",
      value: pending,
      detail: "Across all evaluation versions",
      icon: JusticeScale01Icon,
    },
  ];

  async function refresh() {
    if (refreshInProgress.current) return;
    refreshInProgress.current = true;
    setRefreshConfirmedAt(null);
    const timer = setTimeout(() => setShowRefreshing(true), 250);
    try {
      const result = await query.refetch({ cancelRefetch: false });
      if (result.isSuccess && result.dataUpdatedAt !== query.dataUpdatedAt) {
        setRefreshConfirmedAt(result.dataUpdatedAt);
      }
    } finally {
      clearTimeout(timer);
      refreshInProgress.current = false;
      setShowRefreshing(false);
    }
  }

  return (
    <>
      <PageHeading
        title="Dashboard"
        actions={
          <>
            <Button
              variant="outline"
              disabled={query.isPending || showRefreshing}
              aria-busy={query.isFetching}
              onClick={() => void refresh()}
            >
              <span className="relative shrink-0" aria-hidden="true">
                <HugeiconsIcon
                  icon={RefreshIcon}
                  data-icon="inline-start"
                  className={cn(
                    "block transition-opacity duration-150 motion-reduce:transition-none",
                    refreshConfirmedAt !== null && "opacity-0",
                    showRefreshing && "motion-safe:animate-spin",
                  )}
                />
                <HugeiconsIcon
                  icon={Tick02Icon}
                  data-icon="inline-start"
                  className={cn(
                    "absolute inset-0 transition-opacity duration-150 motion-reduce:transition-none",
                    refreshConfirmedAt === null && "opacity-0",
                  )}
                />
              </span>
              Refresh
            </Button>
            <span className="sr-only" role="status">
              {refreshConfirmedAt !== null && "Dashboard refreshed"}
            </span>
            <Button nativeButton={false} render={<Link to="/" />}>
              View conversations
              <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" aria-hidden="true" />
            </Button>
          </>
        }
      >
        Latest evaluation per conversation. Scores include reviewer decisions.
      </PageHeading>

      {query.error && <ErrorMessage error={query.error} retry={() => void refresh()} />}
      {query.isPending && <Loading>Loading dashboard…</Loading>}
      {query.data && all.length === 0 && (
        <Card>
          <EmptyState title="No conversations yet">
            Import JSON or load the DEV dataset from Conversations to start tracking quality.
          </EmptyState>
          <CardContent className="flex justify-center">
            <Button nativeButton={false} render={<Link to="/" />}>
              Import conversations
            </Button>
          </CardContent>
        </Card>
      )}
      {query.data && all.length > 0 && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <Field className="w-full sm:w-56">
              <FieldLabel htmlFor="dashboard-group">Dataset</FieldLabel>
              <Select
                items={datasets}
                value={group}
                onValueChange={(value) => setGroup(value ?? "")}
              >
                <SelectTrigger id="dashboard-group" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {datasets.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>
                        <span className="wrap-anywhere whitespace-normal">{label}</span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field className="w-full sm:w-48">
              <FieldLabel htmlFor="dashboard-language">Language</FieldLabel>
              <Select
                items={languages}
                value={language}
                onValueChange={(value) => setLanguage(value ?? "")}
              >
                <SelectTrigger id="dashboard-language" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {languages.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <FilterSelect
              id="dashboard-checklist"
              label="Checklist"
              className="sm:w-72"
              items={checklists}
              value={checklist}
              onChange={setChecklist}
            />
            <FilterSelect
              id="dashboard-violation"
              label="Serious violation"
              className="sm:w-52"
              items={violationOptions}
              value={violation}
              onChange={setViolation}
            />
            <FilterSelect
              id="dashboard-criterion"
              label="Failed criterion"
              className="sm:w-64"
              items={criteria}
              value={criterion}
              onChange={(value) => {
                setCriterion(value);
                setFailureLimit(failurePage);
              }}
            />
            {filtered && (
              <Button
                variant="ghost"
                onClick={() => {
                  setGroup("");
                  setLanguage("");
                  setChecklist("");
                  setViolation("");
                  setCriterion("");
                }}
              >
                Clear filters
              </Button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map(({ label, value, detail, icon }) => (
              <Card key={label}>
                <CardHeader>
                  <CardDescription>{label}</CardDescription>
                  <CardAction>
                    <HugeiconsIcon icon={icon} size={18} aria-hidden="true" />
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-5 lg:grid-cols-5">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>
                  <h2>Score distribution</h2>
                </CardTitle>
                <CardDescription>
                  Final scores from {scores.length}{" "}
                  {scores.length === 1 ? "conversation" : "conversations"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {scores.length === 0 ? (
                  <p className="py-8 text-sm text-muted-foreground">
                    {evaluated.length
                      ? "No numeric scores in this selection. N/A results are excluded."
                      : "Run an evaluation to see the score distribution."}
                  </p>
                ) : (
                  <>
                    <dl className="sr-only">
                      {scoreDistribution.map(({ label, count }) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{count}</dd>
                        </div>
                      ))}
                    </dl>
                    <ChartContainer
                      config={scoreChartConfig}
                      className="h-44 w-full aspect-auto"
                      aria-hidden="true"
                    >
                      <BarChart
                        accessibilityLayer={false}
                        data={scoreDistribution}
                        layout="vertical"
                        margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                      >
                        <XAxis type="number" domain={[0, scores.length]} hide />
                        <YAxis
                          type="category"
                          dataKey="label"
                          width={76}
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                        />
                        <YAxis
                          yAxisId="counts"
                          orientation="right"
                          type="category"
                          dataKey="count"
                          width={38}
                          interval={0}
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          tick={{ className: "font-medium tabular-nums" }}
                        />
                        {/* Keep the track visible for empty score ranges. */}
                        <Bar
                          dataKey="count"
                          barSize={8}
                          shape={<Rectangle radius={4} />}
                          background={{ fill: "var(--muted)", radius: 4 }}
                          fill="var(--color-count)"
                          isAnimationActive={false}
                        />
                      </BarChart>
                    </ChartContainer>
                  </>
                )}
              </CardContent>
            </Card>
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>
                  <h2>Criterion breakdown</h2>
                </CardTitle>
                <CardDescription>
                  Where operators lose points. Averages leave out N/A answers. Select a criterion to
                  filter.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {breakdown.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead scope="col">Criterion</TableHead>
                        <TableHead scope="col" className="text-right">
                          Avg points
                        </TableHead>
                        <TableHead scope="col" className="text-right">
                          Missed
                        </TableHead>
                        <TableHead scope="col" className="text-right">
                          N/A
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {breakdown.map((row) => {
                        const share = row.applied ? row.missed / row.applied : 0;
                        return (
                          <TableRow
                            key={row.id}
                            data-state={criterion === row.id ? "selected" : undefined}
                          >
                            <TableCell className="whitespace-normal">
                              <button
                                type="button"
                                aria-pressed={criterion === row.id}
                                onClick={() => {
                                  setCriterion(criterion === row.id ? "" : row.id);
                                  setFailureLimit(failurePage);
                                }}
                                className="text-left font-medium wrap-anywhere hover:text-primary hover:underline"
                              >
                                {row.title}
                              </button>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="tabular-nums">
                                {row.kind === "flag" || !row.applied ? (
                                  <span className="text-muted-foreground">–</span>
                                ) : (
                                  <>
                                    {pointLabel(row.points / row.applied)}
                                    <span className="text-xs text-muted-foreground">
                                      {" "}
                                      / {row.weight}
                                    </span>
                                  </>
                                )}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="tabular-nums">
                                <span
                                  className={cn(share >= 0.25 && "font-semibold text-destructive")}
                                >
                                  {Math.round(share * 100)}%
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                  {row.missed} of {row.applied}
                                </span>
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="text-muted-foreground tabular-nums">{row.na}</span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="py-8 text-sm text-muted-foreground">
                    Run an evaluation to see the criterion breakdown.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                <h2>{reviewOnly ? "Needs review" : "Evaluated conversations"}</h2>
              </CardTitle>
              <CardDescription>
                {reviewOnly
                  ? "Serious violations and unresolved appeals"
                  : `${visible.length} ${visible.length === 1 ? "conversation" : "conversations"}, latest evaluation each`}
              </CardDescription>
              <CardAction>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    items={sortOptions}
                    value={sort}
                    onValueChange={(value) => setSort(value ?? "asc")}
                  >
                    <SelectTrigger size="sm" aria-label="Sort by" className="w-48">
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
                  <Toggle
                    size="sm"
                    variant="outline"
                    pressed={reviewOnly}
                    onPressedChange={setReviewOnly}
                  >
                    Needs review ({attention.length})
                  </Toggle>
                </div>
              </CardAction>
            </CardHeader>
            <CardContent>
              {visible.length ? (
                <ConversationTable conversations={visible} />
              ) : (
                <p className="py-6 text-sm text-muted-foreground">
                  {reviewOnly
                    ? "No serious violations or pending appeals in this selection."
                    : "No evaluations in this selection. Open a conversation to run one."}
                </p>
              )}
              {pending > 0 && (
                <Button
                  className="mt-4"
                  variant="outline"
                  nativeButton={false}
                  render={<Link to="/appeals" />}
                >
                  Review appeals{" "}
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    data-icon="inline-end"
                    aria-hidden="true"
                  />
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Checklist failures</h2>
              </CardTitle>
              <CardDescription>
                {failures.length} {failures.length === 1 ? "point" : "points"} where the operator
                did not follow the checklist, with the model's reason and the cited messages.
                Ordered like the table above.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {failures.length ? (
                <>
                  <ul className="divide-y">
                    {failures.slice(0, failureLimit).map(({ conversation, failure }) => (
                      <FailureItem
                        key={`${conversation.id}-${failure.criterionId}`}
                        conversation={conversation}
                        failure={failure}
                      />
                    ))}
                  </ul>
                  {failures.length > failureLimit && (
                    <Button
                      className="mt-4"
                      variant="outline"
                      onClick={() => setFailureLimit((limit) => limit + failurePage)}
                    >
                      Show {Math.min(failurePage, failures.length - failureLimit)} more
                    </Button>
                  )}
                </>
              ) : (
                <p className="py-6 text-sm text-muted-foreground">
                  No missed checklist points in this selection.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}

function FilterSelect({
  id,
  label,
  items,
  value,
  onChange,
  className,
}: {
  id: string;
  label: string;
  items: Option[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <Field className={cn("w-full", className)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select items={items} value={value} onValueChange={(next) => onChange(next ?? "")}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                <span className="wrap-anywhere whitespace-normal">{item.label}</span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

function FailureItem({
  conversation,
  failure,
}: {
  conversation: DashboardConversation;
  failure: Failure;
}) {
  return (
    <li className="flex flex-col gap-2 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          to="/conversations/$id"
          params={{ id: conversation.id }}
          search={{ evaluation: conversation.evaluation?.id }}
          className="font-semibold wrap-anywhere hover:text-primary hover:underline"
        >
          {conversation.sourceId}
        </Link>
        <span className="text-xs text-muted-foreground">
          {languageName[conversation.language]} · {channelName[conversation.channel]} ·{" "}
          {scoreLabel(conversation.evaluation?.total ?? null)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{failure.title}</span>
        <Badge variant={failure.kind === "flag" ? "destructive" : "outline"}>
          {failure.kind === "flag" ? "Serious violation" : answerLabel(failure.answer)}
        </Badge>
        {failure.lost !== null && (
          <span className="text-xs text-muted-foreground tabular-nums">
            −{pointLabel(failure.lost)} of {failure.weight} pts
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{failure.explanation}</p>
      {failure.evidence.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {failure.evidence.map(({ number, speaker, text }) => (
            <li key={number} className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <span className="mr-2 text-xs font-medium text-muted-foreground">
                #{number} · {speakerName[speaker]}
              </span>
              <span className="wrap-anywhere">{text}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function ConversationTable({ conversations }: { conversations: DashboardConversation[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Conversation</TableHead>
          <TableHead scope="col">Checklist</TableHead>
          <TableHead scope="col">Score</TableHead>
          <TableHead scope="col">Missed points</TableHead>
          <TableHead scope="col">Review</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {conversations.map((item) => (
          <TableRow key={item.id}>
            <TableCell>
              <Link
                to="/conversations/$id"
                params={{ id: item.id }}
                search={{ evaluation: item.evaluation?.id }}
                className="font-semibold wrap-anywhere hover:text-primary hover:underline"
              >
                {item.sourceId}
              </Link>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.group} · {languageName[item.language]} · {channelName[item.channel]}
              </p>
            </TableCell>
            <TableCell>
              <span className="wrap-anywhere">{item.evaluation?.checklistName}</span>
              <span className="ml-1 text-xs text-muted-foreground">
                v{item.evaluation?.revision}
              </span>
            </TableCell>
            <TableCell>
              <span className="font-semibold tabular-nums">
                {scoreLabel(item.evaluation?.total ?? null)}
              </span>
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                {item.evaluation?.failures
                  .filter(({ kind }) => kind !== "flag")
                  .map(({ criterionId, title }) => (
                    <Badge key={criterionId} variant="outline">
                      {title}
                    </Badge>
                  ))}
                {!item.evaluation?.failures.some(({ kind }) => kind !== "flag") && (
                  <span className="text-muted-foreground">None</span>
                )}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                {item.evaluation?.seriousViolation && (
                  <Badge variant="destructive">Serious violation</Badge>
                )}
                {item.pendingAppeals > 0 && (
                  <Badge variant="outline">
                    {item.pendingAppeals} pending {item.pendingAppeals === 1 ? "appeal" : "appeals"}
                  </Badge>
                )}
                {!item.evaluation?.seriousViolation && item.pendingAppeals === 0 && (
                  <span className="text-muted-foreground">No flags</span>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
