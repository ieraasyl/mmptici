import { createFileRoute } from "@tanstack/react-router";
import { ConversationList } from "@/components/cqa/conversation-list";

export const Route = createFileRoute("/")({ component: ConversationList });
