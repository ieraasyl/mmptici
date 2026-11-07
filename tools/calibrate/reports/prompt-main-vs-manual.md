# Comparison report: prompt-main-vs-manual

- Created: 2026-11-07T17:23:33+00:00
- Mode: run
- Set: all
- Labeler A: manual
- Run: promptVersion=p-a8c3acef, provider=hf-router, model=Qwen/Qwen3.8-27B:cerebras

## Per criterion

| criterion     | n   | exact | exact rate | kappa | qwk   | NA agreement |
| ------------- | --- | ----- | ---------- | ----- | ----- | ------------ |
| opening       | 59  | 58    | 0.983      | 0.848 | -     | -            |
| understanding | 56  | 49    | 0.875      | 0.721 | -     | 0.875        |
| verification  | 53  | 47    | 0.887      | 0.653 | -     | 0.887        |
| guidance      | 57  | 50    | 0.877      | 0.714 | 0.922 | 1.000        |
| empathy       | 59  | 56    | 0.949      | 0.771 | -     | -            |
| management    | 56  | 45    | 0.804      | 0.586 | 0.698 | -            |
| closing       | 55  | 49    | 0.891      | 0.773 | -     | 0.982        |
| violations    | 59  | 59    | 1.000      | 1.000 | -     | -            |

Confusion opening (A rows, B columns): `{"no": {"no": 3, "yes": 1}, "yes": {"yes": 55}}`

Confusion understanding (A rows, B columns): `{"na": {"na": 36, "no": 1, "yes": 3}, "no": {"na": 1, "no": 3}, "yes": {"na": 2, "yes": 10}}`

Confusion verification (A rows, B columns): `{"na": {"na": 40, "no": 1}, "no": {"na": 5, "no": 3}, "yes": {"yes": 4}}`

Confusion guidance (A rows, B columns): `{"0": {"0": 2, "5": 1, "10": 1}, "10": {"10": 5}, "15": {"15": 2}, "20": {"15": 5, "20": 40}, "na": {"na": 1}}`

Confusion empathy (A rows, B columns): `{"no": {"no": 6, "yes": 2}, "yes": {"no": 1, "yes": 50}}`

Confusion management (A rows, B columns): `{"0": {"4": 1, "7": 2}, "4": {"4": 3, "7": 2, "10": 1}, "7": {"7": 6, "10": 2}, "10": {"7": 3, "10": 36}}`

Confusion closing (A rows, B columns): `{"na": {"na": 5, "yes": 1}, "no": {"no": 35, "yes": 4}, "yes": {"no": 1, "yes": 9}}`

Confusion violations (A rows, B columns): `{"no": {"no": 53}, "yes": {"yes": 6}}`

## Pooled

- n: 454, exact: 413, rate: 0.910, 95% CI: [0.877, 0.939]

## Totals

- n: 44, MAE: 7.149, max error: 36.830, 95% CI: [4.369, 10.249], skipped: 15

## Violations

- tp: 6, fp: 0, fn: 0, precision: 1.000, recall: 1.000

## Breakdown

| group    | value      | n   | exact rate |
| -------- | ---------- | --- | ---------- |
| language | RU         | 254 | 0.882      |
| language | KZ         | 100 | 0.970      |
| language | EN         | 100 | 0.920      |
| channel  | agent chat | 425 | 0.918      |
| channel  | voice call | 29  | 0.793      |

## Run health

- dialogs: 59
- failed samples: 0
- mean latency ms: 2659.237288135593
- cost USD: 0.38969888
- missing from run: p1-en-001, p1-en-004, p1-kz-012, p1-kz-013, p1-ru-012, p4-ru-002

## Mismatches

Count: 41
