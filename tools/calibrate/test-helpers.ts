// Shared helpers for the calibration tests.

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import { onTestFinished } from "vite-plus/test";
import type { Io } from "./cli.ts";

export const FIXTURES = fileURLToPath(new URL("./tests/fixtures/", import.meta.url));

/** A temporary directory removed when the current test finishes. */
export function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), "calibrate-"));
  onTestFinished(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

export function capture() {
  const out: string[] = [];
  const err: string[] = [];
  const io: Io = { out: (line) => out.push(line), err: (line) => err.push(line) };
  return { io, out, err, text: () => out.join("\n"), errText: () => err.join("\n") };
}

/** CSV rows as objects keyed by the header. */
export function csvRows(path: string): Record<string, string>[] {
  return parse(readFileSync(path, "utf8"), { bom: true, columns: true });
}
