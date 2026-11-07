import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/cqa/dashboard";

export const Route = createFileRoute("/dashboard")({ component: Dashboard });
