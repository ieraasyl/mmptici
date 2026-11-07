import { createFileRoute } from "@tanstack/react-router";
import { ChecklistEditor } from "@/components/cqa/checklist-editor";

export const Route = createFileRoute("/checklists")({ component: ChecklistEditor });
