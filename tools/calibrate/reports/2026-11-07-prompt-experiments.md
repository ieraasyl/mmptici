# Prompt experiments against the manual review sheet, 2026-11-07

Reference: `tools/calibrate/labels/manual-review.csv`, built from the manual review sheet (`CQA_disagreement_review_final.xlsx`). The sheet covers all 65 DEV dialogs. Where Qwen and Jev agreed, it keeps their shared answer. Where they disagreed, it holds a manual decision. 21 cells are still undecided and are left out. Scores cover the 59 dialogs outside the held-out set: 454 cells, 62 of them decided by hand.

Every run used one sample at T=0 with Qwen3.8-27B on Cerebras. Run files are in `tools/calibrate/runs/`, which is git-ignored. Per-criterion reports are `prompt-<version>-vs-manual.md`.

| Version | What changed                                                                                                                |       All cells | Decided cells |
| ------- | --------------------------------------------------------------------------------------------------------------------------- | --------------: | ------------: |
| before  | The prompt on main (PR #4)                                                                                                  | 416/454 (91.6%) |         37/62 |
| after   | Rules for every criterion; the system prompt counts bot details as known and warns against middle-step defaults             | 411/454 (90.5%) |         35/62 |
| v3      | `after`, plus verification required for any account-related request and confidentiality covering any account information    | 387/449 (86.2%) |         33/62 |
| v4      | `after` verification wording, with confidentiality narrowed to a restriction or status reported while skipping verification | 409/449 (91.1%) |         38/62 |
| v5      | The prompt on main, plus only the closing and empathy rules                                                                 | 407/454 (89.6%) |         31/62 |

v3 and v4 are scored on 449 cells because `p4-ru-003` is missing from their runs (a failed sample), so their percentages are not directly comparable with the other rows.

## Findings

1. **No guidance rewrite beats the prompt on main.** v5 lost 9 cells against `before`, and its management errors rose from 10 to 14 even though its management guidance was identical to main's, so small wording changes move answers in other criteria.
2. **A wider verification rule hurts badly.** In v3, the model demanded verification on 23 general questions that the sheet marks N/A. The sheet's verification No on `p1-ru-017` (app navigation for buying a bond) and `p1-ru-026` (where to find the funding details) cannot be taught without this over-triggering.
3. **Main's prompt already matches the sheet on gross violations.** It flags `p1-ru-009` and `p1-en-014`, the restriction disclosures. Adding an explicit confidentiality rule made the model also flag `p1-kz-015` and `p1-ru-018`.
4. **The sheet contradicts itself on one cell.** `p1-kz-015` is the same scenario as `p1-ru-009` and `p1-en-014`, yet it is marked violations No. That cell is one where Qwen and Jev agreed, so it was never reviewed by hand.
5. **Runs at T=0 repeat exactly.** Two runs of the same prompt on the same day gave identical answers, for main's prompt and for each round-2 variant. The gaps in the table are between prompt versions, including main's later speech-recognition change (416 for `before`, 413 for the current main). Repeating a run adds no evidence. The uncertainty is in which dialogs happen to change, so compare versions with a paired test over dialogs.

## Round 2: how the model reasons

Round 2 leaves the criterion guidance alone and changes what the model writes before each answer. Both variants change only the output instructions at the end of the system prompt.

| Version  | What changed                                                                                                                                                       |       All cells | Decided cells |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------: | ------------: |
| main     | The prompt on main today, run again for a same-day baseline                                                                                                        | 413/454 (91.0%) |         34/62 |
| analysis | An `analysis` object first: every client request with its turns and whether it was resolved, and the operator's key actions                                        | 406/454 (89.4%) |         30/62 |
| checks   | Each rating starts with `checks`: the conditions in that criterion's guidance, including its N/A condition, each with whether it is met and the turns that show it | 420/454 (92.5%) |         39/62 |

`analysis` failed `p1-kz-003` on its first try, and that dialog's cells count as wrong. `checks` failed `p1-ru-013` on one run and passed on a rerun. The reports are `prompt-main-vs-manual.md`, `prompt-analysis-vs-manual.md`, and `prompt-checks-vs-manual.md`.

**`checks` is adopted.** Against `main` it fixes 13 cells and breaks 6: management +4, guidance +2, closing +1, empathy +1, understanding −1. The paired gain is 7 cells, and a dialog bootstrap with 2000 resamples gives a 95% interval of −1 to +16 cells. That is promising but just short of conclusive. Because the checks come from each criterion's own guidance, the change also works for an edited or replaced criterion. It costs about 50% more ($0.59 against $0.39 for the 59 dialogs), and the mean time per dialog rises from 2.7 s to 7.8 s.

**`analysis` is rejected.** It lost 7 cells, mostly in guidance and management.

## Round 3: a Russian system prompt

Research brief recommendation 9 suggests Russian instructions. This variant translates the system prompt of the `checks` version into Russian. It keeps the JSON keys, the answer values, and the criterion guidance unchanged. The report is `prompt-russian-vs-manual.md`.

| Version |       All cells | Decided cells |
| ------- | --------------: | ------------: |
| checks  | 420/454 (92.5%) |         39/62 |
| russian | 409/454 (90.1%) |         29/62 |

**`russian` is rejected.** Against `checks` it fixes 7 cells and breaks 18. It is worse in every language: Russian chats 203 against 206 of 225, Kazakh 95 against 96 of 100, English 88 against 94 of 100, and calls 23 against 24 of 29. It also flags `p1-kz-015` as a violation, a case the sheet marks No. The frozen `checks` prompt stays in English.

## Recommendations

- Use the `checks` prompt from round 2 for the control run.
- Decide the 21 undecided cells and recheck `p1-kz-015`, so that the reference has no gaps.
- Voting over 3 samples at T=0.6 did not beat one sample (411 against 413 cells, with one violation missed), so the app stays at one sample.
- The 78-turn call `p4-ru-003` still runs out of tokens at 12,000 under some prompts. The evaluator gives up after two attempts, so it never reaches its 16,000 cap. That only matters for calls, and the control set is chats only.
