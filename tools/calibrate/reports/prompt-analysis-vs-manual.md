# Comparison report: prompt-analysis-vs-manual

- Created: 2026-11-07T17:23:33+00:00
- Mode: run
- Set: all
- Labeler A: manual
- Run: promptVersion=p-423d3be6, provider=hf-router, model=Qwen/Qwen3.8-27B:cerebras

## Per criterion

| criterion     | n   | exact | exact rate | kappa | qwk   | NA agreement |
| ------------- | --- | ----- | ---------- | ----- | ----- | ------------ |
| opening       | 58  | 58    | 1.000      | 1.000 | -     | -            |
| understanding | 55  | 47    | 0.855      | 0.673 | -     | 0.855        |
| verification  | 52  | 48    | 0.923      | 0.746 | -     | 0.923        |
| guidance      | 56  | 47    | 0.839      | 0.631 | 0.906 | 1.000        |
| empathy       | 58  | 55    | 0.948      | 0.770 | -     | -            |
| management    | 55  | 44    | 0.800      | 0.584 | 0.661 | -            |
| closing       | 54  | 49    | 0.907      | 0.793 | -     | 0.963        |
| violations    | 58  | 58    | 1.000      | 1.000 | -     | -            |

Confusion opening (A rows, B columns): `{"no": {"no": 4}, "yes": {"yes": 54}}`

Confusion understanding (A rows, B columns): `{"na": {"na": 35, "no": 1, "yes": 4}, "no": {"na": 1, "no": 3}, "yes": {"na": 2, "yes": 9}}`

Confusion verification (A rows, B columns): `{"na": {"na": 41}, "no": {"na": 4, "no": 4}, "yes": {"yes": 3}}`

Confusion guidance (A rows, B columns): `{"0": {"0": 2, "5": 1, "10": 1}, "10": {"10": 5}, "15": {"15": 1, "20": 1}, "20": {"15": 6, "20": 38}, "na": {"na": 1}}`

Confusion empathy (A rows, B columns): `{"no": {"no": 6, "yes": 2}, "yes": {"no": 1, "yes": 49}}`

Confusion management (A rows, B columns): `{"0": {"7": 3}, "4": {"4": 3, "7": 3}, "7": {"4": 1, "7": 5, "10": 2}, "10": {"4": 1, "7": 1, "10": 36}}`

Confusion closing (A rows, B columns): `{"na": {"na": 4, "no": 2}, "no": {"no": 36, "yes": 3}, "yes": {"yes": 9}}`

Confusion violations (A rows, B columns): `{"no": {"no": 52}, "yes": {"yes": 6}}`

## Pooled

- n: 446, exact: 406, rate: 0.910, 95% CI: [0.877, 0.942]

## Totals

- n: 43, MAE: 7.568, max error: 36.830, 95% CI: [4.544, 10.893], skipped: 15

## Violations

- tp: 6, fp: 0, fn: 0, precision: 1.000, recall: 1.000

## Breakdown

| group    | value      | n   | exact rate |
| -------- | ---------- | --- | ---------- |
| language | RU         | 254 | 0.902      |
| language | KZ         | 92  | 0.924      |
| language | EN         | 100 | 0.920      |
| channel  | agent chat | 417 | 0.916      |
| channel  | voice call | 29  | 0.828      |

## Run health

- dialogs: 59
- failed samples: 1
- mean latency ms: 8371.084745762711
- cost USD: 0.59011775
- missing from run: p1-en-001, p1-en-004, p1-kz-003, p1-kz-012, p1-kz-013, p1-ru-012, p4-ru-002

## Mismatches

Count: 40
