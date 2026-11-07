import { describe, expect, test } from "vite-plus/test";
import { loadJson } from "./cli.ts";
import { DEFAULT_DATA, DEFAULT_SETS, loadRecords } from "./labels.ts";

type SetsFile = {
  tuning: string[];
  heldout: string[];
  unassigned: string[];
  families: Record<string, string>;
  assignments: Record<string, { primary: string[]; second: string[] }>;
};

const sets = loadJson<SetsFile>(DEFAULT_SETS);
const records = new Map(loadRecords(DEFAULT_DATA).map((r) => [r.conversation_id, r]));
const all20 = [...sets.tuning, ...sets.heldout];
const count = (xs: string[]) => {
  const m: Record<string, number> = {};
  for (const x of xs) m[x] = (m[x] ?? 0) + 1;
  return m;
};

describe("labeling sets", () => {
  test("sizes and no overlap", () => {
    expect([sets.tuning.length, sets.heldout.length]).toEqual([14, 6]);
    expect(new Set(all20).size).toBe(20);
  });

  test("IDs exist in the dataset", () => {
    for (const id of all20) expect(records.has(id), id).toBe(true);
  });

  test("language and channel mix", () => {
    const recs = all20.map((id) => records.get(id)!);
    expect(count(recs.filter((r) => r.channel === "agent chat").map((r) => r.language))).toEqual({
      RU: 7,
      KZ: 5,
      EN: 5,
    });
    expect(recs.filter((r) => r.channel === "voice call")).toHaveLength(3);
  });

  test("families do not cross the tuning/held-out split", () => {
    for (const id of all20) expect(sets.families, id).toHaveProperty(id);
    const tuning = new Set(sets.tuning.map((id) => sets.families[id]));
    expect(sets.heldout.filter((id) => tuning.has(sets.families[id]))).toEqual([]);
  });

  test("assignments", () => {
    const asg = Object.entries(sets.assignments);
    const primaries = count(asg.flatMap(([, a]) => a.primary));
    for (const id of sets.tuning) expect(primaries[id], id).toBe(1);
    const seconds = asg.flatMap(([labeler, a]) => a.second.map((id) => [id, labeler] as const));
    expect(seconds).toHaveLength(10);
    for (const [id, labeler] of seconds) {
      expect(sets.tuning).toContain(id);
      expect(sets.assignments[labeler].primary).not.toContain(id);
    }
    const secondIds = seconds.map(([id]) => id);
    for (const id of sets.heldout) {
      expect(secondIds).not.toContain(id);
      expect((primaries[id] ?? 0) + Number(sets.unassigned.includes(id)), id).toBe(1);
    }
  });
});
