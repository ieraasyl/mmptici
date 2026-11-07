import { useSyncExternalStore } from "react";

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
