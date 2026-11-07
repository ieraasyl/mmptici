# Comparison report: heldout-checks-vs-manual

- Created: 2026-11-07T18:14:37+00:00
- Mode: run
- Set: heldout
- Labeler A: manual
- Run: promptVersion=p-5bd7ddaa, provider=hf-router, model=Qwen/Qwen3.8-27B:cerebras

## Per criterion

| criterion     | n   | exact | exact rate | kappa | qwk   | NA agreement |
| ------------- | --- | ----- | ---------- | ----- | ----- | ------------ |
| opening       | 6   | 5     | 0.833      | 0.000 | -     | -            |
| understanding | 6   | 5     | 0.833      | 0.571 | -     | 0.833        |
| verification  | 3   | 3     | 1.000      | 1.000 | -     | 1.000        |
| guidance      | 6   | 5     | 0.833      | 0.000 | 0.000 | 1.000        |
| empathy       | 6   | 6     | 1.000      | -     | -     | -            |
| management    | 6   | 6     | 1.000      | -     | -     | -            |
| closing       | 6   | 6     | 1.000      | 1.000 | -     | 1.000        |
| violations    | 6   | 6     | 1.000      | 1.000 | -     | -            |

Confusion opening (A rows, B columns): `{"yes": {"no": 1, "yes": 5}}`

Confusion understanding (A rows, B columns): `{"na": {"na": 4}, "yes": {"na": 1, "yes": 1}}`

Confusion verification (A rows, B columns): `{"na": {"na": 2}, "yes": {"yes": 1}}`

Confusion guidance (A rows, B columns): `{"20": {"15": 1, "20": 5}}`

Confusion empathy (A rows, B columns): `{"yes": {"yes": 6}}`

Confusion management (A rows, B columns): `{"10": {"10": 6}}`

Confusion closing (A rows, B columns): `{"na": {"na": 1}, "no": {"no": 4}, "yes": {"yes": 1}}`

Confusion violations (A rows, B columns): `{"no": {"no": 5}, "yes": {"yes": 1}}`

## Pooled

- n: 45, exact: 42, rate: 0.933, 95% CI: [0.804, 1.0]

## Totals

- n: 3, MAE: 6.177, max error: 18.530, 95% CI: [0.0, 12.353], skipped: 3

## Violations

- tp: 1, fp: 0, fn: 0, precision: 1.000, recall: 1.000

## Breakdown

| group    | value      | n   | exact rate |
| -------- | ---------- | --- | ---------- |
| language | RU         | 16  | 0.812      |
| language | KZ         | 14  | 1.000      |
| language | EN         | 15  | 1.000      |
| channel  | agent chat | 37  | 1.000      |
| channel  | voice call | 8   | 0.625      |

## Run health

- dialogs: 6
- failed samples: 0
- mean latency ms: 5223.666666666667
- cost USD: 0.06840343
- missing from run: none

## Mismatches

Count: 3
