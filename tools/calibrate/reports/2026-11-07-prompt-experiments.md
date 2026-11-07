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

1. **No version beats the prompt on main.** The differences of 1 to 2 points are within run-to-run noise. In v5, management errors rose from 10 to 14 although its guidance was identical to main's. The PR therefore keeps main's prompt.
2. **A wider verification rule hurts badly.** In v3, the model demanded verification on 23 general questions that the sheet marks N/A. The sheet's verification No on `p1-ru-017` (app navigation for buying a bond) and `p1-ru-026` (where to find the funding details) cannot be taught without this over-triggering.
3. **Main's prompt already matches the sheet on gross violations.** It flags `p1-ru-009` and `p1-en-014`, the restriction disclosures. Adding an explicit confidentiality rule made the model also flag `p1-kz-015` and `p1-ru-018`.
4. **The sheet contradicts itself on one cell.** `p1-kz-015` is the same scenario as `p1-ru-009` and `p1-en-014`, yet it is marked violations No. That cell is one where Qwen and Jev agreed, so it was never reviewed by hand.
5. **Measurement noise is the limit.** The prompt sits near 90%, and single-sample runs differ by about 2 points even at T=0. A prompt change cannot be shown to help unless it moves the score by more than that, or several runs are averaged.

## Recommendations

- Keep main's prompt for the control run unless a change wins on at least two runs.
- Decide the 21 undecided cells and recheck `p1-kz-015`, so that the reference has no gaps.
- To reduce noise, compare versions on 3-sample runs (`--samples 3`). If the voted result is steadier, use voting in the app.
- The 78-turn call `p4-ru-003` still runs out of tokens at 12,000 under some prompts. The evaluator gives up after two attempts, so it never reaches its 16,000 cap. That only matters for calls, and the control set is chats only.
