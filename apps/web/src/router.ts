import { createRouter, trimPathRight, type ParsedLocation } from "@tanstack/react-router";
import { workspaceDestinationIndex } from "./lib/workspace-navigation";
import { routeTree } from "./routeTree.gen";

type ViewTransitionScope = HTMLElement & {
  startViewTransition?: (options: {
    update: () => Promise<void>;
    types: string[];
  }) => ViewTransition;
};

function isAppealReview({ pathname, search }: ParsedLocation<{ appeal?: unknown }>) {
  return (
    trimPathRight(pathname) === "/appeals" &&
    typeof search.appeal === "string" &&
    search.appeal.length > 0
  );
}

export function createAppRouter() {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
  });

  // Wrap the router's route commit so only the main content participates in the transition.
  router.startViewTransition = (update) => {
    const enabled = router.shouldViewTransition !== false;
    router.shouldViewTransition = undefined;
    const fromLocation = router.state.resolvedLocation;
    const toLocation = router.latestLocation;

    if (
      !enabled ||
      !fromLocation ||
      fromLocation.pathname === toLocation.pathname ||
      isAppealReview(fromLocation) ||
      isAppealReview(toLocation) ||
      typeof document === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return update();
    }

    const main = document.querySelector<ViewTransitionScope>("#main-content");
    if (!main?.startViewTransition) return update();

    const from = workspaceDestinationIndex(fromLocation.pathname);
    const to = workspaceDestinationIndex(toLocation.pathname);
    const types =
      from < 0 || to < 0 || from === to ? [] : [from < to ? "slide-from-right" : "slide-from-left"];
    const transition = main.startViewTransition({ update, types });
    // A second navigation can skip an active animation.
    void transition.ready.catch(() => {});
    return transition.updateCallbackDone;
  };

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
