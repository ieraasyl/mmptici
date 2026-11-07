# Comparison report: prompt-checks-vs-manual

- Created: 2026-11-07T17:23:33+00:00
- Mode: run
- Set: all
- Labeler A: manual
- Run: promptVersion=p-ffbe6d0e, provider=hf-router, model=Qwen/Qwen3.8-27B:cerebras

## Per criterion

| criterion     | n   | exact | exact rate | kappa | qwk   | NA agreement |
| ------------- | --- | ----- | ---------- | ----- | ----- | ------------ |
| opening       | 59  | 58    | 0.983      | 0.848 | -     | -            |
| understanding | 56  | 48    | 0.857      | 0.689 | -     | 0.857        |
| verification  | 53  | 47    | 0.887      | 0.653 | -     | 0.887        |
| guidance      | 57  | 52    | 0.912      | 0.782 | 0.938 | 1.000        |
| empathy       | 59  | 57    | 0.966      | 0.838 | -     | -            |
| management    | 56  | 49    | 0.875      | 0.742 | 0.815 | -            |
| closing       | 55  | 50    | 0.909      | 0.807 | -     | 0.982        |
| violations    | 59  | 59    | 1.000      | 1.000 | -     | -            |

Confusion opening (A rows, B columns): `{"no": {"no": 3, "yes": 1}, "yes": {"yes": 55}}`

Confusion understanding (A rows, B columns): `{"na": {"na": 35, "no": 3, "yes": 2}, "no": {"na": 2, "no": 2}, "yes": {"na": 1, "yes": 11}}`

Confusion verification (A rows, B columns): `{"na": {"na": 40, "no": 1}, "no": {"na": 5, "no": 3}, "yes": {"yes": 4}}`

Confusion guidance (A rows, B columns): `{"0": {"0": 2, "5": 1, "10": 1}, "10": {"10": 5}, "15": {"15": 2}, "20": {"15": 3, "20": 42}, "na": {"na": 1}}`

Confusion empathy (A rows, B columns): `{"no": {"no": 6, "yes": 2}, "yes": {"yes": 51}}`

Confusion management (A rows, B columns): `{"0": {"4": 1, "7": 2}, "4": {"4": 5, "7": 1}, "7": {"7": 7, "10": 1}, "10": {"7": 2, "10": 37}}`

Confusion closing (A rows, B columns): `{"na": {"na": 5, "yes": 1}, "no": {"no": 36, "yes": 3}, "yes": {"no": 1, "yes": 9}}`

Confusion violations (A rows, B columns): `{"no": {"no": 53}, "yes": {"yes": 6}}`

## Pooled

- n: 454, exact: 420, rate: 0.925, 95% CI: [0.893, 0.954]

## Totals

- n: 44, MAE: 5.169, max error: 32.440, 95% CI: [2.882, 8.162], skipped: 15

## Violations

- tp: 6, fp: 0, fn: 0, precision: 1.000, recall: 1.000

## Breakdown

| group    | value      | n   | exact rate |
| -------- | ---------- | --- | ---------- |
| language | RU         | 254 | 0.906      |
| language | KZ         | 100 | 0.960      |
| language | EN         | 100 | 0.940      |
| channel  | agent chat | 425 | 0.932      |
| channel  | voice call | 29  | 0.828      |

## Run health

- dialogs: 59
- failed samples: 0
- mean latency ms: 7757.5084745762715
- cost USD: 0.58615286
- missing from run: p1-en-001, p1-en-004, p1-kz-012, p1-kz-013, p1-ru-012, p4-ru-002

## Mismatches

Count: 34
