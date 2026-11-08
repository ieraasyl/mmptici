import { Link } from "@tanstack/react-router";
import type { dashboardExplanations } from "@/lib/dashboard";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { FailureDetails } from "./dashboard-evidence";

export function DashboardExplanations({
  groups,
  scope,
}: {
  groups: NonNullable<ReturnType<typeof dashboardExplanations>>;
  scope: string;
}) {
  const count = groups.length;

  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" disabled={!count} />}>
        View explanations
      </SheetTrigger>
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Failure explanations</SheetTitle>
          <SheetDescription>
            {scope} · {count} {count === 1 ? "conversation" : "conversations"}
          </SheetDescription>
        </SheetHeader>
        <ul className="min-h-0 flex-1 divide-y overflow-y-auto px-6">
          {groups.map(({ conversation, failures }) => (
            <li key={conversation.evaluation?.id ?? conversation.id} className="space-y-4 py-4">
              <h3 className="font-medium wrap-anywhere">
                <Link
                  to="/conversations/$id"
                  params={{ id: conversation.id }}
                  search={{ evaluation: conversation.evaluation?.id }}
                  className="underline underline-offset-4"
                >
                  {conversation.sourceId}
                </Link>
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {conversation.group}
                </span>
              </h3>
              <ul className="space-y-4">
                {failures.map((failure) => (
                  <li key={failure.criterionId}>
                    <FailureDetails
                      conversation={conversation}
                      failure={failure}
                      headingLevel={4}
                    />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
