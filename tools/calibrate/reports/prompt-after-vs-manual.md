# Comparison report: prompt-after-vs-manual

- Created: 2026-11-07T15:37:27+00:00
- Mode: run
- Set: p1-ru-001,p1-ru-002,p1-ru-003,p1-ru-004,p1-ru-005,p1-ru-006,p1-ru-007,p1-ru-008,p1-ru-009,p1-ru-010,p1-ru-011,p1-ru-013,p1-ru-014,p1-ru-015,p1-ru-016,p1-ru-017,p1-ru-018,p1-ru-019,p1-ru-020,p1-ru-021,p1-ru-022,p1-ru-023,p1-ru-024,p1-ru-025,p1-ru-026,p1-ru-027,p1-ru-028,p1-ru-029,p1-ru-030,p1-kz-001,p1-kz-002,p1-kz-003,p1-kz-004,p1-kz-005,p1-kz-006,p1-kz-007,p1-kz-008,p1-kz-009,p1-kz-010,p1-kz-011,p1-kz-014,p1-kz-015,p1-en-002,p1-en-003,p1-en-005,p1-en-006,p1-en-007,p1-en-008,p1-en-009,p1-en-010,p1-en-011,p1-en-012,p1-en-013,p1-en-014,p1-en-015,p4-ru-003,p4-ru-001,p4-ru-005,p4-ru-004
- Labeler A: manual
- Run: promptVersion=p-3379efcc, provider=hf-router, model=Qwen/Qwen3.8-27B:cerebras

## Per criterion

| criterion     | n   | exact | exact rate | kappa | qwk   | NA agreement |
| ------------- | --- | ----- | ---------- | ----- | ----- | ------------ |
| opening       | 59  | 58    | 0.983      | 0.848 | -     | -            |
| understanding | 56  | 48    | 0.857      | 0.689 | -     | 0.857        |
| verification  | 53  | 48    | 0.906      | 0.722 | -     | 0.906        |
| guidance      | 57  | 50    | 0.877      | 0.695 | 0.821 | 1.000        |
| empathy       | 59  | 55    | 0.932      | 0.677 | -     | -            |
| management    | 56  | 45    | 0.804      | 0.600 | 0.815 | -            |
| closing       | 55  | 49    | 0.891      | 0.759 | -     | 1.000        |
| violations    | 59  | 58    | 0.983      | 0.900 | -     | -            |

Confusion opening (A rows, B columns): `{"no": {"no": 3, "yes": 1}, "yes": {"yes": 55}}`

Confusion understanding (A rows, B columns): `{"na": {"na": 35, "no": 2, "yes": 3}, "no": {"na": 1, "no": 3}, "yes": {"na": 2, "yes": 10}}`

Confusion verification (A rows, B columns): `{"na": {"na": 40, "yes": 1}, "no": {"na": 4, "no": 4}, "yes": {"yes": 4}}`

Confusion guidance (A rows, B columns): `{"0": {"0": 2, "5": 1, "10": 1}, "10": {"10": 5}, "15": {"15": 1, "20": 1}, "20": {"0": 1, "15": 3, "20": 41}, "na": {"na": 1}}`

Confusion empathy (A rows, B columns): `{"no": {"no": 5, "yes": 3}, "yes": {"no": 1, "yes": 50}}`

Confusion management (A rows, B columns): `{"0": {"0": 2, "7": 1}, "4": {"4": 4, "7": 2}, "7": {"0": 1, "4": 4, "7": 2, "10": 1}, "10": {"7": 2, "10": 37}}`

Confusion closing (A rows, B columns): `{"na": {"na": 6}, "no": {"no": 36, "yes": 3}, "yes": {"no": 3, "yes": 7}}`

Confusion violations (A rows, B columns): `{"no": {"no": 53}, "yes": {"no": 1, "yes": 5}}`

## Pooled

- n: 454, exact: 411, rate: 0.905, 95% CI: [0.871, 0.935]

## Totals

- n: 44, MAE: 6.335, max error: 41.770, 95% CI: [3.608, 9.487], skipped: 15

## Violations

- tp: 5, fp: 0, fn: 1, precision: 1.000, recall: 0.833

## Breakdown

| group    | value      | n   | exact rate |
| -------- | ---------- | --- | ---------- |
| language | RU         | 254 | 0.894      |
| language | KZ         | 100 | 0.950      |
| language | EN         | 100 | 0.890      |
| channel  | agent chat | 425 | 0.915      |
| channel  | voice call | 29  | 0.759      |

## Run health

- dialogs: 59
- failed samples: 0
- mean latency ms: 3292.3389830508477
- cost USD: 0.49781532
- missing from run: none

## Mismatches

Count: 43
