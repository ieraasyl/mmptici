# Comparison report: prompt-checks-vs-manual-v2

- Created: 2026-11-07T20:26:16+00:00
- Mode: run
- Set: all
- Labeler A: manual
- Run: promptVersion=p-ffbe6d0e, provider=hf-router, model=Qwen/Qwen3.8-27B:cerebras

## Per criterion

| criterion     | n   | exact | exact rate | kappa | qwk   | NA agreement |
| ------------- | --- | ----- | ---------- | ----- | ----- | ------------ |
| opening       | 59  | 58    | 0.983      | 0.848 | -     | -            |
| understanding | 59  | 50    | 0.847      | 0.689 | -     | 0.847        |
| verification  | 59  | 57    | 0.966      | 0.885 | -     | 0.966        |
| guidance      | 59  | 54    | 0.915      | 0.784 | 0.938 | 1.000        |
| empathy       | 59  | 57    | 0.966      | 0.838 | -     | -            |
| management    | 56  | 49    | 0.875      | 0.742 | 0.815 | -            |
| closing       | 59  | 52    | 0.881      | 0.749 | -     | 0.983        |
| violations    | 59  | 58    | 0.983      | 0.914 | -     | -            |

Confusion opening (A rows, B columns): `{"no": {"no": 3, "yes": 1}, "yes": {"yes": 55}}`

Confusion understanding (A rows, B columns): `{"na": {"na": 35, "no": 2, "yes": 3}, "no": {"na": 4, "no": 3}, "yes": {"yes": 12}}`

Confusion verification (A rows, B columns): `{"na": {"na": 48, "no": 1}, "no": {"na": 1, "no": 3}, "yes": {"yes": 6}}`

Confusion guidance (A rows, B columns): `{"0": {"0": 2, "5": 1, "10": 1}, "10": {"10": 5}, "15": {"15": 2}, "20": {"15": 3, "20": 44}, "na": {"na": 1}}`

Confusion empathy (A rows, B columns): `{"no": {"no": 6, "yes": 2}, "yes": {"yes": 51}}`

Confusion management (A rows, B columns): `{"0": {"4": 1, "7": 2}, "4": {"4": 5, "7": 1}, "7": {"7": 7, "10": 1}, "10": {"7": 2, "10": 37}}`

Confusion closing (A rows, B columns): `{"na": {"na": 6, "yes": 1}, "no": {"no": 38, "yes": 6}, "yes": {"yes": 8}}`

Confusion violations (A rows, B columns): `{"no": {"no": 52}, "yes": {"no": 1, "yes": 6}}`

## Pooled

- n: 469, exact: 435, rate: 0.928, 95% CI: [0.897, 0.955]

## Totals

- n: 56, MAE: 3.797, max error: 28.830, 95% CI: [2.292, 5.505], skipped: 3

## Violations

- tp: 6, fp: 0, fn: 1, precision: 1.000, recall: 0.857

## Breakdown

| group    | value      | n   | exact rate |
| -------- | ---------- | --- | ---------- |
| language | RU         | 261 | 0.923      |
| language | KZ         | 104 | 0.933      |
| language | EN         | 104 | 0.933      |
| channel  | agent chat | 438 | 0.934      |
| channel  | voice call | 31  | 0.839      |

## Run health

- dialogs: 59
- failed samples: 0
- mean latency ms: 7723.271186440678
- cost USD: 0.58615286
- missing from run: p1-en-001, p1-en-004, p1-kz-012, p1-kz-013, p1-ru-012, p4-ru-002

## Mismatches

Count: 34
