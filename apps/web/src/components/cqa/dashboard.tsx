import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { cn } from "cn";
import { HugeiconsIcon } from "@hugeicons/react";
import { RefreshIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import { dashboardQuery, languageName, scoreLabel } from "@/lib/cqa";
import {
  checklistOptions,
  checklistVersionKey,
  dashboardView,
  selectDashboardRows,
  sortDashboardConversations,
} from "@/lib/dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorMessage, PageHeading } from "./ui";
import { DashboardCriteria } from "./dashboard-criteria";
import { DashboardResultsTable } from "./dashboard-results-table";

const scoreRanges = [
  { label: "Below 25%", min: 0, max: 25 },
  { label: "25 to <50%", min: 25, max: 50 },
  { label: "50 to <75%", min: 50, max: 75 },
  { label: "75 to 100%", min: 75, max: 101 },
];
const scoreChartConfig = {
  count: { label: "Conversations", color: "var(--primary)" },
} satisfies ChartConfig;
type Option = { value: string; label: string };
const reviewOptions: Option[] = [
  { value: "", label: "All evaluated conversations" },
  { value: "attention", label: "Needs review" },
  { value: "violations", label: "Serious violations" },
  { value: "appeals", label: "Pending appeals" },
  { value: "clear", label: "No serious violation" },
];

export function Dashboard() {
  const query = useQuery(dashboardQuery);
  const refreshInProgress = useRef(false);
  const [showRefreshing, setShowRefreshing] = useState(false);
  const [refreshConfirmedAt, setRefreshConfirmedAt] = useState<number | null>(null);
  const [group, setGroup] = useState("");
  const [language, setLanguage] = useState("");
  const [checklist, setChecklist] = useState("");
  const [review, setReview] = useState("");
  const [criterion, setCriterion] = useState("");

  function clearResultFilters() {
    setReview("");
    setCriterion("");
  }

  useEffect(() => {
    if (refreshConfirmedAt === null) return;
    const timer = setTimeout(() => setRefreshConfirmedAt(null), 1_200);
    return () => clearTimeout(timer);
  }, [refreshConfirmedAt]);

  const data = query.data ?? { conversations: [], checklistResults: [] };
  const all = data.conversations;
  const conversations = selectDashboardRows(data, checklist).filter(
    (item) => (!group || item.group === group) && (!language || item.language === language),
  );
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
  const checklists = checklistOptions(data.checklistResults);
  const evaluated = conversations.filter((item) => item.evaluation);
  const scores = evaluated.flatMap((item) =>
    item.evaluation?.total == null ? [] : [item.evaluation.total],
  );
  const average = scores.length
    ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10
    : null;
  const violations = evaluated.filter((item) => item.evaluation?.seriousViolation).length;
  const checkedForViolations = evaluated.filter((item) =>
    item.evaluation?.criteria.some(({ kind, answer }) => kind === "flag" && answer !== "na"),
  ).length;
  const scoreDistribution = scoreRanges.map(({ label, min, max }) => ({
    label,
    count: scores.filter((score) => score >= min && score < max).length,
  }));
  const ordered = sortDashboardConversations(evaluated, "review");
  const { breakdown, results } = dashboardView(ordered, {
    criterion,
    violation: review === "violations" ? "yes" : review === "clear" ? "no" : "",
    reviewOnly: review === "attention",
    appealOnly: review === "appeals",
  });
  const selectedCriterion = breakdown.find((row) => row.key === criterion);
  const mostCommonIssue = breakdown
    .filter((row) => row.belowFullScore > 0)
    .toSorted((a, b) => b.belowFullScore - a.belowFullScore)[0];
  const mixedChecklists =
    new Set(
      evaluated.flatMap(({ evaluation }) => (evaluation ? [checklistVersionKey(evaluation)] : [])),
    ).size > 1;
  const criteria = [
    { value: "", label: "Any criterion" },
    ...breakdown
      .filter((row) => row.belowFullScore > 0 || row.key === criterion)
      .map((row) => ({
        value: row.key,
        label: mixedChecklists ? `${row.title} · ${row.checklistLabel}` : row.title,
      })),
  ];
  const filtered = !!(group || language || checklist);
  const resultFiltered = !!(criterion || review);

  async function refresh() {
    if (refreshInProgress.current) return;
    refreshInProgress.current = true;
    setRefreshConfirmedAt(null);
    const timer = setTimeout(() => setShowRefreshing(true), 250);
    try {
      const result = await query.refetch({ cancelRefetch: false });
      if (result.isSuccess && result.dataUpdatedAt !== query.dataUpdatedAt)
        setRefreshConfirmedAt(result.dataUpdatedAt);
    } finally {
      clearTimeout(timer);
      refreshInProgress.current = false;
      setShowRefreshing(false);
    }
  }

  const refreshButton = (
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
            "block transition-opacity",
            refreshConfirmedAt !== null && "opacity-0",
            showRefreshing && "motion-safe:animate-spin",
          )}
        />
        <HugeiconsIcon
          icon={Tick02Icon}
          data-icon="inline-start"
          className={cn(
            "absolute inset-0 transition-opacity",
            refreshConfirmedAt === null && "opacity-0",
          )}
        />
      </span>
      Refresh
    </Button>
  );

  return (
    <>
      <PageHeading title="Dashboard" hideTitle />
      <span className="sr-only" role="status">
        {refreshConfirmedAt !== null && "Dashboard refreshed"}
      </span>
      {query.error && <ErrorMessage error={query.error} retry={() => void refresh()} />}
      {query.isPending && (
        <div className="space-y-6" role="status" aria-label="Loading dashboard">
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
          <Skeleton className="h-80" />
        </div>
      )}
      {query.data && all.length === 0 && (
        <Card>
          <EmptyState title="No conversations yet">
            Import conversations to start evaluating quality.
          </EmptyState>
          <CardContent>
            <div className="flex flex-wrap justify-center gap-2">
              <Button nativeButton={false} render={<Link to="/" />}>
                Import conversations
              </Button>
              {refreshButton}
            </div>
          </CardContent>
        </Card>
      )}
      {query.data && all.length > 0 && (
        <>
          <div
            className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap"
            aria-label="Dashboard scope"
          >
            <FilterSelect
              id="dashboard-group"
              label="Dataset"
              className="sm:w-48"
              items={datasets}
              value={group}
              onChange={(value) => {
                setGroup(value);
                clearResultFilters();
              }}
            />
            <FilterSelect
              id="dashboard-language"
              label="Language"
              className="sm:w-44"
              items={languages}
              value={language}
              onChange={(value) => {
                setLanguage(value);
                clearResultFilters();
              }}
            />
            <FilterSelect
              id="dashboard-checklist"
              label="Checklist"
              className="col-span-2 sm:w-80"
              items={checklists}
              value={checklist}
              onChange={(value) => {
                setChecklist(value);
                clearResultFilters();
              }}
            />
            {filtered && (
              <Button
                variant="ghost"
                onClick={() => {
                  setGroup("");
                  setLanguage("");
                  setChecklist("");
                  clearResultFilters();
                }}
              >
                Clear filters
              </Button>
            )}
            <div className="col-start-2 justify-self-end sm:ml-auto">{refreshButton}</div>
          </div>

          <section aria-label="Quality overview" className="border-y py-5">
            <dl className="grid gap-5 sm:grid-cols-3">
              <div className="min-w-0 space-y-1">
                <dt className="text-sm text-muted-foreground">Average score</dt>
                <dd className="text-3xl font-semibold tracking-tight tabular-nums">
                  {scoreLabel(average)}
                </dd>
              </div>
              <div className="min-w-0 space-y-1">
                <dt className="text-sm text-muted-foreground">Serious violations</dt>
                <dd className="text-3xl font-semibold tracking-tight tabular-nums">
                  {checkedForViolations ? (
                    <>
                      {violations}{" "}
                      <span className="text-sm font-normal tracking-normal text-muted-foreground">
                        of {checkedForViolations} checked
                      </span>
                    </>
                  ) : (
                    "N/A"
                  )}
                </dd>
              </div>
              <div className="min-w-0 space-y-1">
                <dt className="text-sm text-muted-foreground">Most common checklist issue</dt>
                <dd className="text-3xl font-semibold tracking-tight wrap-anywhere">
                  {mostCommonIssue?.title ??
                    (breakdown.some((row) => row.applied > 0) ? "No points lost" : "N/A")}
                </dd>
                {mixedChecklists && mostCommonIssue && (
                  <dd className="text-xs text-muted-foreground">
                    {mostCommonIssue.checklistLabel}
                  </dd>
                )}
              </div>
            </dl>
          </section>

          {conversations.length === 0 ? (
            <EmptyState title="No conversations match">
              Choose another dataset or language, or clear the filters.
            </EmptyState>
          ) : evaluated.length === 0 ? (
            <Card>
              <EmptyState title="No evaluations in this selection">
                Open Conversations to evaluate the selected checklist.
              </EmptyState>
              <CardContent className="flex justify-center">
                <Button nativeButton={false} render={<Link to="/" />}>
                  Evaluate conversations
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid items-start gap-6 xl:grid-cols-12">
                <DashboardCriteria rows={breakdown} mixedChecklists={mixedChecklists} />
                <section
                  className="min-w-0 space-y-3 xl:col-span-4"
                  aria-labelledby="distribution-heading"
                >
                  <div className="space-y-1">
                    <h2 id="distribution-heading" className="text-base font-medium">
                      Score distribution
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {scores.length} scored conversations
                    </p>
                  </div>
                  {scores.length ? (
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
                          margin={{ top: 20, right: 4, bottom: 0, left: 0 }}
                        >
                          <CartesianGrid vertical={false} />
                          <XAxis
                            dataKey="label"
                            interval={0}
                            tickLine={false}
                            axisLine={{ stroke: "var(--border)" }}
                            tickMargin={8}
                          />
                          <YAxis
                            allowDecimals={false}
                            tickCount={4}
                            width={32}
                            tickLine={false}
                            axisLine={false}
                          />
                          <Bar
                            dataKey="count"
                            maxBarSize={44}
                            radius={[4, 4, 0, 0]}
                            fill="var(--color-count)"
                            isAnimationActive={false}
                          >
                            <LabelList
                              dataKey="count"
                              position="top"
                              offset={5}
                              className="fill-foreground font-medium tabular-nums"
                            />
                          </Bar>
                        </BarChart>
                      </ChartContainer>
                    </>
                  ) : (
                    <p className="py-8 text-sm text-muted-foreground">
                      No numeric scores. N/A totals are excluded.
                    </p>
                  )}
                </section>
              </div>

              <Card id="dashboard-results" className="scroll-m-5">
                <CardHeader>
                  <CardTitle>
                    <h2>Conversation results</h2>
                  </CardTitle>
                  <CardDescription aria-live="polite">
                    {results.length} {results.length === 1 ? "conversation" : "conversations"}
                    {selectedCriterion && ` · Lost points: ${selectedCriterion.title}`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DashboardResultsTable
                    conversations={results}
                    criterion={criterion}
                    mixedChecklists={mixedChecklists}
                    toolbarControls={
                      <>
                        <FilterSelect
                          id="dashboard-review"
                          label="Review status"
                          className="sm:w-60"
                          items={reviewOptions}
                          value={review}
                          onChange={setReview}
                        />
                        <FilterSelect
                          id="dashboard-criterion"
                          label="Lost points for"
                          className="sm:w-64"
                          items={criteria}
                          value={criterion}
                          onChange={setCriterion}
                        />
                      </>
                    }
                    toolbarActions={
                      resultFiltered && (
                        <Button variant="ghost" onClick={clearResultFilters}>
                          Clear result filters
                        </Button>
                      )
                    }
                  />
                </CardContent>
              </Card>
            </>
          )}
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
    <Field className={cn("w-full min-w-0", className)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select items={items} value={value} onValueChange={(next) => onChange(next ?? "")}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}
