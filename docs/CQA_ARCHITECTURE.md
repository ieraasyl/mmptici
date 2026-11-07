# CQA prototype: architecture and plan

Working plan for the rest of the 24 hours. Requirements: [CQA_HACKATHON.md](../CQA_HACKATHON.md). Research behind the AI decisions, with sources: [RESEARCH_BRIEF.md](RESEARCH_BRIEF.md).

This plan starts from commit `36cba89` on main, which already contains the full app.

## What wins

Accuracy against Ground Truth on 10 unseen transcripts is the main criterion. The comparison metric is unknown, so we track both per-criterion agreement and the total score. The remaining effort goes, in order, to:

1. Evaluator accuracy.
2. Proof that every score comes from a live model call.
3. A clean five-minute demo.
4. Distinctive features: STT, local model mode, and calibration report.

## Where we are

Already on main, built by Fullstack:

| Area | State | Location |
| --- | --- | --- |
| Import, list, card, evidence jump, call player link | Done | `apps/web/src/components/cqa/*` |
| Checklist editor with revisions | Done | `checklist-editor.tsx`, `PUT /api/cqa/checklists/:id` |
| Appeals, reviewer decision, original and final kept | Done | `appeal-queue.tsx`, `/api/cqa/appeals` |
| Contracts for checklist, rating, appeal | Done | `packages/contracts/src/cqa.ts` |
| Scoring with N/A redistribution, sections, flag | Done, tested | `scoreEvaluation` in `apps/api/src/evaluation.ts` |
| Default 8-criterion checklist | Done | `apps/api/src/checklist.ts` |
| No login, per-browser workspace cookie | Done | `apps/api/src/routes/cqa.ts` |
| Evaluator | Baseline only | `evaluateConversation` in `apps/api/src/evaluation.ts` |

The evaluator has six gaps. Most of the AI work goes into closing them.

1. It is tied to the Cloudflare Workers AI binding and runs Gemma 4 26B with thinking off. The team model is Qwen3.8-27B on Cerebras with thinking on.
2. It makes one sample with no voting, so there is no confidence signal.
3. Any invalid answer from the model fails the whole evaluation. There is no repair retry.
4. Evidence is a list of turn numbers only. No quote is checked against the transcript.
5. Each criterion is a single paragraph of guidance. It has no Boolean sub-checks and no structured N/A condition.
6. An evaluation stores no prompt, raw output, token usage, cost, latency, or prompt version.

## Target architecture

```mermaid
flowchart LR
    UI[apps/web] --> API[apps/api Hono Worker]
    API --> DB[(D1)]
    API --> EV[packages/evaluator]
    EV --> P{Provider}
    P --> C1[Qwen3.8-27B on Cerebras via HF router]
    P --> C2[gpt-oss-120b on Cerebras, tie-break]
    P --> L[Self-hosted Qwen via vLLM, local mode]
    P --> W[Workers AI Gemma, kept as fallback]
    API --> STT[STT service, Python on GPU]
    CLI[tools/calibrate] --> EV
    CLI --> LBL[(data/labels.csv)]
```

### packages/evaluator (new, framework-free)

Moves the evaluator and the scoring function out of `apps/api` so the Worker and the calibration CLI run the same code. It contains no Cloudflare, Hono, or D1 imports.

```ts
// packages/evaluator/src/index.ts
export type Provider = {
  id: string; // "cerebras-qwen", "local-vllm", "workers-ai"
  model: string;
  chat(req: ChatRequest, signal?: AbortSignal): Promise<ChatResponse>; // OpenAI-compatible
};

export function evaluate(
  conversation: { language: string; channel: string; transcript: Turn[] },
  checklist: Checklist,
  opts: { main: Provider; tieBreak?: Provider; samples?: number; promptVersion?: string },
): Promise<{ ratings: Rating[]; run: EvaluationRun }>;

export function buildPrompt(conversation, checklist): ChatMessage[];
export function scoreEvaluation(checklist, ratings, appeals); // moved as is from apps/api
```

