# Comparison report: baseline-s3-vs-final

- Created: 2026-11-07T14:51:00+00:00
- Mode: run
- Set: p1-ru-003,p1-ru-007,p1-ru-022,p1-ru-025,p1-ru-028,p1-ru-029,p1-kz-003,p1-kz-008,p1-kz-011,p1-en-008,p1-en-009,p1-en-014
- Labeler A: final
- Run: promptVersion=p-ec2a86d6, provider=hf-router, model=Qwen/Qwen3.8-27B:cerebras

## Per criterion

| criterion     | n   | exact | exact rate | kappa | qwk   | NA agreement |
| ------------- | --- | ----- | ---------- | ----- | ----- | ------------ |
| opening       | 12  | 12    | 1.000      | 1.000 | -     | -            |
| understanding | 12  | 8     | 0.667      | 0.415 | -     | 0.667        |
| verification  | 12  | 12    | 1.000      | 1.000 | -     | 1.000        |
| guidance      | 12  | 10    | 0.833      | 0.762 | 0.947 | 1.000        |
| empathy       | 12  | 12    | 1.000      | 1.000 | -     | -            |
| management    | 12  | 8     | 0.667      | 0.467 | 0.469 | -            |
| closing       | 12  | 11    | 0.917      | 0.844 | -     | 1.000        |
| violations    | 12  | 11    | 0.917      | 0.750 | -     | -            |

Confusion opening (A rows, B columns): `{"no": {"no": 1}, "yes": {"yes": 11}}`

Confusion understanding (A rows, B columns): `{"na": {"na": 5, "no": 2, "yes": 1}, "no": {"na": 1}, "yes": {"yes": 3}}`

Confusion verification (A rows, B columns): `{"na": {"na": 10}, "no": {"no": 1}, "yes": {"yes": 1}}`

Confusion guidance (A rows, B columns): `{"0": {"0": 1}, "5": {"10": 1}, "10": {"10": 1}, "15": {"10": 1, "15": 1}, "20": {"20": 6}, "na": {"na": 1}}`

Confusion empathy (A rows, B columns): `{"no": {"no": 3}, "yes": {"yes": 9}}`

Confusion management (A rows, B columns): `{"0": {"7": 1}, "4": {"4": 1, "10": 1}, "7": {"7": 2, "10": 2}, "10": {"10": 5}}`

Confusion closing (A rows, B columns): `{"na": {"na": 3}, "no": {"no": 7, "yes": 1}, "yes": {"yes": 1}}`

Confusion violations (A rows, B columns): `{"no": {"no": 9, "yes": 1}, "yes": {"yes": 2}}`

## Pooled

- n: 96, exact: 84, rate: 0.875, 95% CI: [0.781, 0.948]

## Totals

- n: 12, MAE: 5.297, max error: 16.160, 95% CI: [2.211, 8.686], skipped: 0

## Violations

- tp: 2, fp: 1, fn: 0, precision: 0.667, recall: 1.000

## Breakdown

| group    | value      | n   | exact rate |
| -------- | ---------- | --- | ---------- |
| language | RU         | 48  | 0.854      |
| language | KZ         | 24  | 0.958      |
| language | EN         | 24  | 0.833      |
| channel  | agent chat | 96  | 0.875      |
| channel  | voice call | 0   | -          |

## Run health

- dialogs: 14
- failed samples: 1
- mean latency ms: 4609.071428571428
- cost USD: 0.29589536
- missing from run: none

## Mismatches

Count: 12
