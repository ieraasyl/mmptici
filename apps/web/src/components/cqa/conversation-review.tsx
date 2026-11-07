import { Badge } from "@/components/ui/badge";
import { cn } from "cn";

export function ConversationReview({
  seriousViolation,
  pendingAppeals,
  className,
}: {
  seriousViolation: boolean;
  pendingAppeals: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {seriousViolation && <Badge variant="destructive">Serious violation</Badge>}
      {pendingAppeals > 0 && (
        <Badge variant="outline">
          {pendingAppeals} pending {pendingAppeals === 1 ? "appeal" : "appeals"}
        </Badge>
      )}
      {!seriousViolation && pendingAppeals === 0 && (
        <span className="text-muted-foreground">No flags</span>
      )}
    </div>
  );
}
