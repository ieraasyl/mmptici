# Calibration index

One row per run report, oldest first. KZ gap is the KZ agreement minus the mean of RU and EN, in points. Verdicts come from `verdicts.json`.

| Report                    | Reference | Prompt     | Provider  | Dialogs | Pooled agreement | opening | understanding | verification | guidance | empathy | management | closing | violations | MAE   | KZ gap | Verdict  | Note                                          |
| ------------------------- | --------- | ---------- | --------- | ------- | ---------------- | ------- | ------------- | ------------ | -------- | ------- | ---------- | ------- | ---------- | ----- | ------ | -------- | --------------------------------------------- |
| baseline-s1-vs-final      | final     | p-ec2a86d6 | hf-router | 59      | 85/96 (88.5%)    | 100.0%  | 83.3%         | 100.0%       | 75.0%    | 100.0%  | 75.0%      | 83.3%   | 91.7%      | 4.56  | +10.4  | info     | earlier baseline                              |
| baseline-s3-vs-final      | final     | p-ec2a86d6 | hf-router | 14      | 84/96 (87.5%)    | 100.0%  | 66.7%         | 100.0%       | 83.3%    | 100.0%  | 66.7%      | 91.7%   | 91.7%      | 5.30  | +11.5  | info     | earlier baseline, 3 samples                   |
| pr4-s1-vs-final           | final     | p-433387c8 | hf-router | 12      | 84/96 (87.5%)    | 100.0%  | 75.0%         | 100.0%       | 75.0%    | 100.0%  | 66.7%      | 91.7%   | 91.7%      | 8.11  | +9.4   | info     | PR 4 prompt                                   |
| prompt-after-vs-manual    | manual    | p-3379efcc | hf-router | 59      | 411/454 (90.5%)  | 98.3%   | 85.7%         | 90.6%        | 87.7%    | 93.2%   | 80.4%      | 89.1%   | 98.3%      | 6.34  | +5.8   | rejected | within noise or worse than main               |
| prompt-before-vs-manual   | manual    | p-433387c8 | hf-router | 59      | 416/454 (91.6%)  | 100.0%  | 85.7%         | 90.6%        | 87.7%    | 96.6%   | 82.1%      | 89.1%   | 100.0%     | 6.23  | +5.7   | info     | prompt on main                                |
| prompt-v3-vs-manual       | manual    | p-8719f9b6 | hf-router | 59      | 387/449 (86.2%)  | 98.3%   | 83.6%         | 48.1%        | 86.0%    | 96.6%   | 83.9%      | 92.7%   | 96.6%      | 11.38 | +2.8   | rejected | wider verification rule over-triggers         |
| prompt-v4-vs-manual       | manual    | p-412d42a0 | hf-router | 59      | 409/449 (91.1%)  | 100.0%  | 83.6%         | 90.4%        | 86.0%    | 100.0%  | 78.6%      | 92.7%   | 96.6%      | 4.93  | +2.0   | rejected | within noise of main                          |
| prompt-after-vs-final     | final     | p-3379efcc | hf-router | 59      | 85/96 (88.5%)    | 100.0%  | 75.0%         | 91.7%        | 91.7%    | 91.7%   | 66.7%      | 91.7%   | 100.0%     | 6.36  | +4.2   | info     | same run against the final labels             |
| prompt-before-vs-final    | final     | p-433387c8 | hf-router | 59      | 86/96 (89.6%)    | 100.0%  | 83.3%         | 91.7%        | 83.3%    | 100.0%  | 66.7%      | 91.7%   | 100.0%     | 5.47  | +12.5  | info     | same run against the final labels             |
| prompt-v5-vs-manual       | manual    | p-2cb88e6a | hf-router | 59      | 407/454 (89.6%)  | 100.0%  | 85.7%         | 90.6%        | 87.7%    | 91.5%   | 75.0%      | 85.5%   | 100.0%     | 7.86  | +3.9   | rejected | within noise or worse than main               |
| prompt-analysis-vs-manual | manual    | p-423d3be6 | hf-router | 59      | 406/446 (91.0%)  | 100.0%  | 85.5%         | 92.3%        | 83.9%    | 94.8%   | 80.0%      | 90.7%   | 100.0%     | 7.57  | +1.3   | rejected | analysis object first, lost 7 cells           |
| prompt-checks-vs-manual   | manual    | p-ffbe6d0e | hf-router | 59      | 420/454 (92.5%)  | 98.3%   | 85.7%         | 88.7%        | 91.2%    | 96.6%   | 87.5%      | 90.9%   | 100.0%     | 5.17  | +3.7   | accepted | per-criterion checks before each answer       |
| prompt-main-vs-manual     | manual    | p-a8c3acef | hf-router | 59      | 413/454 (91.0%)  | 98.3%   | 87.5%         | 88.7%        | 87.7%    | 94.9%   | 80.4%      | 89.1%   | 100.0%     | 7.15  | +6.9   | baseline | prompt on main, same-day baseline for round 2 |

## Kazakh check

KZ is within 10 points of RU and EN in every run report.
