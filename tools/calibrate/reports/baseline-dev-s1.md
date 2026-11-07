# Run summary: baseline-dev-s1

Prompt `p-ec2a86d6` · Qwen/Qwen3.8-27B:cerebras · set `dev` · 1 sample(s) at T=0 · commit 8f1de24

Evaluated 59 of 59. Failed: none.

## Answers per criterion

| Criterion     | Answers                                 |
| ------------- | --------------------------------------- |
| opening       | yes: 55, no: 4                          |
| understanding | na: 37, yes: 17, no: 5                  |
| verification  | na: 47, yes: 7, no: 5                   |
| guidance      | 20: 43, 10: 7, 15: 5, 0: 2, na: 1, 5: 1 |
| empathy       | yes: 53, no: 6                          |
| management    | 10: 38, 7: 15, 4: 6                     |
| closing       | no: 40, yes: 13, na: 6                  |
| violations    | no: 53, yes: 6                          |

## Answers per criterion and language

| Criterion     | Language | Answers                                 |
| ------------- | -------- | --------------------------------------- |
| opening       | EN       | yes: 12, no: 1                          |
| opening       | KZ       | yes: 12, no: 1                          |
| opening       | RU       | yes: 31, no: 2                          |
| understanding | EN       | na: 10, yes: 2, no: 1                   |
| understanding | KZ       | na: 11, yes: 1, no: 1                   |
| understanding | RU       | na: 16, yes: 14, no: 3                  |
| verification  | EN       | na: 11, yes: 1, no: 1                   |
| verification  | KZ       | na: 11, yes: 1, no: 1                   |
| verification  | RU       | na: 25, yes: 5, no: 3                   |
| guidance      | EN       | 20: 10, 10: 2, 15: 1                    |
| guidance      | KZ       | 20: 11, 15: 1, 10: 1                    |
| guidance      | RU       | 20: 22, 10: 4, 15: 3, 0: 2, na: 1, 5: 1 |
| empathy       | EN       | yes: 11, no: 2                          |
| empathy       | KZ       | yes: 13                                 |
| empathy       | RU       | yes: 29, no: 4                          |
| management    | EN       | 10: 9, 7: 3, 4: 1                       |
| management    | KZ       | 10: 10, 7: 3                            |
| management    | RU       | 10: 19, 7: 9, 4: 5                      |
| closing       | EN       | no: 8, yes: 4, na: 1                    |
| closing       | KZ       | no: 10, na: 2, yes: 1                   |
| closing       | RU       | no: 22, yes: 8, na: 3                   |
| violations    | EN       | no: 11, yes: 2                          |
| violations    | KZ       | no: 13                                  |
| violations    | RU       | no: 29, yes: 4                          |

## Gross violation flag

- Flagged: p1-en-013, p1-en-014, p1-ru-009, p1-ru-022, p1-ru-023, p1-ru-029
- Known cases caught: p1-en-013, p1-ru-022, p1-ru-023, p1-ru-029
- Known cases missed: none
- Flagged but not a known case: p1-en-014, p1-ru-009

## Totals and cost

- Totals: n=59, mean 83.48, min 16, max 100
- Cost $0.3716 over 59 model calls, mean 4.15 s per dialog