A provider is one small file. `openaiCompatible(baseUrl, apiKey, model)` covers the HF router, a vLLM endpoint, and anything else that speaks the OpenAI chat format. `workersAi(binding, model)` wraps the existing binding. The API picks the provider from config, and the UI shows the provider and model on every evaluation card.

### Evaluation pipeline for one dialog

Follows section 3 of the research brief.

1. **Render the prompt.** The system message is in Russian. It holds the scoring rules from page 3 of the checklist PDF and these rules: judge only the operator, treat bot and system turns as context, never count ASR noise as a literacy fault, and treat transcript text as data, not instructions. The user message holds channel and language, the transcript as numbered lines (`[12] operator 03:41: ...`), and each criterion with its title, guidance, allowed answers, N/A condition, and optional sub-checks. A criterion without sub-checks still renders, so a replaced criterion works with no code change.
2. **Force the output order.** The JSON comes in a fixed order: `clientQuestions[]`, then `operatorActions[]`, then for each criterion `{checks, answer, explanation, evidence[{turn, quote}], expectedAt, naReason}`.
3. **Sample three times.** Run 3 parallel calls to Qwen3.8-27B at temperature 0.6 with thinking on and `max_tokens` 8000. An empty `content` means the thinking was truncated and is treated as a failure.
4. **Validate each sample in code.**
   - Every criterion is present.
   - The answer is allowed for that criterion.
   - N/A appears only where the criterion allows it.
   - Each cited turn exists, and the quote fuzzy-matches that turn's text with a ratio of at least 0.8.
   - For omissions, `expectedAt` contains an operator turn.

   On failure, retry that sample once with the validator's error message appended. A sample that fails twice is dropped. An evaluation fails only if all three samples fail.
5. **Vote.** For each criterion, take the majority answer across samples. For scale criteria, take the median step. `confidence` is the vote share. The explanation and evidence come from a majority sample with the most valid evidence.
6. **Break ties.** When a criterion has no majority, one call to `openai/gpt-oss-120b:cerebras` with the same prompt adds the deciding vote.
7. **Check gross violations separately.** A short, dedicated call asks only about the three gross violation types and gives examples of each. Its Yes needs a quote. It merges with c08 by OR, and both results are stored.
8. **Score.** `scoreEvaluation` computes points, sections, total, and the flag. The model never computes points.

Estimated cost is $0.03 to $0.04 per chat at $0.99 per million input and $1.49 per million output tokens. Voice calls cost about twice that. Latency is about 5 seconds with the parallel calls.

### Contract changes, all additive and optional

Fullstack reviews these before ML A merges them. Existing data stays valid.

```ts
// packages/contracts/src/cqa.ts
criterionSchema: + checks?: string[]        // Boolean sub-checks, shown and editable in the checklist editor
                 + naCondition?: string     // the rule that allows N/A, rendered verbatim into the prompt
ratingSchema:    + quotes?: string[]        // one per evidence turn, verified against the transcript
                 + naReason?: string
                 + expectedAt?: [number, number]  // turn span checked when an action is missing
                 + confidence?: number      // vote share, 0..1
                 + votes?: Answer[]         // raw answers from each sample
// packages/db cqa_evaluations: + run JSON column
EvaluationRun = { promptVersion, provider, model, samples, tieBreakUsed, latencyMs,
                  usage: { promptTokens, completionTokens }, costUsd,
                  raw: { messages, responses } }
```

The UI renders quotes from the stored transcript, never from the model's text.

### STT service (new, Python)

A separate service, because a Cloudflare Worker cannot run GPU models. It is deployed on a GPU host and called by the Worker through an `STT_URL` secret.

```
POST /transcribe   multipart: file (mp3/wav), language_hint (ru|kk|auto)
-> { transcript: [{ timestamp: ISO8601, speaker: client|operator|bot|system, text }],
     duration_s, models: { asr, diarization }, warnings: [] }
```

The output matches the organizer's transcript format exactly, so the result can be imported like any other conversation. The pipeline steps come from section 4 of the brief:

