import { createFileRoute } from "@tanstack/react-router";
import { AppealQueue } from "@/components/cqa/appeal-queue";

type AppealSearch = { appeal?: string; status?: "resolved" };

export const Route = createFileRoute("/appeals")({
  validateSearch: (search: Record<string, unknown>): AppealSearch => ({
    appeal: typeof search.appeal === "string" ? search.appeal : undefined,
    status: search.status === "resolved" ? search.status : undefined,
  }),
  component: AppealsPage,
});

function AppealsPage() {
  const { appeal, status } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <AppealQueue
      appealId={appeal}
      resolved={status === "resolved"}
      onChange={(appeal, resolved) => {
        void navigate({
          search: { appeal, status: resolved ? "resolved" : undefined },
          replace: true,
          resetScroll: false,
        });
      }}
    />
  );
}
