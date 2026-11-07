# Baseline notes for ML A, 2026-11-07

Prompt `p-ec2a86d6` is the evaluator on main at `6e0f187`: `apps/api/src/inference`, Qwen3.8-27B on Cerebras through the Hugging Face router. No labels exist yet, so these are observations, not accuracy numbers. The detailed tables are in [baseline-dev-s1.md](baseline-dev-s1.md) (59 dialogs, 1 sample, T=0) and [baseline-tuning-s3.md](baseline-tuning-s3.md) (14 tuning dialogs, 3 samples, T=0.6).

## Endpoint facts (task B6a)

There is one endpoint: the Hugging Face router, `https://router.huggingface.co/v1/chat/completions`, model `Qwen/Qwen3.8-27B:cerebras`. The team has no separate self-hosted endpoint yet, so local mode (B6) has nothing to point at.

| Fact            | Value                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------- |
| API             | OpenAI-compatible chat completions                                                                |
| Reasoning       | Returned in `message.reasoning`; `message.content` holds only the answer                          |
| JSON mode       | `response_format: {"type":"json_object"}` honored; the app's prompt-only JSON also parses cleanly |
| Latency         | 3 to 4 s per chat, 5 to 13 s per voice call                                                       |
| Tokens per chat | about 1,500 in and 4,500 out, mostly reasoning                                                    |
| Cost            | about $0.006 per chat, $0.37 for 59 dialogs                                                       |
| Rate limit      | Tokens-per-minute quota. At concurrency 6, 7 of 59 dialogs got HTTP 429.                          |

## Findings

1. **No model output failed validation.** Across 59 single-sample dialogs, every reply that reached the model parsed and validated on the first attempt. All 7 first-run failures were HTTP 429 from the router. `run.ts` now backs off for about a minute, and all 59 completed.
2. **Long calls can exhaust the token budget.** One sample of p4-ru-003, 78 turns at T=0.6, hit `max_tokens` 8000 inside its reasoning and returned an empty answer. The client throws a plain `Error`, so `evaluateConversation`'s repair retry does not catch it. Consider a higher `maxTokens` for voice calls, or retrying an empty answer once.
3. **Closing is "no" in 40 of 59 dialogs.** The model applies the strict reading: a goodbye plus a summary or an offer of help. Many chats end with only a thank-you and a goodbye. This single rule moves 5 points on most dialogs and depends on organizer question 10.
4. **Two violation flags outside the known cases: p1-ru-009 and p1-en-014.** In both, the operator states an account restriction before any identity check, and the model calls that disclosure of confidential information. This is organizer question 6. All four known cases in this set were caught: p1-ru-022, p1-ru-023, p1-ru-029, p1-en-013.
5. **Least stable criteria across 3 samples: management, then understanding.** Answers were unanimous in 8 of 14 dialogs for management and 11 of 14 for understanding. Opening, verification, and violations were unanimous in all 14. Voting will matter most on the two scale-like judgments.
6. **Understanding is N/A in 37 of 59 dialogs, and verification in 47 of 59.** This matches the dataset's design, where most clients state the full request up front and ask general questions.

## How to reproduce

```
vp run calibrate:run --set dev --concurrency 4
vp run calibrate:run --rerun-failed tools/calibrate/runs/<name>.json
vp run calibrate:run --set tuning --samples 3
vp run calibrate:summarize tools/calibrate/runs/<name>.json --name <name>
```

Once labels exist: `vp run calibrate:compare --run tools/calibrate/runs/<name>.json --set tuning --name <name>`.
