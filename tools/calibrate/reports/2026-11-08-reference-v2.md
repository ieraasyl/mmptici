# Reference labels v2: audit of the manual review sheet, 2026-11-08

Reviewer: claude-fable-5.1 audit 2026-11-08. No model or API calls were made. The only run used is the saved frozen-prompt run, and it is unchanged. Every number below comes from label edits.

## Files

| File                                                           | What it is                                                                                    |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `tools/calibrate/labels/manual-review.csv`                     | Reference v1, untouched. 499 rows over 65 DEV dialogs x 8 criteria (520 cells, 21 undecided). |
| `tools/calibrate/labels/manual-review-v2.csv`                  | Reference v2. 514 rows: v1 with 12 corrections and 15 newly decided cells; 6 cells left out.  |
| `tools/calibrate/labels/manual-review-v2-changes.csv`          | Changelog, one row per edit (27 rows). Empty `old_answer` means the cell was undecided in v1. |
| `tools/calibrate/labels/undecided-v2.csv`                      | The 21 cells undecided in v1 with the Qwen and Jev votes, and what happened to each.          |
| `tools/calibrate/reports/prompt-checks-vs-manual-v2.{md,json}` | The frozen run scored against v2. The v1 report `prompt-checks-vs-manual` is untouched.       |

Where the votes come from: the review sheet `CQA_disagreement_review_final.xlsx` was built from `outputs/cqa_manual_review/disagreements.json` (outside the repo), which holds one Qwen answer and one Jev answer per cell. The sheet header says `mmptici = Qwen`, so the Qwen column is the team's own evaluator output under an earlier prompt, and the 432 "Qwen and Jev agreed" cells are model-human agreements, not two-human agreements. That is a limitation of v1 and v2 alike.

## Cell counts

| Group                                  | v1  | v2  | Note                                                                                                                                                                                                   |
| -------------------------------------- | --- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Human-reviewed                         | 67  | 87  | 67 manual decisions in v1, 7 of them revised; 5 consensus cells corrected; 15 undecided cells decided.                                                                                                 |
| Consensus-derived (Qwen = Jev, unread) | 432 | 427 | 5 corrected by hand, 20 audited blind (all held, see below), 20 of 427 therefore read by a human; the rest remain unread.                                                                              |
| Unresolved (left out)                  | 21  | 6   | 3 verification cells on held-out dialogs (`p1-en-001`, `p1-kz-012`, `p1-kz-013`) left by policy; 3 management cells (`p1-ru-018`, `p1-ru-029`, `p4-ru-003`) where two scale steps are both defensible. |
| Total                                  | 520 | 520 |                                                                                                                                                                                                        |

The three held-out verification cells were not decided because this audit treats the held-out set as read-only. `undecided-v2.csv` records what the guide would say for each (N/A in all three).

## Denominators

The frozen run `tools/calibrate/runs/exp-e2-b.json` (`promptVersion p-ffbe6d0e`, Qwen3.8-27B on Cerebras, one sample, T=0) covers the 59 DEV dialogs outside the held-out set. `exp-e2-a.json` has identical answers, and `precomputed-checks.json` (`p-5bd7ddaa`, 65 dialogs) agrees with it on every labelled cell of those 59 dialogs, so the choice of file does not matter. The v1 report `prompt-checks-vs-manual` was reproduced exactly from `exp-e2-b.json` before any edit (420/454, same 34 mismatches).

- Pooled, v1: 454 cells = 59 x 8 minus the 18 undecided cells on those dialogs.
- Pooled, v2: 469 cells = 472 minus the 3 unresolved management cells.
- Per criterion, v1 -> v2: opening 59 -> 59, understanding 56 -> 59, verification 53 -> 59, guidance 57 -> 59, empathy 59 -> 59, management 56 -> 56, closing 55 -> 59, violations 59 -> 59.
- Total-score MAE: v1 over 44 dialogs (15 skipped for a missing cell), v2 over 56 dialogs (3 skipped).
- Held-out: not recomputed. No held-out label changed, so `heldout-checks-vs-manual` (42/45) stands, with its 3 undecided cells still undecided.

## Results: frozen run against v1 and v2

