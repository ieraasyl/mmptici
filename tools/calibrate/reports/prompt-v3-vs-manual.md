# Comparison report: prompt-v3-vs-manual

- Created: 2026-11-07T15:49:02+00:00
- Mode: run
- Set: p1-ru-001,p1-ru-002,p1-ru-003,p1-ru-004,p1-ru-005,p1-ru-006,p1-ru-007,p1-ru-008,p1-ru-009,p1-ru-010,p1-ru-011,p1-ru-013,p1-ru-014,p1-ru-015,p1-ru-016,p1-ru-017,p1-ru-018,p1-ru-019,p1-ru-020,p1-ru-021,p1-ru-022,p1-ru-023,p1-ru-024,p1-ru-025,p1-ru-026,p1-ru-027,p1-ru-028,p1-ru-029,p1-ru-030,p1-kz-001,p1-kz-002,p1-kz-003,p1-kz-004,p1-kz-005,p1-kz-006,p1-kz-007,p1-kz-008,p1-kz-009,p1-kz-010,p1-kz-011,p1-kz-014,p1-kz-015,p1-en-002,p1-en-003,p1-en-005,p1-en-006,p1-en-007,p1-en-008,p1-en-009,p1-en-010,p1-en-011,p1-en-012,p1-en-013,p1-en-014,p1-en-015,p4-ru-003,p4-ru-001,p4-ru-005,p4-ru-004
- Labeler A: manual
- Run: promptVersion=p-8719f9b6, provider=hf-router, model=Qwen/Qwen3.8-27B:cerebras

## Per criterion

| criterion     | n   | exact | exact rate | kappa | qwk   | NA agreement |
| ------------- | --- | ----- | ---------- | ----- | ----- | ------------ |
| opening       | 58  | 57    | 0.983      | 0.848 | -     | -            |
| understanding | 55  | 46    | 0.836      | 0.644 | -     | 0.836        |
| verification  | 52  | 25    | 0.481      | 0.183 | -     | 0.481        |
| guidance      | 57  | 49    | 0.860      | 0.662 | 0.814 | 1.000        |
| empathy       | 58  | 56    | 0.966      | 0.855 | -     | -            |
| management    | 56  | 47    | 0.839      | 0.679 | 0.795 | -            |
| closing       | 55  | 51    | 0.927      | 0.832 | -     | 0.982        |
| violations    | 58  | 56    | 0.966      | 0.838 | -     | -            |

Confusion opening (A rows, B columns): `{"no": {"no": 3, "yes": 1}, "yes": {"yes": 54}}`

Confusion understanding (A rows, B columns): `{"na": {"na": 34, "no": 3, "yes": 3}, "no": {"na": 1, "no": 3}, "yes": {"na": 2, "yes": 9}}`

Confusion verification (A rows, B columns): `{"na": {"na": 16, "no": 23, "yes": 2}, "no": {"na": 2, "no": 6}, "yes": {"yes": 3}}`

Confusion guidance (A rows, B columns): `{"0": {"0": 2, "5": 1, "10": 1}, "10": {"10": 5}, "15": {"15": 1, "20": 1}, "20": {"0": 1, "15": 4, "20": 40}, "na": {"na": 1}}`

Confusion empathy (A rows, B columns): `{"no": {"no": 7, "yes": 1}, "yes": {"no": 1, "yes": 49}}`

Confusion management (A rows, B columns): `{"0": {"0": 2, "4": 1}, "4": {"4": 3, "7": 2, "10": 1}, "7": {"0": 1, "4": 1, "7": 6}, "10": {"4": 1, "7": 2, "10": 36}}`

Confusion closing (A rows, B columns): `{"na": {"na": 5, "no": 1}, "no": {"no": 38, "yes": 1}, "yes": {"no": 2, "yes": 8}}`

Confusion violations (A rows, B columns): `{"no": {"no": 50, "yes": 2}, "yes": {"yes": 6}}`

## Pooled

- n: 449, exact: 387, rate: 0.862, 95% CI: [0.825, 0.895]

## Totals

- n: 44, MAE: 11.385, max error: 29.410, 95% CI: [8.625, 14.317], skipped: 14

## Violations

- tp: 6, fp: 2, fn: 0, precision: 0.750, recall: 1.000

## Breakdown

| group    | value      | n   | exact rate |
| -------- | ---------- | --- | ---------- |
| language | RU         | 249 | 0.843      |
| language | KZ         | 100 | 0.890      |
| language | EN         | 100 | 0.880      |
| channel  | agent chat | 425 | 0.878      |
| channel  | voice call | 24  | 0.583      |

## Run health

- dialogs: 59
- failed samples: 1
- mean latency ms: 4583.338983050848
- cost USD: 0.71827014
- missing from run: p4-ru-003

## Mismatches

Count: 62
