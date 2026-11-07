# Comparison report: prompt-before-vs-final

- Created: 2026-11-07T15:49:03+00:00
- Mode: run
- Set: p1-ru-003,p1-ru-007,p1-ru-022,p1-ru-025,p1-ru-028,p1-ru-029,p1-kz-003,p1-kz-008,p1-kz-011,p1-en-008,p1-en-009,p1-en-014
- Labeler A: final
- Run: promptVersion=p-433387c8, provider=hf-router, model=Qwen/Qwen3.8-27B:cerebras

## Per criterion

| criterion     | n   | exact | exact rate | kappa | qwk   | NA agreement |
| ------------- | --- | ----- | ---------- | ----- | ----- | ------------ |
| opening       | 12  | 12    | 1.000      | 1.000 | -     | -            |
| understanding | 12  | 10    | 0.833      | 0.600 | -     | 0.833        |
| verification  | 12  | 11    | 0.917      | 0.765 | -     | 0.917        |
| guidance      | 12  | 10    | 0.833      | 0.767 | 0.883 | 1.000        |
| empathy       | 12  | 12    | 1.000      | 1.000 | -     | -            |
| management    | 12  | 8     | 0.667      | 0.489 | 0.576 | -            |
| closing       | 12  | 11    | 0.917      | 0.844 | -     | 1.000        |
| violations    | 12  | 12    | 1.000      | 1.000 | -     | -            |

Confusion opening (A rows, B columns): `{"no": {"no": 1}, "yes": {"yes": 11}}`

Confusion understanding (A rows, B columns): `{"na": {"na": 8, "no": 1, "yes": 1}, "no": {"no": 1}, "yes": {"yes": 1}}`

Confusion verification (A rows, B columns): `{"na": {"na": 9}, "no": {"na": 1, "no": 1}, "yes": {"yes": 1}}`

Confusion guidance (A rows, B columns): `{"0": {"0": 1, "10": 1}, "10": {"10": 2}, "15": {"15": 1}, "20": {"15": 1, "20": 5}, "na": {"na": 1}}`

Confusion empathy (A rows, B columns): `{"no": {"no": 3}, "yes": {"yes": 9}}`

Confusion management (A rows, B columns): `{"0": {"0": 1, "7": 2}, "4": {"10": 1}, "7": {"7": 2, "10": 1}, "10": {"10": 5}}`

Confusion closing (A rows, B columns): `{"na": {"na": 3}, "no": {"no": 7, "yes": 1}, "yes": {"yes": 1}}`

Confusion violations (A rows, B columns): `{"no": {"no": 9}, "yes": {"yes": 3}}`

## Pooled

- n: 96, exact: 86, rate: 0.896, 95% CI: [0.844, 0.958]

## Totals

- n: 12, MAE: 5.473, max error: 24.120, 95% CI: [1.315, 10.168], skipped: 0

## Violations

- tp: 3, fp: 0, fn: 0, precision: 1.000, recall: 1.000

## Breakdown

| group    | value      | n   | exact rate |
| -------- | ---------- | --- | ---------- |
| language | RU         | 48  | 0.833      |
| language | KZ         | 24  | 1.000      |
| language | EN         | 24  | 0.917      |
| channel  | agent chat | 96  | 0.896      |
| channel  | voice call | 0   | -          |

## Run health

- dialogs: 59
- failed samples: 0
- mean latency ms: 3110.2203389830506
- cost USD: 0.39824771
- missing from run: none

## Mismatches

Count: 10