| Metric               | v1 (`prompt-checks-vs-manual`) | v2 (`prompt-checks-vs-manual-v2`) |
| -------------------- | -----------------------------: | --------------------------------: |
| Pooled exact         |                420/454 (92.5%) |                   435/469 (92.8%) |
| Pooled 95% CI        |                 [0.893, 0.954] |                    [0.897, 0.955] |
| opening              |                    58/59 98.3% |                       58/59 98.3% |
| understanding        |                    48/56 85.7% |                       50/59 84.7% |
| verification         |                    47/53 88.7% |                       57/59 96.6% |
| guidance             |                    52/57 91.2% |                       54/59 91.5% |
| empathy              |                    57/59 96.6% |                       57/59 96.6% |
| management           |                    49/56 87.5% |                       49/56 87.5% |
| closing              |                    50/55 90.9% |                       52/59 88.1% |
| violations           |                   59/59 100.0% |                       58/59 98.3% |
| Total-score MAE      |                    5.17 (n=44) |                       3.80 (n=56) |
| Violations P / R     |                    1.00 / 1.00 |                       1.00 / 0.86 |
| Human-decided subset |                          39/62 |                             57/82 |
| Consensus subset     |                        381/392 |                           378/387 |

Every difference is a label change. The model run is byte-identical.

### Attribution, cell by cell

On the 12 corrections (v1 denominator of 454): 6 cells now match the model (`p1-en-015` understanding, `p1-ru-021` closing, `p1-ru-026`, `p1-ru-017`, `p1-ru-023`, `p1-ru-022` verification), 5 stop matching (`p1-kz-015` violations, `p1-kz-008` and `p1-ru-005` understanding, `p1-en-011` and `p1-kz-006` closing), 1 is neutral (`p1-ru-014` understanding: the model says N/A, the label moved from Yes to No). Net +1: 420/454 -> 421/454 (92.7%) on the old denominator.

On the 15 newly decided cells the model matches 14. The miss is `p1-en-002` closing, decided No where the model says Yes. That adds 14/15 to reach 435/469.

Two cautions about this gain. First, four of the six corrections that favour the model are the verification cells where a general question was marked No; the team's own report (`2026-11-07-prompt-experiments.md`, finding 2) already noted that those labels cannot be taught to the model without over-triggering. The labels are changed because the guide and the organizer text both say a general question is N/A, not because the model says so, but the effect is in the model's favour and is reported as such. Second, of the 15 decided cells, 11 side with the sheet's Qwen vote and 4 with Jev. Jev marked verification No whenever no identity check happened; the guide (4.3) and the organizer note ("a general question about fees does not require verification") make those N/A, which is why most verification decisions went against Jev. The decisions on `p1-en-002`, `p1-ru-015`, `p1-ru-016` and `p4-ru-003` guidance went against the sheet's Qwen vote.

## What changed and why

### 1. `p1-kz-015` (task 2)

Read against `p1-ru-009` and `p1-en-014`. All three follow the same script: the client asks why withdrawals are blocked, the operator opens with "I can see a withdrawal restriction on your account" without any check (`p1-kz-015` turn 10, `p1-ru-009` turn 12, `p1-en-014` turn 11), the client objects that they have not verified, and the operator says verification is not needed (turns 12, 14, 13). Verification is already No in all three. Violations was Yes in `p1-ru-009` and `p1-en-014` and No in `p1-kz-015`, a consensus cell nobody had read. The team ruling in guide 4.3 and 4.8 makes it Yes. Corrected: violations No -> Yes, evidence 10;12.

The same triplet still differs on cells that were decided by hand and are left alone: guidance 10 / 0 / 10, management 4 / 0 / 7 and empathy Yes / No / No for `p1-ru-009` / `p1-en-014` / `p1-kz-015`. Those are judgment calls (the English operator is the most abrupt), but a reviewer may want to level them.

### 2. Understanding: the repeated-question rule (task 3)

The organizer rule (Q&A 2814) sets the N/A condition: N/A when the client's messages before the operator's first reply, including those to the bot, already held enough to answer. The guide's rule adds: No when the operator asked again for something already stated. The two overlap only when the information was complete and the operator re-asked it. The checklist's Yes wording requires that the operator "used the details already available", and re-asking a detail the client already gave is exactly not using it, so the guide's reading stands and its worked example (`p1-kz-008`, No) is kept as the rule. The organizer rule decides the other direction: when the client gave everything and the operator asked nothing, the answer is N/A, not Yes.

