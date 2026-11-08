import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { checklistsQuery } from "./cqa";

// The checklist picked for new evaluations, shared by the conversation list and the conversation page
// and kept across navigation. Per-browser convenience only: an id that no longer exists falls back to
// the default checklist where it is read.
const key = "cqa.selectedChecklist";
const listeners = new Set<() => void>();
let memory = "";

function read() {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function selectChecklist(id: string) {
  try {
    localStorage.setItem(key, id);
  } catch {
    // Storage can be unavailable (private mode); the choice then lasts until the page reloads.
    memory = id;
  }
  for (const listener of listeners) listener();
}

export function useSelectedChecklist() {
  return useSyncExternalStore(
    subscribe,
    () => read() || memory,
    () => "",
  );
}

/** The checklist used for new runs and for the scores shown in the conversation list. */
export function useActiveChecklist() {
  const checklists = useQuery(checklistsQuery);
  const selected = useSelectedChecklist();
  const items =
    checklists.data?.checklists.map(({ id, name, revision }) => ({
      value: id,
      label: `${name} · v${revision}`,
      revision,
    })) ?? [];
  const active =
    items.find(({ value }) => value === selected) ??
    items.find(({ value }) => value === checklists.data?.defaultId);
  return { items, id: active?.value ?? "", label: active?.label ?? "", revision: active?.revision };
}
