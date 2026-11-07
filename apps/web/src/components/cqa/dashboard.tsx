import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bar, BarChart, Pie, PieChart, Rectangle, XAxis, YAxis } from "recharts";
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
  dateLabel,
  languageName,
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

const coverageChartConfig = {
  evaluated: { label: "Evaluated", color: "var(--primary)" },
  awaiting: { label: "Awaiting evaluation", color: "var(--muted)" },
} satisfies ChartConfig;

export function Dashboard() {
  const query = useQuery(dashboardQuery);
  const refreshInProgress = useRef(false);
  const [showRefreshing, setShowRefreshing] = useState(false);
  const [refreshConfirmedAt, setRefreshConfirmedAt] = useState<number | null>(null);
  const [group, setGroup] = useState("");
  const [language, setLanguage] = useState("");
  const [reviewOnly, setReviewOnly] = useState(false);

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
  const conversations = all.filter(
    (item) => (!group || item.group === group) && (!language || item.language === language),
  );
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
  const coverageSegments = [
    { value: evaluated.length, fill: "var(--color-evaluated)" },
    { value: Math.max(conversations.length, 1) - evaluated.length, fill: "var(--color-awaiting)" },
  ];
  const ordered = evaluated.toSorted(
    (a, b) =>
      (b.evaluation?.createdAt ?? "").localeCompare(a.evaluation?.createdAt ?? "") ||
      (b.evaluation?.id ?? "").localeCompare(a.evaluation?.id ?? ""),
  );
  const attention = ordered.filter(
    (item) => item.pendingAppeals > 0 || item.evaluation?.seriousViolation,
  );
  const visible = reviewOnly ? attention : ordered.slice(0, 8);
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
            {(group || language) && (
              <Button
                variant="ghost"
                onClick={() => {
                  setGroup("");
                  setLanguage("");
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

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
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
            <Card>
              <CardHeader>
                <CardTitle>
                  <h2>Evaluation coverage</h2>
                </CardTitle>
                <CardDescription>Evaluated conversations by language</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-6">
                  <div className="relative shrink-0">
                    <ChartContainer
                      config={coverageChartConfig}
                      className="size-36 aspect-square"
                      initialDimension={{ width: 144, height: 144 }}
                      aria-hidden="true"
                    >
                      <PieChart accessibilityLayer={false}>
                        <Pie
                          data={coverageSegments}
                          dataKey="value"
                          innerRadius={55}
                          outerRadius={65}
                          startAngle={90}
                          endAngle={-270}
                          stroke="none"
                          isAnimationActive={false}
                        />
                      </PieChart>
                    </ChartContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-semibold tabular-nums">{coverage}%</span>
                      <span className="text-xs text-muted-foreground">evaluated</span>
                    </div>
                  </div>
                  <dl className="min-w-40 flex-1 divide-y">
                    {Object.entries(languageName)
                      .filter(([code]) => !language || code === language)
                      .map(([code, name]) => {
                        const items = conversations.filter((item) => item.language === code);
                        return (
                          <div key={code} className="flex justify-between gap-3 py-3 text-sm">
                            <dt>{name}</dt>
                            <dd className="font-medium tabular-nums">
                              {items.filter((item) => item.evaluation).length} / {items.length}
                            </dd>
                          </div>
                        );
                      })}
                  </dl>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  Awaiting evaluation: {conversations.length - evaluated.length}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                <h2>{reviewOnly ? "Needs review" : "Latest evaluations"}</h2>
              </CardTitle>
              <CardDescription>
                {reviewOnly
                  ? "Serious violations and unresolved appeals"
                  : "Up to eight conversations, ordered by their latest evaluation"}
              </CardDescription>
              <CardAction>
                <Toggle
                  size="sm"
                  variant="outline"
                  pressed={reviewOnly}
                  onPressedChange={setReviewOnly}
                >
                  Needs review ({attention.length})
                </Toggle>
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
        </>
      )}
    </>
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
          <TableHead scope="col">Review</TableHead>
          <TableHead scope="col">Evaluated</TableHead>
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
            <TableCell>
              <span className="text-xs whitespace-nowrap text-muted-foreground">
                {item.evaluation && dateLabel(item.evaluation.createdAt)}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
