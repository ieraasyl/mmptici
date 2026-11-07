# ML B plan: calibration, labeling, local mode

ML B measures how well the evaluator agrees with human judgment, finds out why it disagrees, and gives ML A the evidence to fix it. ML B also connects the self-hosted Qwen endpoints as a second provider. Task IDs match [CQA_ARCHITECTURE.md](CQA_ARCHITECTURE.md).

ML B does not write prompts. Prompt changes belong to ML A. ML B decides whether a change is accepted.

## Deliverables

| Item                  | Path                                                                  | Used by                           |
| --------------------- | --------------------------------------------------------------------- | --------------------------------- |
| Labeling guide        | `docs/LABELING_GUIDE.md`                                              | All labelers, ML A for the prompt |
| Dialog printer        | `tools/calibrate/print-dialogs.ts` (`vp run calibrate:print`)         | Labelers                          |
| Labels                | `tools/calibrate/labels/labels.csv`                                   | Calibration                       |
| Run script            | `tools/calibrate/run.ts`, output in `tools/calibrate/runs/` (ignored) | Calibration                       |
| Scoring and metrics   | `tools/calibrate/compare.ts` (`vp run calibrate:compare`)             | Calibration                       |
| Reports               | `tools/calibrate/reports/<date>-<prompt>-<provider>.md` and `.json`   | ML A, Fullstack calibration page  |
| Local provider config | `apps/api/.dev.vars` and Worker secrets, values given to Fullstack    | ML A, Fullstack                   |

Labels and aggregate reports are our own work, so they are committed. They become the proof of process in the demo. Reports hold metrics, confusion tables, and mismatches as dialog IDs and answers only.

Raw model outputs, explanations, and cited turn text stay in `tools/calibrate/runs/`, which git ignores. The DEV dataset is read from `data/invoke.json`, which is tracked on main. The control set and any new organizer dataset go only through the app, never into `tools/calibrate`.

## Fixed inputs

Criterion IDs come from the default checklist on main: `opening`, `understanding`, `verification`, `guidance`, `empathy`, `management`, `closing`, `violations`.

Turn numbers are 1-based. This matches the app's evidence links.

### The 20 labeled dialogs

Each scenario family sits entirely in one split, so a prompt tuned on the Russian version of a scenario cannot leak into the held-out set through its Kazakh twin.

**Tuning set, 14 dialogs**

| Dialog    | Family                          | Why it is in                                     |
| --------- | ------------------------------- | ------------------------------------------------ |
| p1-ru-003 | Commission                      | Two questions, one left open                     |
| p1-ru-007 | Withdrawal needs profile update | Second question ignored, closing without goodbye |
| p1-ru-022 | Investment advice               | Paid service outside the company                 |
| p1-ru-025 | Asks for a human                | Client leaves before stating a request           |
| p1-ru-028 | Update personal data            | Announced wait                                   |
| p1-ru-029 | Cannot find sign-in             | Insult, then a useful answer                     |
| p1-kz-003 | Deposit not credited            | Explicit identity check                          |
| p1-kz-008 | Cannot find sign-in             | Details already given to the bot                 |
| p1-kz-011 | D-account                       | Cut off before closing                           |
| p1-en-008 | Similar securities              | Late new question                                |
| p1-en-009 | Margin checkbox                 | Cut off before closing                           |
| p1-en-014 | Withdrawals blocked             | Protected account action                         |
| p4-ru-001 | Call                            | ASR noise, duplicate turn                        |
| p4-ru-003 | Call                            | Verbal identity confirmation                     |

**Held-out set, 6 dialogs**

| Dialog    | Family               | Why it is in                                  |
| --------- | -------------------- | --------------------------------------------- |
| p1-ru-012 | 1042-S form          | Cut off before closing                        |
| p1-kz-012 | Bond orders rejected | Escalation as a correct next step             |
| p1-kz-013 | Finding bonds        | Paid service outside the company              |
| p1-en-001 | Login already taken  | Plain resolved chat                           |
| p1-en-004 | Broker report        | Plain resolved chat with a follow-up question |
| p4-ru-002 | Call                 | Staff consultation during hold                |

