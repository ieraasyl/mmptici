import type { ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon, InboxIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";

export function PageHeading({
  title,
  children,
  actions,
}: {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{title}</h1>
        {children && <p className="text-sm text-muted-foreground">{children}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function ErrorMessage({ error, retry }: { error: Error; retry?: () => void }) {
  return (
    <Alert variant="destructive">
      <HugeiconsIcon icon={AlertCircleIcon} aria-hidden="true" />
      <AlertDescription>{error.message}</AlertDescription>
      {retry && (
        <AlertAction>
          <Button size="sm" variant="outline" onClick={retry}>
            Retry
          </Button>
        </AlertAction>
      )}
    </Alert>
  );
}

export function StatusMessage({ children }: { children: ReactNode }) {
  return (
    <Alert role="status">
      <HugeiconsIcon icon={Tick02Icon} aria-hidden="true" />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={InboxIcon} aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>
          <h2>{title}</h2>
        </EmptyTitle>
        <EmptyDescription>{children}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export function Loading({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 p-5 text-sm text-muted-foreground" role="status">
      <Spinner aria-hidden="true" /> {children}
    </p>
  );
}
