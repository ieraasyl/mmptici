import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { HugeiconsIcon } from "@hugeicons/react";
import { RefreshIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import { dashboardQuery, languageName, scoreLabel } from "@/lib/cqa";
import {
  checklistOptions,
  checklistVersionKey,
  dashboardExplanations,
  dashboardView,
  selectDashboardRows,
  sortDashboardConversations,
} from "@/lib/dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { DashboardExplanations } from "./dashboard-explanations";
import { DashboardResultsTable } from "./dashboard-results-table";
import { ScoreDistribution } from "./score-distribution";

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
  const ordered = sortDashboardConversations(evaluated, "review");
  const { breakdown, results } = dashboardView(ordered, {
    criterion,
    violation: review === "violations" ? "yes" : review === "clear" ? "no" : "",
    reviewOnly: review === "attention",
    appealOnly: review === "appeals",
  });
  const selectedCriterion = breakdown.find((row) => row.key === criterion);
  const explanations = dashboardExplanations(results, {
    criterion,
    seriousViolations: review === "violations",
  });
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
            <Skeleton className="h-8 max-sm:col-span-2" />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20 max-sm:col-span-2" />
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
            <div className="col-span-2 flex min-w-0 items-end gap-3 sm:contents">
              <FilterSelect
                id="dashboard-checklist"
                label="Checklist"
                className="max-sm:flex-1 sm:w-80"
                items={checklists}
                value={checklist}
                onChange={(value) => {
                  setChecklist(value);
                  clearResultFilters();
                }}
              />
              <div className="sm:ml-auto">{refreshButton}</div>
            </div>
            {filtered && (
              <Button
                variant="ghost"
                className="max-sm:col-span-2 max-sm:justify-self-start"
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
          </div>

          <section aria-label="Quality overview" className="border-y py-4 sm:py-5">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5">
              <div className="min-w-0 space-y-1">
                <dt className="text-sm text-muted-foreground">Average score</dt>
                <dd className="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
                  {scoreLabel(average)}
                </dd>
              </div>
              <div className="min-w-0 space-y-1">
                <dt className="text-sm text-muted-foreground">Serious violations</dt>
                <dd className="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
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
              <div className="min-w-0 space-y-1 max-sm:col-span-2 max-sm:border-t max-sm:pt-3">
                <dt className="text-sm text-muted-foreground">Most common checklist issue</dt>
                <dd className="text-lg font-semibold tracking-tight wrap-anywhere sm:text-3xl">
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
              <div className="grid gap-6 xl:grid-cols-8">
                <DashboardCriteria rows={breakdown} mixedChecklists={mixedChecklists} />
                <ScoreDistribution scores={scores} />
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
                        <>
                          {explanations && (
                            <DashboardExplanations
                              groups={explanations}
                              scope={
                                selectedCriterion
                                  ? `Lost points: ${selectedCriterion.title}`
                                  : "Serious violations"
                              }
                            />
                          )}
                          <Button variant="ghost" onClick={clearResultFilters}>
                            Clear result filters
                          </Button>
                        </>
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