The mix is 7 RU, 5 KZ, 5 EN, and 3 calls.

Prompts are selected on the 14 tuning dialogs only. The held-out six run once, after ML A freezes the prompt, for each provider. Nobody looks at them before that run.

## Phase 1, T+0 to T+3

### B6a. Smoke-test the self-hosted Qwen endpoints, 30 min

This goes first because ML A needs the answer before building providers.

1. Get the base URL, model ID, and auth for the Modal endpoint and the local GPU endpoint. Put them in `apps/api/.dev.vars` under the names below, never in git.

   ```
   LOCAL_LLM_BASE_URL=
   LOCAL_LLM_MODEL=
   LOCAL_LLM_API_KEY=
   ```

2. Send one chat completion with `response_format: {"type":"json_object"}` and `max_tokens` 8000. Use the same probe as the Cerebras smoke test.
3. Record these points:
   - Is the route OpenAI-compatible?
   - Does the thinking come back in `message.reasoning` or inside `content`?
   - Is JSON mode honored?
   - How long is the cold start, and how long a warm call?
   - What is the context limit?
4. Post the findings to ML A.

**Done when** ML A has a working curl example for each endpoint and knows how reasoning is returned.

### B1. Labeling guide and dialog printer, 1.5 h

`vp run calibrate:print` takes a list of IDs and writes one Markdown file per dialog to `tools/calibrate/print/`. Each file shows numbered turns as `[n] speaker timestamp: text`, followed by an empty answer table with the eight criteria. Labelers read these instead of raw JSON.

`docs/LABELING_GUIDE.md` gives one decision rule per criterion. Draft rules follow. They are provisional until the organizers answer, and the guide marks which question each one depends on.

| Criterion     | Provisional rule                                                                                                                                                                                                                                                                                                                 | Depends on organizer question |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| opening       | Judge only the operator's first message. Yes needs a greeting in the client's language and a name. "[Имя скрыто]" counts as a name. The bot's greeting never counts.                                                                                                                                                             | 4                             |
| understanding | N/A when the client's messages before the operator's first reply, including those sent to the bot, already contain enough to answer. Yes when the operator used the known details and asked only for what was missing. No when the operator answered without a needed clarification or asked again for something already stated. | 5                             |
| verification  | N/A for general information. Required for account-specific data or a protected action. Yes only when a check is visibly confirmed, by a system event or an explicit operator statement, before the disclosure. A confirmed bot check before handoff counts.                                                                      | 6                             |
| guidance      | First list every distinct client question. Score with the PDF scale. A correct escalation or next step earns 20. Treat bot information as correct context unless the operator contradicts it. N/A only when no request was ever stated.                                                                                          | 7                             |
| empathy       | Yes when the operator is polite and no complaint or inconvenience the client voiced was ignored. Politeness alone is Yes.                                                                                                                                                                                                        | 8                             |
| management    | Start at 10 and drop to the PDF step that matches the worst lapse. A visible delay after "let me check" with no wait warning counts as a lapse. The three-minute first-response rule does not apply. ASR noise is never a lapse.                                                                                                 | 9, 11                         |
| closing       | Yes needs a goodbye plus either a summary or an offer of further help. A goodbye alone is No. N/A when the chat or call was cut off before the operator could close. This is the most uncertain rule, so revisit it first when answers arrive.                                                                                   | 10                            |
| violations    | Yes on an insult, an offer of paid service outside the company, or disclosure of confidential data. The offer alone is enough.                                                                                                                                                                                                   | none                          |

Each row also gets one worked example from the tuning set and the evidence to cite. The examples come from the tuning set only, never from the held-out set.

**Done when** one other member has read the guide and labeled one dialog with it without asking a question.

### B2. Metrics before the evaluator exists, 1.5 h

Build the comparison side first. It needs only labels, and the same code measures agreement between humans.

**`labels.csv` columns**

```
conversation_id,labeler,criterion_id,answer,evidence_turns,note
p1-ru-007,dauka,guidance,10,12;13,"Second question about re-submitting the withdrawal left unanswered"
```

`answer` is `yes`, `no`, `na`, or a scale number. `evidence_turns` lists 1-based turn numbers separated by `;`.