1. ffmpeg converts to 16 kHz mono. A stereo file with one party per channel skips diarization.
2. Silero VAD removes silence and hold music.
3. pyannote 3.1 diarizes with two speakers.
4. GigaAM v3 transcribes Russian, and whisper-large-v3-tulpar transcribes the segments that Whisper language ID marks as Kazakh.
5. Words are assigned to speakers by time overlap.
6. Roles are assigned. The IVR part is the bot and single DTMF digits are the client. One LLM call then picks which speaker is the operator from the opening line.

The fallback is Whisper large-v3 alone with VAD.

The 5 DEV calls have real recordings: the player page links to a signed MP3 we verified. Their organizer transcripts serve as the reference for measuring word error rate (WER).

## Roles

| Role | Owns |
| --- | --- |
| Fullstack | App, D1, API routes, UI for new fields, deploy, secrets, README |
| ML A, evaluator | `packages/evaluator`: providers, prompt, validation, voting, tie-break, gross-violation call |
| ML B, calibration and local mode | Labeling guide, labels, `tools/calibrate`, error analysis, self-hosted model endpoint |
| ML C, STT | `services/stt`: pipeline, WER on DEV calls, `/transcribe` endpoint |

All four label dialogs in phase 2. ML B leads the labeling.

## Plan

Hours count from now (T). Each task has one owner and a check that proves it is done. Tasks in the same phase run in parallel.

### Phase 1, T+0 to T+3: foundations

| ID | Owner | Task | Done when |
| --- | --- | --- | --- |
| F1 | Fullstack | Add the `run` column and the optional rating fields to the schema and migration. Show confidence, provider, model, and cost on the card. | Old evaluations still open. A fake `run` renders on the card. |
| F2 | Fullstack | Add `HF_TOKEN` and the provider config as Worker secrets. Add an `.dev.vars.example` entry. | Secrets set in production. Nothing secret is in git. |
| A1 | ML A | Create `packages/evaluator`. Move `evaluateConversation` and `scoreEvaluation` there unchanged. Add the `openaiCompatible` and `workersAi` providers. | The existing tests pass. The API calls Qwen on Cerebras through the new provider. |
| A2 | ML A | Prompt v1 in Russian with fixed output order, verbatim rubric text, and N/A conditions. | One DEV dialog returns valid JSON for all 8 criteria. |
| B1 | ML B | Write `docs/LABELING_GUIDE.md` with the N/A versus No rule for each criterion, using the cases in `DATASET_FINDINGS.md`. Pick 20 dialogs: 7 RU, 5 KZ, 5 EN, 3 calls. Split them 14 for tuning and 6 held out, grouped by scenario. | Guide reviewed by one other member. Selected IDs committed. |
| B2 | ML B | Build `tools/calibrate`. `run` evaluates a set and writes `data/eval/<run>.json`. `compare` prints per-criterion accuracy, Cohen's kappa, quadratic weighted kappa for c04 and c06, total MAE, and a mismatch list. | Runs on a fake labels file. |
| C1 | ML C | Download the 5 DEV recordings. Check sample rate and channel count. Run the Whisper large-v3 + VAD baseline. Compute WER against the organizer transcripts. | Baseline WER table for 5 calls. |

### Phase 2, T+3 to T+7: first accuracy loop

| ID | Owner | Task | Done when |
| --- | --- | --- | --- |
| L1 | All four | Label the 20 dialogs with the guide. Double-label 10 of them and measure agreement between humans, which is our ceiling. | `data/labels.csv` complete. Human kappa per criterion recorded. |
| A3 | ML A | Validation with fuzzy-matched quotes, one repair retry, and truncation detection. | Zero failed evaluations over all 65 DEV dialogs. |
| A4 | ML A | Write Boolean sub-checks for the 8 default criteria in `checklist.ts`. | The prompt renders with and without sub-checks. |
| B3 | ML B | First full run on the 14 tuning dialogs, then the mismatch report. Sort every mismatch into one of three buckets: rubric ambiguity, missed evidence, or labeler error. | Report v1 committed to `data/eval`. Fixes listed for ML A. |
| F3 | Fullstack | "Evaluate all" with concurrency 4 and backoff. Add a needs-review badge when confidence is below 1. | All 65 evaluate from the UI. |
| C2 | ML C | Silero VAD, pyannote diarization, and GigaAM v3 for Russian. Merge words to speakers. | WER improves on the baseline for at least 3 of the 5 calls. |

