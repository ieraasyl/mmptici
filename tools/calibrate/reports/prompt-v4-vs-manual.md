# Comparison report: prompt-v4-vs-manual

- Created: 2026-11-07T15:49:02+00:00
- Mode: run
- Set: p1-ru-001,p1-ru-002,p1-ru-003,p1-ru-004,p1-ru-005,p1-ru-006,p1-ru-007,p1-ru-008,p1-ru-009,p1-ru-010,p1-ru-011,p1-ru-013,p1-ru-014,p1-ru-015,p1-ru-016,p1-ru-017,p1-ru-018,p1-ru-019,p1-ru-020,p1-ru-021,p1-ru-022,p1-ru-023,p1-ru-024,p1-ru-025,p1-ru-026,p1-ru-027,p1-ru-028,p1-ru-029,p1-ru-030,p1-kz-001,p1-kz-002,p1-kz-003,p1-kz-004,p1-kz-005,p1-kz-006,p1-kz-007,p1-kz-008,p1-kz-009,p1-kz-010,p1-kz-011,p1-kz-014,p1-kz-015,p1-en-002,p1-en-003,p1-en-005,p1-en-006,p1-en-007,p1-en-008,p1-en-009,p1-en-010,p1-en-011,p1-en-012,p1-en-013,p1-en-014,p1-en-015,p4-ru-003,p4-ru-001,p4-ru-005,p4-ru-004
- Labeler A: manual
- Run: promptVersion=p-412d42a0, provider=hf-router, model=Qwen/Qwen3.8-27B:cerebras

## Per criterion

| criterion     | n   | exact | exact rate | kappa | qwk   | NA agreement |
| ------------- | --- | ----- | ---------- | ----- | ----- | ------------ |
| opening       | 58  | 58    | 1.000      | 1.000 | -     | -            |
| understanding | 55  | 46    | 0.836      | 0.624 | -     | 0.836        |
| verification  | 52  | 47    | 0.904      | 0.696 | -     | 0.904        |
| guidance      | 57  | 49    | 0.860      | 0.662 | 0.814 | 1.000        |
| empathy       | 58  | 58    | 1.000      | 1.000 | -     | -            |
| management    | 56  | 44    | 0.786      | 0.590 | 0.812 | -            |
| closing       | 55  | 51    | 0.927      | 0.832 | -     | 1.000        |
| violations    | 58  | 56    | 0.966      | 0.838 | -     | -            |

Confusion opening (A rows, B columns): `{"no": {"no": 4}, "yes": {"yes": 54}}`

Confusion understanding (A rows, B columns): `{"na": {"na": 35, "no": 1, "yes": 4}, "no": {"na": 1, "no": 3}, "yes": {"na": 3, "yes": 8}}`

Confusion verification (A rows, B columns): `{"na": {"na": 40, "yes": 1}, "no": {"na": 4, "no": 4}, "yes": {"yes": 3}}`

Confusion guidance (A rows, B columns): `{"0": {"0": 2, "5": 1, "10": 1}, "10": {"10": 5}, "15": {"15": 1, "20": 1}, "20": {"0": 1, "15": 4, "20": 40}, "na": {"na": 1}}`

Confusion empathy (A rows, B columns): `{"no": {"no": 8}, "yes": {"yes": 50}}`

Confusion management (A rows, B columns): `{"0": {"0": 2, "4": 1}, "4": {"4": 4, "7": 2}, "7": {"0": 1, "4": 4, "7": 3}, "10": {"4": 1, "7": 3, "10": 35}}`

Confusion closing (A rows, B columns): `{"na": {"na": 6}, "no": {"no": 38, "yes": 1}, "yes": {"no": 3, "yes": 7}}`

Confusion violations (A rows, B columns): `{"no": {"no": 50, "yes": 2}, "yes": {"yes": 6}}`

## Pooled

- n: 449, exact: 409, rate: 0.911, 95% CI: [0.882, 0.938]

## Totals

- n: 44, MAE: 4.926, max error: 18.830, 95% CI: [3.352, 6.812], skipped: 14

## Violations

- tp: 6, fp: 2, fn: 0, precision: 0.750, recall: 1.000

## Breakdown

| group    | value      | n   | exact rate |
| -------- | ---------- | --- | ---------- |
| language | RU         | 249 | 0.900      |
| language | KZ         | 100 | 0.930      |
| language | EN         | 100 | 0.920      |
| channel  | agent chat | 425 | 0.918      |
| channel  | voice call | 24  | 0.792      |

## Run health

- dialogs: 59
- failed samples: 1
- mean latency ms: 3490.813559322034
- cost USD: 0.58989592
- missing from run: p4-ru-003

## Mismatches

Count: 40
