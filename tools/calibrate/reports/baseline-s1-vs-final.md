# Comparison report: baseline-s1-vs-final

- Created: 2026-11-07T14:51:00+00:00
- Mode: run
- Set: p1-ru-003,p1-ru-007,p1-ru-022,p1-ru-025,p1-ru-028,p1-ru-029,p1-kz-003,p1-kz-008,p1-kz-011,p1-en-008,p1-en-009,p1-en-014
- Labeler A: final
- Run: promptVersion=p-ec2a86d6, provider=hf-router, model=Qwen/Qwen3.8-27B:cerebras

## Per criterion

| criterion     | n   | exact | exact rate | kappa | qwk   | NA agreement |
| ------------- | --- | ----- | ---------- | ----- | ----- | ------------ |
| opening       | 12  | 12    | 1.000      | 1.000 | -     | -            |
| understanding | 12  | 10    | 0.833      | 0.707 | -     | 0.833        |
| verification  | 12  | 12    | 1.000      | 1.000 | -     | 1.000        |
| guidance      | 12  | 9     | 0.750      | 0.629 | 0.923 | 1.000        |
| empathy       | 12  | 12    | 1.000      | 1.000 | -     | -            |
| management    | 12  | 9     | 0.750      | 0.609 | 0.650 | -            |
| closing       | 12  | 10    | 0.833      | 0.707 | -     | 0.917        |
| violations    | 12  | 11    | 0.917      | 0.750 | -     | -            |

Confusion opening (A rows, B columns): `{"no": {"no": 1}, "yes": {"yes": 11}}`

Confusion understanding (A rows, B columns): `{"na": {"na": 6, "no": 1, "yes": 1}, "no": {"no": 1}, "yes": {"yes": 3}}`

Confusion verification (A rows, B columns): `{"na": {"na": 10}, "no": {"no": 1}, "yes": {"yes": 1}}`

Confusion guidance (A rows, B columns): `{"0": {"0": 1}, "5": {"10": 1}, "10": {"10": 1}, "15": {"10": 1, "20": 1}, "20": {"20": 6}, "na": {"na": 1}}`

Confusion empathy (A rows, B columns): `{"no": {"no": 3}, "yes": {"yes": 9}}`

Confusion management (A rows, B columns): `{"0": {"4": 1}, "4": {"7": 1, "10": 1}, "7": {"7": 4}, "10": {"10": 5}}`

Confusion closing (A rows, B columns): `{"na": {"na": 3}, "no": {"na": 1, "no": 6, "yes": 1}, "yes": {"yes": 1}}`

Confusion violations (A rows, B columns): `{"no": {"no": 9, "yes": 1}, "yes": {"yes": 2}}`

## Pooled

- n: 96, exact: 85, rate: 0.885, 95% CI: [0.802, 0.958]

## Totals

- n: 12, MAE: 4.558, max error: 29.240, 95% CI: [0.957, 9.659], skipped: 0

## Violations

- tp: 2, fp: 1, fn: 0, precision: 0.667, recall: 1.000

## Breakdown

| group    | value      | n   | exact rate |
| -------- | ---------- | --- | ---------- |
| language | RU         | 48  | 0.875      |
| language | KZ         | 24  | 0.958      |
| language | EN         | 24  | 0.833      |
| channel  | agent chat | 96  | 0.885      |
| channel  | voice call | 0   | -          |

## Run health

- dialogs: 59
- failed samples: 0
- mean latency ms: 4146.745762711865
- cost USD: 0.37156414
- missing from run: none

## Mismatches

Count: 11