Totals of human labels come from the app's own `scoreEvaluation` in `apps/api/src/evaluation.ts`, so they match both cases in `apps/api/src/evaluation.test.ts`: 84.17 and 88.75. Otherwise the total comparisons are meaningless.

**`vp run calibrate:compare`** takes two sources, either two labelers or labels and a run file. It prints the metrics below and writes them to the `.md` and `.json` reports.

| Metric                         | Applies to               | Note                                                            |
| ------------------------------ | ------------------------ | --------------------------------------------------------------- |
| Exact agreement with count     | Every criterion          | N/A counts as its own answer                                    |
| Cohen's kappa                  | Binary criteria          | Reported as NA when one side never varies, as with `violations` |
| Quadratic weighted kappa       | `guidance`, `management` | Only on rows where both sides are not N/A                       |
| N/A agreement                  | Criteria that allow N/A  | Both N/A or both not N/A                                        |
| Confusion table                | Every criterion          | Printed, not just summarized                                    |
| Total MAE and max error        | Per dialog               | Uses `scoreEvaluation` on both sides                            |
| Violation precision and recall | `violations`             |                                                                 |
| Breakdown                      | Language and channel     | KZ row is required                                              |
| Run health                     | Model runs               | Failed samples, retries, mean latency, cost                     |

Agreement and total MAE get 95% bootstrap intervals over dialogs, with 1000 resamples. With 14 dialogs the intervals will be wide, and the report must show that.

**`runs/<run>-mismatches.csv`** has one row per disagreement and stays out of git, because it holds model text and transcript text. It holds the human answer, the model answer and its votes, the model explanation, and the text of the cited turns. A `bucket` column takes one of three values: `rubric` (the guide or prompt is ambiguous), `evidence` (the model missed or misread something), or `label` (the human was wrong).

The tools are TypeScript run on Node through `vp run`. They import the app's checklist, scorer, and evaluator, and add only `csv-parse` for reading CSV files.

**Done when** `vp run calibrate:compare` runs on a hand-made labels file and a fake run file, and its totals match the two test totals.

## Phase 2, T+3 to T+7

### L1. Labeling, led by ML B

Assignment for four people. Each person labels about eight dialogs, and 10 of the 14 tuning dialogs get a second labeler.

| Labeler   | Primary                                               | Second label                    |
| --------- | ----------------------------------------------------- | ------------------------------- |
| dauka     | p1-ru-003, p1-ru-007, p1-ru-022, p1-ru-025, p4-ru-001 | p1-kz-003, p1-en-014            |
| ML A      | p1-ru-028, p1-ru-029, p1-en-008, p1-en-009            | p1-ru-003, p1-ru-022, p4-ru-001 |
| ML C      | p1-kz-003, p1-kz-008, p1-kz-011, p4-ru-003            | p1-ru-007, p1-en-009            |
| Fullstack | p1-en-014, p1-ru-012, p1-en-001, p1-en-004            | p1-ru-025, p1-kz-008, p1-ru-028 |

Swap rows so that whoever reads Kazakh best takes the Kazakh dialogs. The held-out dialogs p1-kz-012, p1-kz-013, and p4-ru-002 go to whoever finishes first. Labelers never discuss the held-out dialogs with ML A.

Expect about 3 minutes per chat and 15 per call, roughly 40 to 60 minutes each.

After labeling:

1. Run `vp run calibrate:compare --pairs` between the two labelers on the 10 double-labeled dialogs. This human agreement is the ceiling for the model. A criterion where humans disagree cannot be tuned. It needs a guide change or an organizer answer.
2. Settle every disagreement in a short call. Update the guide, then write one final label per dialog with `labeler=final`.

**Done when** `labels.csv` holds final labels for all 20 dialogs and the human agreement report is committed.

### B2b. Run script, after ML A merges the evaluator package (A1)

`run.ts` imports `evaluate` from `packages/evaluator`. It runs a list of dialogs at concurrency 4 with backoff and writes `tools/calibrate/runs/<date>-<prompt>-<provider>.json`.

