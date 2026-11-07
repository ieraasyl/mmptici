# Comparison report: ai-labeler-agreement

- Created: 2026-11-07T14:51:11+00:00
- Mode: pairs
- Set: p1-ru-003,p1-ru-007,p1-ru-022,p1-ru-025,p1-ru-028,p1-ru-029,p1-kz-003,p1-kz-008,p1-kz-011,p1-en-008,p1-en-009,p1-en-014,p1-ru-012,p1-kz-012,p1-kz-013,p1-en-001,p1-en-004
- Labeler A: ai-fable
- Labeler B: ai-opus

## Per criterion

| criterion     | n   | exact | exact rate | kappa | qwk   | NA agreement |
| ------------- | --- | ----- | ---------- | ----- | ----- | ------------ |
| opening       | 17  | 17    | 1.000      | 1.000 | -     | -            |
| understanding | 17  | 16    | 0.941      | 0.878 | -     | 0.941        |
| verification  | 17  | 17    | 1.000      | 1.000 | -     | 1.000        |
| guidance      | 17  | 16    | 0.941      | 0.898 | 0.975 | 1.000        |
| empathy       | 17  | 17    | 1.000      | 1.000 | -     | -            |
| management    | 17  | 13    | 0.765      | 0.578 | 0.669 | -            |
| closing       | 17  | 17    | 1.000      | 1.000 | -     | 1.000        |
| violations    | 17  | 17    | 1.000      | 1.000 | -     | -            |

Confusion opening (A rows, B columns): `{"no": {"no": 1}, "yes": {"yes": 16}}`

Confusion understanding (A rows, B columns): `{"na": {"na": 11}, "no": {"na": 1, "no": 1}, "yes": {"yes": 4}}`

Confusion verification (A rows, B columns): `{"na": {"na": 15}, "no": {"no": 1}, "yes": {"yes": 1}}`

Confusion guidance (A rows, B columns): `{"0": {"0": 1}, "10": {"10": 2}, "15": {"15": 2, "20": 1}, "20": {"20": 10}, "na": {"na": 1}}`

Confusion empathy (A rows, B columns): `{"no": {"no": 3}, "yes": {"yes": 14}}`

Confusion management (A rows, B columns): `{"4": {"4": 2}, "7": {"4": 1, "7": 2}, "10": {"4": 1, "7": 2, "10": 9}}`

Confusion closing (A rows, B columns): `{"na": {"na": 4}, "no": {"no": 11}, "yes": {"yes": 2}}`

Confusion violations (A rows, B columns): `{"no": {"no": 14}, "yes": {"yes": 3}}`

## Pooled

- n: 136, exact: 130, rate: 0.956, 95% CI: [0.919, 0.985]

## Totals

- n: 17, MAE: 1.869, max error: 13.840, 95% CI: [0.408, 3.995], skipped: 0

## Violations

- tp: 3, fp: 0, fn: 0, precision: 1.000, recall: 1.000

## Breakdown

| group    | value      | n   | exact rate |
| -------- | ---------- | --- | ---------- |
| language | RU         | 56  | 0.946      |
| language | KZ         | 40  | 0.950      |
| language | EN         | 40  | 0.975      |
| channel  | agent chat | 136 | 0.956      |
| channel  | voice call | 0   | -          |

## Run health

Not applicable (pairs mode).

## Mismatches

Count: 6
