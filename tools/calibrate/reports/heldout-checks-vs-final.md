# Comparison report: heldout-checks-vs-final

- Created: 2026-11-07T18:14:38+00:00
- Mode: run
- Set: heldout
- Labeler A: final
- Run: promptVersion=p-5bd7ddaa, provider=hf-router, model=Qwen/Qwen3.8-27B:cerebras

## Per criterion

| criterion     | n   | exact | exact rate | kappa | qwk | NA agreement |
| ------------- | --- | ----- | ---------- | ----- | --- | ------------ |
| opening       | 5   | 5     | 1.000      | -     | -   | -            |
| understanding | 5   | 5     | 1.000      | 1.000 | -   | 1.000        |
| verification  | 5   | 5     | 1.000      | -     | -   | 1.000        |
| guidance      | 5   | 5     | 1.000      | -     | -   | 1.000        |
| empathy       | 5   | 5     | 1.000      | -     | -   | -            |
| management    | 5   | 5     | 1.000      | -     | -   | -            |
| closing       | 5   | 5     | 1.000      | 1.000 | -   | 1.000        |
| violations    | 5   | 5     | 1.000      | 1.000 | -   | -            |

Confusion opening (A rows, B columns): `{"yes": {"yes": 5}}`

Confusion understanding (A rows, B columns): `{"na": {"na": 4}, "yes": {"yes": 1}}`

Confusion verification (A rows, B columns): `{"na": {"na": 5}}`

Confusion guidance (A rows, B columns): `{"20": {"20": 5}}`

Confusion empathy (A rows, B columns): `{"yes": {"yes": 5}}`

Confusion management (A rows, B columns): `{"10": {"10": 5}}`

Confusion closing (A rows, B columns): `{"na": {"na": 1}, "no": {"no": 3}, "yes": {"yes": 1}}`

Confusion violations (A rows, B columns): `{"no": {"no": 4}, "yes": {"yes": 1}}`

## Pooled

- n: 40, exact: 40, rate: 1.000, 95% CI: [1.0, 1.0]

## Totals

- n: 5, MAE: 0.000, max error: 0.000, 95% CI: [0.0, 0.0], skipped: 0

## Violations

- tp: 1, fp: 0, fn: 0, precision: 1.000, recall: 1.000

## Breakdown

| group    | value      | n   | exact rate |
| -------- | ---------- | --- | ---------- |
| language | RU         | 8   | 1.000      |
| language | KZ         | 16  | 1.000      |
| language | EN         | 16  | 1.000      |
| channel  | agent chat | 40  | 1.000      |
| channel  | voice call | 0   | -          |

## Run health

- dialogs: 6
- failed samples: 0
- mean latency ms: 5223.666666666667
- cost USD: 0.06840343
- missing from run: none

## Mismatches

Count: 0
