import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, test } from "vite-plus/test";
import { defaultChecklist } from "../../apps/api/src/checklist.ts";
import { fakeLlm, invalid, valid, type Step } from "./fake-llm.ts";
import { main, promptFingerprint } from "./run.ts";
import { tempDir } from "./test-helpers.ts";

const fingerprint = promptFingerprint();

function runCli(argv: string[], steps: Step[] = [valid]) {
  const fake = fakeLlm(steps);
  const lines: string[] = [];
  const result = main(argv, {
    createClient: () => fake.llm,
    log: (line) => lines.push(line),
    retry: { tries: 2, baseMs: 0 },
  });
  return { result, fake, lines };
}

function priorRun(dir: string, promptVersion: string, failedRun: Record<string, unknown>) {
  const path = `${dir}/prior.json`;
  writeFileSync(
    path,
    JSON.stringify({
      promptVersion,
      provider: "hf-router",
      model: "fake",
      set: "p1-ru-003,p1-ru-007",
      samples: 1,
      temperature: 0,
      dialogs: [
        { conversationId: "p1-ru-003", ratings: [{ criterionId: "opening" }], total: 90, run: {} },
        { conversationId: "p1-ru-007", ratings: [], total: null, run: failedRun },
      ],
    }),
  );
  return path;
}

const failedPass = {
  requests: 2,
  responses: 2,
  parsedResponses: 0,
  responsesWithoutUsage: 0,
  usage: { promptTokens: 200, completionTokens: 100 },
  costUsd: 0.000347,
  latencyMs: 1200,
  failedSamples: 1,
  errors: ["opening: missing. Rate every criterion."],
};

describe("run.ts with a fake model", () => {
  test("the prompt version comes from the current code", () => {
    expect(fingerprint.promptVersion).toMatch(/^p-[0-9a-f]{8}$/);
    expect(Object.keys(fingerprint.sources)).toEqual(
      expect.arrayContaining(["apps/api/src/inference/prompt.ts", "defaultChecklist"]),
    );
  });

  test("held-out dialogs run with a matching --frozen version", async () => {
    const dir = tempDir();
    const { result } = runCli([
      "--set",
      "p1-en-001",
      "--frozen",
      fingerprint.promptVersion,
      "--out",
      dir,
      "--name",
      "t",
    ]);
    await expect(result).resolves.toBe(0);
    const run = JSON.parse(readFileSync(`${dir}/t.json`, "utf8"));
    expect(run.promptVersion).toBe(fingerprint.promptVersion);
    expect(run.provenance).toMatchObject({
      sources: fingerprint.sources,
      frozen: fingerprint.promptVersion,
    });
    expect(run.dialogs[0].ratings).toHaveLength(defaultChecklist.criteria.length);
  });

  test("held-out dialogs are refused without --frozen", async () => {
    const dir = tempDir();
    await expect(runCli(["--set", "p1-en-001", "--out", dir]).result).rejects.toThrow(/held-out/);
  });

  test("a --frozen version that is not the current one is refused", async () => {
    const dir = tempDir();
    const { result, fake } = runCli(["--set", "p1-en-001", "--frozen", "p-00000000", "--out", dir]);
    await expect(result).rejects.toThrow(/does not match the current prompt version/);
    expect(fake.calls()).toBe(0);
  });

  test("a changed prompt cannot resume an old run, even with the old version as --frozen", async () => {
    const dir = tempDir();
    const path = priorRun(dir, "p-0ldc0de0", { ...failedPass, passes: [failedPass] });
    const before = readFileSync(path, "utf8");
    for (const argv of [
      ["--rerun-failed", path],
      ["--rerun-failed", path, "--frozen", "p-0ldc0de0"],
    ]) {
      const { result, fake } = runCli(argv);
      await expect(result).rejects.toThrow(/p-0ldc0de0/);
      expect(fake.calls()).toBe(0);
    }
    expect(readFileSync(path, "utf8")).toBe(before);
  });

  test("recovering a failed dialog keeps the cost of its failed attempts", async () => {
    const dir = tempDir();
    const path = priorRun(dir, fingerprint.promptVersion, { ...failedPass, passes: [failedPass] });
    const { result, lines } = runCli(["--rerun-failed", path]);
    await expect(result).resolves.toBe(0);
    expect(lines[0]).toMatch(/^1 dialog\(s\)/);
    const run = JSON.parse(readFileSync(path, "utf8"));
    const [kept, recovered] = run.dialogs;
    expect(kept).toMatchObject({ conversationId: "p1-ru-003", total: 90 });
    expect(recovered.ratings).toHaveLength(defaultChecklist.criteria.length);
    expect(recovered.run.passes).toHaveLength(2);
    expect(recovered.run.passes[0]).toEqual(failedPass);
    expect(recovered.run).toMatchObject({
      requests: 3,
      responses: 3,
      parsedResponses: 1,
      usage: { promptTokens: 300, completionTokens: 150 },
      failedSamples: 0,
      errors: [],
    });
    expect(recovered.run.costUsd).toBeGreaterThan(failedPass.costUsd);
  });

  test("recovering a dialog from an older run file keeps its pass", async () => {
    const dir = tempDir();
    const legacy = {
      latencyMs: 800,
      usage: { promptTokens: 0, completionTokens: 0 },
      costUsd: 0,
      failedSamples: 1,
      calls: 2,
      errors: ["bad"],
    };
    const path = priorRun(dir, fingerprint.promptVersion, legacy);
    await expect(runCli(["--rerun-failed", path]).result).resolves.toBe(0);
    const recovered = JSON.parse(readFileSync(path, "utf8")).dialogs[1];
    expect(recovered.run.passes).toHaveLength(2);
    expect(recovered.run).toMatchObject({ requests: 3, responsesWithoutUsage: 2 });
  });

  test("a dialog that fails again still adds its attempts", async () => {
    const dir = tempDir();
    const path = priorRun(dir, fingerprint.promptVersion, { ...failedPass, passes: [failedPass] });
    await expect(runCli(["--rerun-failed", path], [invalid]).result).resolves.toBe(0);
    const recovered = JSON.parse(readFileSync(path, "utf8")).dialogs[1];
    expect(recovered.ratings).toEqual([]);
    expect(recovered.run).toMatchObject({
      requests: 4,
      usage: { promptTokens: 400, completionTokens: 200 },
      failedSamples: 1,
    });
  });
});
