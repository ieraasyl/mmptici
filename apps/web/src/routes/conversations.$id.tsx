import { createFileRoute } from "@tanstack/react-router";
import { ConversationDetail } from "@/components/cqa/conversation-detail";

export const Route = createFileRoute("/conversations/$id")({
  validateSearch: (search: Record<string, unknown>): { evaluation?: string } => ({
    evaluation: typeof search.evaluation === "string" ? search.evaluation : undefined,
  }),
  component: ConversationPage,
});

function ConversationPage() {
  const { id } = Route.useParams();
  const { evaluation } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <ConversationDetail
      key={id}
      id={id}
      selectedEvaluation={evaluation}
      onSelectEvaluation={(value) => {
        void navigate({ search: { evaluation: value }, hash: "", resetScroll: false });
      }}
    />
  );
}
