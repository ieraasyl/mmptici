import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const binWidth = 5;
const scoreTicks = [0, 25, 50, 75, 100];
const chartConfig = { count: { label: "Conversations", color: "var(--primary)" } };

export function ScoreDistribution({ scores }: { scores: number[] }) {
  const bins = Array.from({ length: 100 / binWidth }, (_, index) => {
    const start = index * binWidth;
    const end = start + binWidth;
    return {
      label: end === 100 ? `${start}% to 100%` : `${start}% to under ${end}%`,
      count: 0,
    };
  });
  for (const score of scores) {
    const index = Math.min(Math.floor(score / binWidth), bins.length - 1);
    bins[index]!.count += 1;
  }

  return (
    <section
      className="flex min-w-0 flex-col gap-3 xl:col-span-3"
      aria-labelledby="distribution-heading"
    >
      <h2 id="distribution-heading" className="text-base font-medium">
        Score distribution
      </h2>
      {scores.length ? (
        <>
          <div className="flex flex-1 flex-col rounded-md border">
            <p className="rounded-t-md border-b bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground">
              {scores.length} scored {scores.length === 1 ? "conversation" : "conversations"}
            </p>
            <div className="flex flex-1 flex-col gap-2 px-5 py-4">
              <p className="text-xs text-muted-foreground">Conversations</p>
              <div className="relative min-h-52 flex-1 overflow-clip focus-within:ring-2 focus-within:ring-ring">
                <ChartContainer config={chartConfig} className="absolute inset-0 aspect-auto">
                  <BarChart
                    data={bins}
                    barCategoryGap={1}
                    margin={{ top: 8, right: 0, bottom: 8, left: 0 }}
                    title="Conversation counts by score range"
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" hide />
                    <YAxis
                      width={32}
                      allowDecimals={false}
                      interval={0}
                      tickLine={false}
                      axisLine={false}
                    />
                    <ChartTooltip content={<ChartTooltipContent hideIndicator />} />
                    <Bar dataKey="count" fill="var(--color-count)" isAnimationActive={false} />
                  </BarChart>
                </ChartContainer>
              </div>
              <div
                className="ml-8 flex justify-between text-xs text-muted-foreground tabular-nums"
                aria-hidden="true"
              >
                {scoreTicks.map((score) => (
                  <span key={score} className="flex w-0 justify-center">
                    {score}%
                  </span>
                ))}
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Scores are grouped in 5-point intervals.</p>
        </>
      ) : (
        <p className="py-8 text-sm text-muted-foreground">
          No numeric scores. N/A totals are excluded.
        </p>
      )}
    </section>
  );
}
