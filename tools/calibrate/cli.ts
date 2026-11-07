// Shared plumbing for the calibration commands: argument parsing, CSV files, and number
// formatting that matches the earlier Python reports.

import { readFileSync, writeFileSync } from "node:fs";
import { parse } from "csv-parse/sync";

export type Io = { out: (line: string) => void; err: (line: string) => void };
export const consoleIo: Io = {
  out: (line) => console.log(line),
  err: (line) => console.error(line),
};

export class UsageError extends Error {}

type OptionSpec = { type: "string" | "boolean" | "list"; default?: string | string[] };
type Parsed<S extends Record<string, OptionSpec>> = {
  [K in keyof S]: S[K]["type"] extends "boolean"
    ? boolean
    : S[K]["type"] extends "list"
      ? string[] | undefined
      : string | undefined;
};

/**
 * Parses `--name value`, `--name=value`, boolean flags, and list options that take every
 * following non-option argument (`--labels a.csv b.csv`). Other arguments are positionals.
 */
export function parseCli<S extends Record<string, OptionSpec>>(
  argv: string[],
  spec: S,
): { options: Parsed<S>; positionals: string[] } {
  const options: Record<string, unknown> = {};
  for (const [name, s] of Object.entries(spec)) {
    options[name] = s.type === "boolean" ? false : s.default;
  }
  const positionals: string[] = [];
  let list: string[] | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      if (list) list.push(arg);
      else positionals.push(arg);
      continue;
    }
    list = undefined;
    const eq = arg.indexOf("=");
    const name = arg.slice(2, eq === -1 ? undefined : eq);
    const s = spec[name];
    if (!s) throw new UsageError(`unrecognized option --${name}`);
    if (s.type === "boolean") {
      if (eq !== -1) throw new UsageError(`--${name} takes no value`);
      options[name] = true;
    } else if (s.type === "list") {
      list = eq === -1 ? [] : [arg.slice(eq + 1)];
      options[name] = list;
    } else {
      const value = eq === -1 ? argv[++i] : arg.slice(eq + 1);
      if (value === undefined || (eq === -1 && value.startsWith("--"))) {
        throw new UsageError(`--${name} needs a value`);
      }
      options[name] = value;
    }
  }
  for (const [name, s] of Object.entries(spec)) {
    if (s.type === "list" && Array.isArray(options[name]) && !(options[name] as []).length) {
      throw new UsageError(`--${name} needs at least one value`);
    }
  }
  return { options: options as Parsed<S>, positionals };
}

export function required<T>(value: T | undefined, name: string): T {
  if (value === undefined) throw new UsageError(`--${name} is required`);
  return value;
}

/** Runs a command's main, turning usage errors into exit status 2. */
export function runMain(main: (argv: string[], io: Io) => number | Promise<number>) {
  void (async () => {
    try {
      process.exitCode = await main(process.argv.slice(2), consoleIo);
    } catch (error) {
      if (!(error instanceof UsageError)) throw error;
      console.error(`error: ${error.message}`);
      process.exitCode = 2;
    }
  })();
}

export function loadJson<T = any>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * Reads a CSV file with a header row into objects. Strips a BOM, handles quoted commas,
 * escaped quotes, multiline fields, and mixed line endings, and skips blank lines. Short rows leave the missing
 * columns empty and extra unnamed fields are dropped. Values are returned untrimmed.
 */
export function readCsv(path: string): Record<string, string>[] {
  const rows: string[][] = parse(readFileSync(path, "utf8"), {
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
    // Accept any line ending, mixed within one file, as Python's csv module does.
    record_delimiter: ["\r\n", "\n", "\r"],
  });
  const [header = [], ...body] = rows;
  return body.map((fields) =>
    Object.fromEntries(header.map((name, i) => [name, fields[i] ?? ""] as const)),
  );
}

export type CsvValue = string | number | null | undefined;

function csvField(value: CsvValue): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Writes CSV with minimal quoting and CRLF line ends, like Python's csv.writer. */
export function writeCsv(path: string, columns: string[], rows: CsvValue[][]) {
  const lines = [columns, ...rows].map((row) =>
    row.length === 1 && row[0] === "" ? '""' : row.map(csvField).join(","),
  );
  writeFileSync(path, lines.map((line) => `${line}\r\n`).join(""), "utf8");
}

/** Rounds half to even at exact ties, like Python's round() and format(). */
export function fixed(x: number, digits: number): string {
  const scaled = x * 10 ** digits;
  if (Number.isInteger(scaled * 2) && !Number.isInteger(scaled)) {
    const floor = Math.floor(scaled);
    return ((floor % 2 === 0 ? floor : floor + 1) / 10 ** digits).toFixed(digits);
  }
  return x.toFixed(digits);
}

export function round(x: number, digits: number): number {
  return Number(fixed(x, digits));
}

/**
 * Python 3.12's sum(): compensated (Neumaier) summation for floats, plain addition for ints.
 * Values read from JSON that are whole numbers were ints in Python unless allFloats is set.
 */
export function pySum(xs: number[], allFloats = false): number {
  const isInt = (x: number) => !allFloats && Number.isInteger(x);
  let i = 0;
  let f = 0;
  for (; i < xs.length && isInt(xs[i]); i++) f += xs[i];
  let c = 0;
  for (; i < xs.length; i++) {
    const x = xs[i];
    if (isInt(x)) {
      f += x;
      continue;
    }
    const t = f + x;
    c += Math.abs(f) >= Math.abs(x) ? f - t + x : x - t + f;
    f = t;
  }
  return c && Number.isFinite(c) ? f + c : f;
}

/** Python's str() of a float: whole numbers keep a ".0". */
export function pyFloat(x: number | null | undefined): string {
  if (x === null || x === undefined) return "None";
  return Number.isInteger(x) ? `${x}.0` : String(x);
}

/** Python's str() of a value read from JSON, where whole numbers are ints. */
export function pyStr(x: unknown): string {
  if (x === null || x === undefined) return "None";
  if (typeof x === "boolean") return x ? "True" : "False";
  if (typeof x === "object") return JSON.stringify(x);
  return String(x as string | number);
}

/** Python's repr() for the strings, numbers, and tuples used in error messages. */
export function pyRepr(x: unknown): string {
  if (Array.isArray(x)) return `(${x.map(pyRepr).join(", ")})`;
  if (typeof x === "string") return x.includes("'") && !x.includes('"') ? `"${x}"` : `'${x}'`;
  return pyStr(x);
}

/** Sorted copy, numbers first in numeric order, then strings in text order. */
export function sortAnswers<T>(values: Iterable<T>): T[] {
  const key = (v: T) => String(v);
  return [...values].sort((a, b) => {
    const [x, y] = [key(a), key(b)];
    const [dx, dy] = [/^\d+$/.test(x), /^\d+$/.test(y)];
    if (dx && dy) return Number(x) - Number(y);
    if (dx !== dy) return dx ? -1 : 1;
    return x < y ? -1 : x > y ? 1 : 0;
  });
}
