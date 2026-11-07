import { createFileRoute } from "@tanstack/react-router";
import { AppealQueue } from "@/components/cqa/appeal-queue";

export const Route = createFileRoute("/appeals")({ component: AppealQueue });
