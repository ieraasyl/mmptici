import {
  AnalyticsUpIcon,
  Chat01Icon,
  CheckListIcon,
  JusticeScale01Icon,
} from "@hugeicons/core-free-icons";

export const workspaceDestinations = [
  { to: "/dashboard", label: "Dashboard", icon: AnalyticsUpIcon },
  { to: "/", label: "Conversations", icon: Chat01Icon },
  { to: "/checklists", label: "Checklists", icon: CheckListIcon },
  { to: "/appeals", label: "Appeals", icon: JusticeScale01Icon },
] as const;

export function workspaceDestinationIndex(pathname: string) {
  const path = pathname.replace(/\/+$/, "") || "/";
  return workspaceDestinations.findIndex(
    ({ to }) => path === to || (to === "/" && path.startsWith("/conversations/")),
  );
}
