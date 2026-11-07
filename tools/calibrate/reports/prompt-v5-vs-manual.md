# Comparison report: prompt-v5-vs-manual

- Created: 2026-11-07T15:49:03+00:00
- Mode: run
- Set: p1-ru-001,p1-ru-002,p1-ru-003,p1-ru-004,p1-ru-005,p1-ru-006,p1-ru-007,p1-ru-008,p1-ru-009,p1-ru-010,p1-ru-011,p1-ru-013,p1-ru-014,p1-ru-015,p1-ru-016,p1-ru-017,p1-ru-018,p1-ru-019,p1-ru-020,p1-ru-021,p1-ru-022,p1-ru-023,p1-ru-024,p1-ru-025,p1-ru-026,p1-ru-027,p1-ru-028,p1-ru-029,p1-ru-030,p1-kz-001,p1-kz-002,p1-kz-003,p1-kz-004,p1-kz-005,p1-kz-006,p1-kz-007,p1-kz-008,p1-kz-009,p1-kz-010,p1-kz-011,p1-kz-014,p1-kz-015,p1-en-002,p1-en-003,p1-en-005,p1-en-006,p1-en-007,p1-en-008,p1-en-009,p1-en-010,p1-en-011,p1-en-012,p1-en-013,p1-en-014,p1-en-015,p4-ru-003,p4-ru-001,p4-ru-005,p4-ru-004
- Labeler A: manual
- Run: promptVersion=p-2cb88e6a, provider=hf-router, model=Qwen/Qwen3.8-27B:cerebras

## Per criterion

| criterion     | n   | exact | exact rate | kappa | qwk   | NA agreement |
| ------------- | --- | ----- | ---------- | ----- | ----- | ------------ |
| opening       | 59  | 59    | 1.000      | 1.000 | -     | -            |
| understanding | 56  | 48    | 0.857      | 0.691 | -     | 0.857        |
| verification  | 53  | 48    | 0.906      | 0.721 | -     | 0.906        |
| guidance      | 57  | 50    | 0.877      | 0.695 | 0.922 | 1.000        |
| empathy       | 59  | 54    | 0.915      | 0.618 | -     | -            |
| management    | 56  | 42    | 0.750      | 0.462 | 0.653 | -            |
| closing       | 55  | 47    | 0.855      | 0.678 | -     | 0.964        |
| violations    | 59  | 59    | 1.000      | 1.000 | -     | -            |

Confusion opening (A rows, B columns): `{"no": {"no": 4}, "yes": {"yes": 55}}`

Confusion understanding (A rows, B columns): `{"na": {"na": 35, "no": 3, "yes": 2}, "no": {"na": 1, "no": 3}, "yes": {"na": 2, "yes": 10}}`

Confusion verification (A rows, B columns): `{"na": {"na": 40, "no": 1}, "no": {"na": 4, "no": 4}, "yes": {"yes": 4}}`

Confusion guidance (A rows, B columns): `{"0": {"0": 2, "5": 1, "10": 1}, "10": {"10": 5}, "15": {"15": 1, "20": 1}, "20": {"15": 4, "20": 41}, "na": {"na": 1}}`

Confusion empathy (A rows, B columns): `{"no": {"no": 5, "yes": 3}, "yes": {"no": 2, "yes": 49}}`

Confusion management (A rows, B columns): `{"0": {"4": 1, "7": 2}, "4": {"4": 2, "7": 4}, "7": {"7": 4, "10": 4}, "10": {"4": 1, "7": 2, "10": 36}}`

Confusion closing (A rows, B columns): `{"na": {"na": 5, "no": 1}, "no": {"na": 1, "no": 35, "yes": 3}, "yes": {"no": 3, "yes": 7}}`

Confusion violations (A rows, B columns): `{"no": {"no": 53}, "yes": {"yes": 6}}`

## Pooled

- n: 454, exact: 407, rate: 0.896, 95% CI: [0.862, 0.929]

## Totals

- n: 44, MAE: 7.865, max error: 36.830, 95% CI: [4.85, 10.949], skipped: 15

## Violations

- tp: 6, fp: 0, fn: 0, precision: 1.000, recall: 1.000

## Breakdown

| group    | value      | n   | exact rate |
| -------- | ---------- | --- | ---------- |
| language | RU         | 254 | 0.882      |
| language | KZ         | 100 | 0.930      |
| language | EN         | 100 | 0.900      |
| channel  | agent chat | 425 | 0.901      |
| channel  | voice call | 29  | 0.828      |

## Run health

- dialogs: 59
- failed samples: 0
- mean latency ms: 3035.8813559322034
- cost USD: 0.44408079
- missing from run: none

## Mismatches

Count: 47