```json
{
  "promptVersion": "v1",
  "provider": "cerebras-qwen",
  "model": "Qwen/Qwen3.8-27B:cerebras",
  "dialogs": [
    {
      "conversationId": "p1-ru-007",
      "ratings": [
        {
          "criterionId": "closing",
          "answer": "no",
          "confidence": 1,
          "votes": ["no", "no", "no"],
          "evidence": [13],
          "explanation": "..."
        }
      ],
      "total": 64.71,
      "seriousViolation": false,
      "run": {
        "latencyMs": 4800,
        "usage": { "promptTokens": 2900, "completionTokens": 4100 },
        "costUsd": 0.009,
        "failedSamples": 0
      }
    }
  ]
}
```

Flags: `--set tuning|heldout|all|<ids>`, `--provider cerebras|local`, and `--samples n`. `--set heldout` refuses to run unless `--frozen <prompt-version>` is given, so the held-out set can't be run by accident.

### B3. First report, about 1 h

1. Run the tuning set with the baseline prompt and compare it with the final labels.
2. Fill the `bucket` column for every mismatch.
3. Send ML A a ranked list of the three to five largest error groups, each with dialog IDs and the turns involved.

**Done when** report v1 is committed and ML A has the ranked list.

## Phase 3, T+7 to T+12

### B4. Acceptance loop with ML A

Each candidate prompt goes through these steps, about 10 minutes per cycle:

1. ML A names a candidate version.
2. ML B runs the tuning set and writes the report.
3. The candidate is accepted when tuning agreement improves and no criterion loses more than one dialog.

ML B keeps a table in `tools/calibrate/reports/INDEX.md` with one row per version: prompt version, provider, agreement per criterion, total MAE, and accepted or rejected.

### B5. Kazakh check

Compare the KZ row with RU and EN. If KZ agreement is 10 or more points lower, run the tie-break model on every KZ criterion and measure again. Then tell ML A which setup to keep.

### B6b. Local mode in the report

Run the tuning set on the self-hosted Qwen with the accepted prompt. The report then shows cloud and local side by side for agreement, latency, and cost. These are the numbers for the "different architectures" point in the demo.

**Done when** `INDEX.md` has a local row next to the cloud row for the same prompt version.

## Phase 4, T+12 to T+17

1. **Calibration page data.** Give Fullstack a stable `reports/latest.json` with the same fields as the report: per-criterion agreement, human ceiling, total MAE, cloud versus local, and prompt version.
2. **Unlabeled sanity run on all 65 DEV dialogs.** Check the failure rate, the answer distribution per criterion, and that `violations` flags all five known cases (p1-ru-022, p1-ru-023, p1-ru-029, p1-kz-013, p1-en-013) and nothing else. A distribution far from what the labels show points to a prompt problem the 14 did not reveal.
3. **Demo prep for local mode.** Find out how to keep the Modal endpoint warm before the demo, and time one evaluation in local mode.
4. **Organizer answers.** When answers arrive, update the guide, relabel the affected criteria, and rerun. Closing and understanding are the most likely to change.

## Phase 5, T+17 to the control release at hour 23

1. **Final held-out run, the only one,** on the frozen prompt for both providers. These are the numbers that go into the README and the demo. The prompt does not change after this run.
2. **Control run at hour 23.** Run the 10 control dialogs through the app as soon as they are released. Check that none failed and list the low-confidence criteria for the demo. Nobody edits a model result by hand. Corrections go only through the appeal flow, so the original AI result stays intact.

## Risks

| Risk                                           | Response                                                                                                                |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Humans disagree on closing or understanding    | Report the ceiling, ask the organizers, and do not tune on that criterion until they answer                             |
| 14 dialogs are too few to separate two prompts | Accept a change only on clear gains. Show the bootstrap intervals.                                                      |
| The held-out result is worse than tuning       | Report it honestly in the README. Do not reopen prompt tuning, since that would turn the held-out set into tuning data. |
| No one on the team reads Kazakh well           | Label KZ with a Russian gloss of each operator turn and mark those labels low-confidence                                |
| Modal cold start during the demo               | Warm the endpoint before the demo and keep cloud as the default                                                         |
| The evaluator package lands late               | Phase 1 and labeling do not depend on it. Only B2b and later wait for it.                                               |