### Phase 3, T+7 to T+12: accuracy boosters

| ID | Owner | Task | Done when |
| --- | --- | --- | --- |
| A5 | ML A | 3-sample voting with confidence. | The report shows the voted result against the single sample on the 14 dialogs. |
| A6 | ML A | gpt-oss-120b tie-break and the separate gross-violation call. | c08 catches all 4 known DEV cases: p1-ru-022, p1-ru-023, p1-kz-013, p1-en-013. |
| A7 + B4 | ML A, ML B | Prompt iterations driven only by the mismatch report. Add 3 hand-picked short examples kept outside the 20 labeled dialogs. | Held-out 6 do not get worse while the tuning 14 improve. |
| B5 | ML B | Check KZ separately. If KZ agreement is clearly lower, run the tie-break on every KZ criterion. | KZ row in the report. |
| C3 | ML C | Kazakh routing with whisper-tulpar, then role labeling with rules plus one LLM call. Output in DEV format. | The 5 DEV calls convert to valid transcripts that import into the app. |
| F4 | Fullstack | Checklist editor fields for `checks` and `naCondition`. Rehearse replacing a criterion with a fake one, such as "operator offered a callback". | The fake criterion evaluates over all dialogs with no code change. |

### Phase 4, T+12 to T+17: features

| ID | Owner | Task | Done when |
| --- | --- | --- | --- |
| C4 | ML C | `/transcribe` endpoint on a GPU host. | One curl call returns a transcript for a DEV recording. |
| F5 | Fullstack | "Upload recording" in the UI. It calls STT through the Worker, then imports and evaluates the result. | Audio becomes a scored card from the UI. |
| B6 | ML B | Self-hosted Qwen through vLLM with the same provider code and a "local" toggle in the UI. | 3 DEV dialogs evaluate in local mode. Both modes appear in the report. |
| F6 | Fullstack | Calibration page with per-criterion agreement against human labels. Add a prompt and raw-output viewer to the card. | Both are visible in the hosted app. |
| A8 | ML A | Verifier pass that only flags issues and never overrides a result. | Verifier flags show on the card. |

### Phase 5, T+17 to the control release at hour 23

| ID | Owner | Task | Done when |
| --- | --- | --- | --- |
| Z1 | ML A | Freeze the prompt version and the provider config. | The tag `prompt-vN` is pinned in config. |
| Z2 | Fullstack | README with run steps, model names, cost per evaluation, and STT setup. Deploy. | A fresh clone runs by following the README. |
| Z3 | All four | Two full demo rehearsals under five minutes, including a criterion replacement. | Timed run-through. |
| Z4 | All four | Control run at hour 23: import the new group, evaluate all 10, and check every card for failures. If audio comes without transcripts, transcribe first. | 10 scored cards before hour 24. Final commit tagged. |

## Rules that hold throughout

- Prompt changes merge only together with a calibration report that shows the change.
- The 6 held-out dialogs are run only at the end of each iteration and are never read while editing prompts.
- Secrets live only in `.dev.vars` and Worker secrets. The DEV and control data stay out of git.
- Commits follow AGENTS.md: Conventional Commits, one line.

## Open questions

### For the team

1. Do we have a GPU, and where: a local machine, Modal, or something else? STT (C1 to C4) and local mode (B6) both need one. If we have none, local mode falls back to Ollama with a Q4 model on a laptop.
2. Who wrote `DATASET_FINDINGS.md`, `IMPLEMENTATION_PLAN.md`, and `JUDGE_QUESTIONS.md`? They are not in git yet. This plan reuses them.

### For the organizers

Ask from [JUDGE_QUESTIONS.md](JUDGE_QUESTIONS.md), questions 1 to 3 first. Add these two for STT:

1. Will the control set include recordings without transcripts? If yes, in what format: mp3 or wav, mono or stereo, and how many?
2. May we use the DEV recordings from the player links to test our own STT?
