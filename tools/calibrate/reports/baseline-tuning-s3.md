# Run summary: baseline-tuning-s3

Prompt `p-ec2a86d6` · Qwen/Qwen3.8-27B:cerebras · set `tuning` · 3 sample(s) at T=0.6 · commit 8f1de24

Evaluated 14 of 14. Failed: none.

## Answers per criterion

| Criterion     | Answers                          |
| ------------- | -------------------------------- |
| opening       | yes: 13, no: 1                   |
| understanding | na: 7, yes: 5, no: 2             |
| verification  | na: 11, yes: 2, no: 1            |
| guidance      | 20: 7, 10: 3, 15: 2, 0: 1, na: 1 |
| empathy       | yes: 11, no: 3                   |
| management    | 10: 8, 7: 5, 4: 1                |
| closing       | no: 8, na: 4, yes: 2             |
| violations    | no: 11, yes: 3                   |

## Answers per criterion and language

| Criterion     | Language | Answers                          |
| ------------- | -------- | -------------------------------- |
| opening       | EN       | yes: 3                           |
| opening       | KZ       | yes: 2, no: 1                    |
| opening       | RU       | yes: 8                           |
| understanding | EN       | na: 2, yes: 1                    |
| understanding | KZ       | na: 2, yes: 1                    |
| understanding | RU       | yes: 3, na: 3, no: 2             |
| verification  | EN       | na: 2, no: 1                     |
| verification  | KZ       | na: 2, yes: 1                    |
| verification  | RU       | na: 7, yes: 1                    |
| guidance      | EN       | 15: 1, 20: 1, 10: 1              |
| guidance      | KZ       | 20: 3                            |
| guidance      | RU       | 20: 3, 10: 2, 0: 1, na: 1, 15: 1 |
| empathy       | EN       | yes: 2, no: 1                    |
| empathy       | KZ       | yes: 3                           |
| empathy       | RU       | yes: 6, no: 2                    |
| management    | EN       | 10: 2, 7: 1                      |
| management    | KZ       | 10: 2, 7: 1                      |
| management    | RU       | 10: 4, 7: 3, 4: 1                |
| closing       | EN       | no: 2, na: 1                     |
| closing       | KZ       | yes: 1, no: 1, na: 1             |
| closing       | RU       | no: 5, na: 2, yes: 1             |
| violations    | EN       | no: 2, yes: 1                    |
| violations    | KZ       | no: 3                            |
| violations    | RU       | no: 6, yes: 2                    |

## Agreement between samples

| Criterion     | Unanimous |  Of | Rate |
| ------------- | --------: | --: | ---: |
| opening       |        14 |  14 | 1.00 |
| understanding |        11 |  14 | 0.79 |
| verification  |        14 |  14 | 1.00 |
| guidance      |        13 |  14 | 0.93 |
| empathy       |        13 |  14 | 0.93 |
| management    |         8 |  14 | 0.57 |
| closing       |        12 |  14 | 0.86 |
| violations    |        14 |  14 | 1.00 |

## Gross violation flag

- Flagged: p1-en-014, p1-ru-022, p1-ru-029
- Known cases caught: p1-ru-022, p1-ru-029
- Known cases missed: none
- Flagged but not a known case: p1-en-014

## Totals and cost

- Totals: n=14, mean 78.77, min 20, max 100
- Cost $0.2959 over 41 model calls, mean 4.61 s per dialog
