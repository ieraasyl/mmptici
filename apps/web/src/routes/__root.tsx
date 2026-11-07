import {
  createRootRoute,
  Link,
  Outlet,
  useRouter,
  useLocation,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AnalyticsUpIcon,
  CheckListIcon,
  Chat01Icon,
  JusticeScale01Icon,
} from "@hugeicons/core-free-icons";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useSidebar } from "@/hooks/use-sidebar";
import { EmptyState, ErrorMessage } from "@/components/cqa/ui";

export const Route = createRootRoute({
  component: WorkspaceLayout,
  notFoundComponent: NotFound,
  errorComponent: RouteError,
});

const destinations = [
  { to: "/", label: "Conversations", icon: Chat01Icon },
  { to: "/checklists", label: "Checklists", icon: CheckListIcon },
  { to: "/appeals", label: "Appeals", icon: JusticeScale01Icon },
] as const;

function WorkspaceLayout() {
  return (
    <SidebarProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-10 focus:bg-background focus:p-3"
      >
        Skip to content
      </a>
      <WorkspaceSidebar />
      <SidebarInset id="main-content" className="min-w-0">
        <header className="flex items-center gap-2 border-b p-3">
          <SidebarTrigger aria-label="Toggle navigation" />
          <span className="text-sm font-medium md:hidden">Conversation QA</span>
        </header>
        <div className="mx-auto w-full max-w-7xl min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function WorkspaceSidebar() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link to="/" onClick={() => setOpenMobile(false)} />}
            >
              <HugeiconsIcon icon={AnalyticsUpIcon} aria-hidden="true" />
              <span className="flex flex-col">
                <span className="font-semibold">Conversation QA</span>
                <span className="text-xs text-muted-foreground">Freedom Broker</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <nav aria-label="Workspace">
              <SidebarMenu>
                {destinations.map(({ to, label, icon }) => (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton
                      isActive={
                        pathname === to || (to === "/" && pathname.startsWith("/conversations/"))
                      }
                      render={
                        <Link
                          to={to}
                          activeOptions={{ exact: true }}
                          onClick={() => setOpenMobile(false)}
                        />
                      }
                    >
                      <HugeiconsIcon icon={icon} aria-hidden="true" />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <span className="p-2 text-xs text-muted-foreground">Demo workspace</span>
      </SidebarFooter>
    </Sidebar>
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