The sheet had three different answers for the same re-ask pattern (`p1-kz-008` N/A, `p1-ru-014` Yes, `p1-ru-026` No), and it contradicted the guide's own worked example. After reading all understanding cells that are Yes or No and every N/A dialog where the operator's first reply contains a question, these were corrected:

| Cell                      | v1   | v2  | Why                                                                                                                                                                                 |
| ------------------------- | ---- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `p1-kz-008` understanding | N/A* | No  | The guide's example. Client named the site in turn 5; operator asked which site in turn 10; client: "I wrote above" (11).                                                           |
| `p1-ru-014` understanding | Yes* | No  | Same pattern. Client named the site in turn 5; operator: "where exactly are you looking?" (10); client: "I already wrote" (11).                                                     |
| `p1-ru-005` understanding | Yes  | N/A | Client gave the full request to the bot (turns 1, 5); the operator asked nothing before answering (10). Nothing was missing, so N/A, not Yes.                                       |
| `p1-en-015` understanding | N/A* | No  | Client wrote only "Can't get into the account"; the bot's clarifying question went unanswered; the operator guessed (10) and was wrong (11). `p1-ru-016`, the same scenario, is No. |

`*` marks a manual decision in v1. Left alone as borderline: `p1-ru-003` N/A* (the operator asked app or web, which the tariff location does need, but ignored the commission question), `p1-ru-017` Yes* (the operator asked about the ticker right after the client said they would look for it), and `p1-ru-022` No (an advice request met with a scam offer; whether a clarification was "needed" is arguable).

### 3. Closing: pleasantry plus goodbye

Scanning the last operator turn of all 60 chats showed the "glad to help" closing split three ways: `p1-ru-021` "Рада помочь. До свидания!" Yes, `p1-en-011` "Happy to help. Goodbye!" Yes, `p1-kz-006` "Көмегім тигеніне қуаныштымын. Сау болыңыз!" Yes*, against `p1-ru-017` "Рад помочь. Хорошего дня!" No, `p1-en-003` No and `p1-ru-030` No. Guide 4.7 needs a goodbye plus a summary or an offer of further help; a pleasantry is neither. The three Yes cells were corrected to No. The sheet also treats "restated next step plus goodbye" both ways (`p1-ru-005`, `p1-ru-013`, `p1-kz-012` Yes; `p1-ru-007`, `p1-ru-003`, `p1-ru-009`, `p1-kz-015` No, all four where the restated step brushes off an open question). That split is left as it is and noted as a gap in the rule.

### 4. Verification: general questions marked No

`p1-ru-026` (where to download the funding details), `p1-ru-017` (how to find a bond by ticker), `p1-ru-023` (how to find bonds, then a paid-advice offer) and `p1-ru-022` (an advice request, then a personal-card offer) were verification No although no account data was disclosed and no protected action was taken. Guide 4.3 and the organizer's "a general question about fees does not require verification" make them N/A, and their twins (`p1-ru-004`, `p1-en-005`, `p1-ru-019`, `p1-en-008`, `p1-en-013`) are N/A. Corrected to N/A; three of the four override a manual decision. `p1-ru-018` stays No: the operator asserted a status of the client's order ("the exchange is cancelling your order") without any check.

### 5. The 21 undecided cells (task 1)

