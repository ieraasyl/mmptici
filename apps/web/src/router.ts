import { createRouter } from "@tanstack/react-router";
import { workspaceDestinationIndex } from "./lib/workspace-navigation";
import { routeTree } from "./routeTree.gen";

export function createAppRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultViewTransition: {
      types: ({ fromLocation, toLocation, pathChanged }) => {
        if (
          !fromLocation ||
          !pathChanged ||
          window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
          return false;
        }

        const from = workspaceDestinationIndex(fromLocation.pathname);
        const to = workspaceDestinationIndex(toLocation.pathname);
        if (from < 0 || to < 0 || from === to) return [];
        return [from < to ? "slide-from-right" : "slide-from-left"];
      },
    },
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
