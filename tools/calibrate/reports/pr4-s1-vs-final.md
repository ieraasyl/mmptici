# Comparison report: pr4-s1-vs-final

- Created: 2026-11-07T14:59:03+00:00
- Mode: run
- Set: p1-ru-003,p1-ru-007,p1-ru-022,p1-ru-025,p1-ru-028,p1-ru-029,p1-kz-003,p1-kz-008,p1-kz-011,p1-en-008,p1-en-009,p1-en-014
- Labeler A: final
- Run: promptVersion=p-433387c8, provider=hf-router, model=Qwen/Qwen3.8-27B:cerebras

## Per criterion

| criterion     | n   | exact | exact rate | kappa | qwk   | NA agreement |
| ------------- | --- | ----- | ---------- | ----- | ----- | ------------ |
| opening       | 12  | 12    | 1.000      | 1.000 | -     | -            |
| understanding | 12  | 9     | 0.750      | 0.500 | -     | 0.833        |
| verification  | 12  | 12    | 1.000      | 1.000 | -     | 1.000        |
| guidance      | 12  | 9     | 0.750      | 0.657 | 0.919 | 1.000        |
| empathy       | 12  | 12    | 1.000      | 1.000 | -     | -            |
| management    | 12  | 8     | 0.667      | 0.478 | 0.528 | -            |
| closing       | 12  | 11    | 0.917      | 0.844 | -     | 1.000        |
| violations    | 12  | 11    | 0.917      | 0.750 | -     | -            |

Confusion opening (A rows, B columns): `{"no": {"no": 1}, "yes": {"yes": 11}}`

Confusion understanding (A rows, B columns): `{"na": {"na": 7, "no": 1}, "no": {"na": 1}, "yes": {"no": 1, "yes": 2}}`

Confusion verification (A rows, B columns): `{"na": {"na": 10}, "no": {"no": 1}, "yes": {"yes": 1}}`

Confusion guidance (A rows, B columns): `{"0": {"0": 1}, "5": {"10": 1}, "10": {"10": 1}, "15": {"10": 1, "15": 1}, "20": {"15": 1, "20": 5}, "na": {"na": 1}}`

Confusion empathy (A rows, B columns): `{"no": {"no": 3}, "yes": {"yes": 9}}`

Confusion management (A rows, B columns): `{"0": {"7": 1}, "4": {"0": 1, "10": 1}, "7": {"7": 3, "10": 1}, "10": {"10": 5}}`

Confusion closing (A rows, B columns): `{"na": {"na": 3}, "no": {"no": 7, "yes": 1}, "yes": {"yes": 1}}`

Confusion violations (A rows, B columns): `{"no": {"no": 9, "yes": 1}, "yes": {"yes": 2}}`

## Pooled

- n: 96, exact: 84, rate: 0.875, 95% CI: [0.802, 0.948]

## Totals

- n: 12, MAE: 8.112, max error: 29.240, 95% CI: [3.318, 13.281], skipped: 0

## Violations

- tp: 2, fp: 1, fn: 0, precision: 0.667, recall: 1.000

## Breakdown

| group    | value      | n   | exact rate |
| -------- | ---------- | --- | ---------- |
| language | RU         | 48  | 0.812      |
| language | KZ         | 24  | 0.958      |
| language | EN         | 24  | 0.917      |
| channel  | agent chat | 96  | 0.875      |
| channel  | voice call | 0   | -          |

## Run health

- dialogs: 12
- failed samples: 0
- mean latency ms: 3229.0833333333335
- cost USD: 0.07144413
- missing from run: none

## Mismatches

Count: 12
