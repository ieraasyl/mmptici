import {
  createRootRoute,
  Link,
  Outlet,
  useRouter,
  useRouterState,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import { EmptyState, ErrorMessage } from "@/components/cqa/ui";
import { appealsQuery } from "@/lib/cqa";
import { workspaceDestinationIndex, workspaceDestinations } from "@/lib/workspace-navigation";

export const Route = createRootRoute({
  component: WorkspaceLayout,
  notFoundComponent: NotFound,
  errorComponent: RouteError,
});

function WorkspaceLayout() {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-10 focus:bg-background focus:p-3"
      >
        Skip to content
      </a>
      <WorkspaceHeader />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-7xl min-w-0 space-y-6 p-4 max-sm:pb-(--workspace-nav-clearance) sm:p-6 lg:p-8"
      >
        <Outlet />
      </main>
    </>
  );
}

function WorkspaceHeader() {
  const { data: pendingAppealCount = 0 } = useQuery({
    ...appealsQuery,
    select: ({ appeals }) => appeals.filter(({ decision }) => !decision).length,
  });
  const { activeIndex, isConversationDetail } = useRouterState({
    select: ({ location, resolvedLocation }) => ({
      activeIndex: workspaceDestinationIndex((resolvedLocation ?? location).pathname),
      isConversationDetail: location.pathname.startsWith("/conversations/"),
    }),
    structuralSharing: true,
  });

  return (
    <header className="flex justify-center px-2 max-sm:pointer-events-none max-sm:fixed max-sm:inset-x-0 max-sm:bottom-(--workspace-nav-bottom) max-sm:z-20 sm:pt-6">
      <NavigationMenu aria-label="Workspace" className="pointer-events-auto">
        <NavigationMenuList className="justify-center sm:flex-wrap">
          {workspaceDestinations.map(({ to, label, icon }, index) => {
            const showPending = to === "/appeals" && pendingAppealCount > 0;
            return (
              <NavigationMenuItem key={to}>
                <NavigationMenuLink
                  active={index === activeIndex}
                  aria-current={to === "/" && isConversationDetail ? "page" : undefined}
                  aria-label={showPending ? `${label}, ${pendingAppealCount} pending` : undefined}
                  render={<Link to={to} activeOptions={{ exact: true }} />}
                >
                  <HugeiconsIcon
                    icon={icon}
                    className="size-5 sm:size-4 sm:max-md:hidden"
                    aria-hidden="true"
                  />
                  <span className="max-sm:sr-only">{label}</span>
                  {showPending && (
                    <Badge variant="secondary" aria-hidden="true" className="hidden sm:inline-flex">
                      {pendingAppealCount}
                    </Badge>
                  )}
                </NavigationMenuLink>
              </NavigationMenuItem>
            );
          })}
        </NavigationMenuList>
      </NavigationMenu>
    </header>
  );
}

function NotFound() {
  return (
    <>
      <EmptyState title="Page not found">This page may have moved.</EmptyState>
      <Link to="/" className="text-sm font-medium text-primary underline">
        Back to conversations
      </Link>
    </>
  );
}

function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <ErrorMessage
      error={error instanceof Error ? error : new Error("Could not load this page.")}
      retry={() => {
        void router.invalidate().then(reset);
      }}
    />
  );
}
