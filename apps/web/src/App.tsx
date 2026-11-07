import { useState } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { request } from "@/lib/request";
import { createAppRouter } from "@/router";

function Workspace({ router }: { router: ReturnType<typeof createAppRouter> }) {
  const workspace = useQuery({
    queryKey: ["workspace"],
    queryFn: ({ signal }) => request((init) => api.cqa.workspace.$get({}, { init }), { signal }),
    staleTime: Infinity,
  });

  if (workspace.isPending)
    return (
      <main className="p-8" role="status">
        Opening workspace…
      </main>
    );
  if (workspace.isError)
    return (
      <main className="space-y-3 p-8">
        <p role="alert">{workspace.error.message}</p>
        <Button onClick={() => void workspace.refetch()}>Retry</Button>
      </main>
    );

  return <RouterProvider router={router} />;
}

export default function App() {
  const [router] = useState(createAppRouter);
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, retry: false },
          mutations: { retry: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <Workspace router={router} />
    </QueryClientProvider>
  );
}