Votes were recovered from `disagreements.json`. 15 were decided; each decision cites turns and a twin dialog in `undecided-v2.csv` and the changelog. In short: `p1-en-006` understanding Yes and verification Yes (the deposit-missing script, same as `p1-kz-003` and `p1-ru-006`); verification N/A on the general questions `p1-en-013`, `p1-kz-004`, `p1-kz-007`, `p1-kz-009`; verification Yes on `p1-ru-010` (system event in turn 15 before the escalation); understanding N/A on `p1-kz-002` and Yes on `p1-ru-030`; closing No on `p1-en-002` and `p1-ru-008`, Yes on `p1-ru-015`; guidance 20 on `p1-ru-016` (final answer correct, same pattern the reviewer gave 20 in `p1-en-015`) and on `p4-ru-003` (correct escalation with a callback, guide 4.4); closing N/A on `p4-ru-003` (the client hung up two seconds after the operator's last line, as in `p4-ru-004` and `p4-ru-005`).

Six stay unresolved: the three held-out verification cells (policy), and management on `p1-ru-018` (0 or 4), `p1-ru-029` (4 or 7) and `p4-ru-003` (4 or 7), where the scale wording supports both steps.

### 6. Blind audit of consensus cells (task 4)

Sample: the 432 rows with note "Qwen and Jev agreed", sorted by (conversation_id, criterion_id), then `random.Random(42).sample(rows, 20)` in Python 3. The draw covers all eight criteria (violations 4, management 3, verification 3, empathy 3, opening 2, guidance 2, closing 2, understanding 1) and all three languages (EN 8, RU 7, KZ 5). Each transcript was read in full.

| Cell                      | Label | Holds | Note                                                                                   |
| ------------------------- | ----- | ----- | -------------------------------------------------------------------------------------- |
| `p1-en-002` verification  | N/A   | yes   | Where the sign-in button is; general.                                                  |
| `p1-en-003` empathy       | yes   | yes   | Polite; gave a direct alternative to the report the client did not want to download.   |
| `p1-en-003` guidance      | 20    | yes   | Plan location on the website answered; client confirms.                                |
| `p1-en-007` guidance      | 10    | yes   | "Where to submit" answered; "when can I retry" asked twice (5, 11) and never answered. |
| `p1-en-007` violations    | no    | yes   |                                                                                        |
| `p1-en-008` verification  | N/A   | yes   | App navigation and order settings; general.                                            |
| `p1-en-009` management    | 10    | yes   | One clear answer.                                                                      |
| `p1-en-011` empathy       | yes   | yes   | Polite; no complaint voiced.                                                           |
| `p1-kz-002` management    | 10    | yes   | Clear path; the currency follow-up answered at once.                                   |
| `p1-kz-002` violations    | no    | yes   |                                                                                        |
| `p1-kz-003` understanding | yes   | yes   | Used the known facts; asked only currency (14) and timing (17).                        |
| `p1-kz-004` opening       | yes   | yes   | Kazakh greeting plus name in turn 10.                                                  |
| `p1-kz-007` closing       | no    | yes   | "Сау болыңыз!" alone.                                                                  |
| `p1-ru-002` violations    | no    | yes   |                                                                                        |
| `p1-ru-012` opening       | yes   | yes   | Held-out dialog, read only. "Здравствуйте. Я Илья."                                    |
| `p1-ru-015` verification  | N/A   | yes   | Login policy; general.                                                                 |
| `p1-ru-019` management    | 10    | yes   |                                                                                        |
| `p1-ru-022` closing       | no    | yes   | Operator closed the chat without a goodbye (not N/A: the operator chose to close).     |
| `p1-ru-026` violations    | no    | yes   | Dismissive but no insult, offer or disclosure.                                         |
| `p1-ru-027` empathy       | yes   | yes   | Polite; the "cannot find the reports" remark was answered directly.                    |

20 of 20 hold. With 432 consensus cells and no error in a sample of 20, the one-sided 95% upper bound on the consensus error rate is about 14%, so the sample rules out gross problems but not a few percent of wrong cells; the five consensus corrections above (`p1-kz-015`, `p1-ru-005`, `p1-ru-021`, `p1-en-011`, `p1-ru-026`) came from the targeted scans, not from the random sample.

## Limitations

- **Held-out exposure.** The six held-out dialogs are in the manual sheet, so they are not unseen: the labelers (one of them the team's own model) saw them, and the `heldout-checks-vs-manual` number is measured against labels partly produced by an earlier prompt of the same model. No held-out label was changed here, and the three undecided held-out cells remain undecided.
- **Consensus cells are model-human agreements.** 427 of 520 cells in v2 rest on an earlier Qwen output agreeing with one human. Only 20 of them were read in this audit. Where the model is systematically wrong in the same way as Jev, the reference cannot show it.
- **Label edits favour the model on balance.** Net +1 on the old denominator and 14/15 on new cells. The reasons are given per cell; the reader can revert any row in the changelog and recompute with the command below.
- **The model run is the only thing held fixed.** Nothing was rerun. The same frozen `checks` prompt is measured; only the reference moved.

## Reproduce

```
source ~/.nvm/nvm.sh && nvm use 26.13.0
vp run calibrate:compare --run tools/calibrate/runs/exp-e2-b.json --set all \
  --name prompt-checks-vs-manual-v2 --labels tools/calibrate/labels/manual-review-v2.csv --labeler manual
```

`--set all` with `--labeler manual` scores every labelled dialog the run contains, which is the 59 non-held-out dialogs. The v1 figure comes from the same command with `manual-review.csv` and `--name prompt-checks-vs-manual`.
