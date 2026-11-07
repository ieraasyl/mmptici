# Comparison report: prompt-russian-vs-manual

- Created: 2026-11-07T18:19:32+00:00
- Mode: run
- Set: all
- Labeler A: manual
- Run: promptVersion=p-f76b3f98, provider=hf-router, model=Qwen/Qwen3.8-27B:cerebras

## Per criterion

| criterion     | n   | exact | exact rate | kappa | qwk   | NA agreement |
| ------------- | --- | ----- | ---------- | ----- | ----- | ------------ |
| opening       | 59  | 59    | 1.000      | 1.000 | -     | -            |
| understanding | 56  | 47    | 0.839      | 0.665 | -     | 0.857        |
| verification  | 53  | 47    | 0.887      | 0.653 | -     | 0.887        |
| guidance      | 57  | 49    | 0.860      | 0.639 | 0.892 | 1.000        |
| empathy       | 59  | 55    | 0.932      | 0.677 | -     | -            |
| management    | 56  | 46    | 0.821      | 0.608 | 0.605 | -            |
| closing       | 55  | 48    | 0.873      | 0.724 | -     | 0.982        |
| violations    | 59  | 58    | 0.983      | 0.914 | -     | -            |

Confusion opening (A rows, B columns): `{"no": {"no": 4}, "yes": {"yes": 55}}`

Confusion understanding (A rows, B columns): `{"na": {"na": 34, "no": 2, "yes": 4}, "no": {"na": 1, "no": 3}, "yes": {"na": 1, "no": 1, "yes": 10}}`

Confusion verification (A rows, B columns): `{"na": {"na": 40, "no": 1}, "no": {"na": 5, "no": 3}, "yes": {"yes": 4}}`

Confusion guidance (A rows, B columns): `{"0": {"0": 2, "5": 1, "10": 1}, "10": {"10": 5}, "15": {"20": 2}, "20": {"10": 1, "15": 3, "20": 41}, "na": {"na": 1}}`

Confusion empathy (A rows, B columns): `{"no": {"no": 5, "yes": 3}, "yes": {"no": 1, "yes": 50}}`

Confusion management (A rows, B columns): `{"0": {"7": 2, "10": 1}, "4": {"4": 4, "7": 2}, "7": {"7": 5, "10": 3}, "10": {"4": 1, "7": 1, "10": 37}}`

Confusion closing (A rows, B columns): `{"na": {"na": 5, "no": 1}, "no": {"no": 35, "yes": 4}, "yes": {"no": 2, "yes": 8}}`

Confusion violations (A rows, B columns): `{"no": {"no": 52, "yes": 1}, "yes": {"yes": 6}}`

## Pooled

- n: 454, exact: 409, rate: 0.901, 95% CI: [0.863, 0.934]

## Totals

- n: 44, MAE: 8.940, max error: 48.740, 95% CI: [5.322, 12.99], skipped: 15

## Violations

- tp: 6, fp: 1, fn: 0, precision: 0.857, recall: 1.000

## Breakdown

| group    | value      | n   | exact rate |
| -------- | ---------- | --- | ---------- |
| language | RU         | 254 | 0.890      |
| language | KZ         | 100 | 0.950      |
| language | EN         | 100 | 0.880      |
| channel  | agent chat | 425 | 0.908      |
| channel  | voice call | 29  | 0.793      |

## Run health

- dialogs: 59
- failed samples: 0
- mean latency ms: 4762.186440677966
- cost USD: 0.69233397
- missing from run: p1-en-001, p1-en-004, p1-kz-012, p1-kz-013, p1-ru-012, p4-ru-002

## Mismatches

Count: 45
