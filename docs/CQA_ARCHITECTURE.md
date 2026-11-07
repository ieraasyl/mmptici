# CQA prototype: architecture and plan

Working document for the 24-hour build. Requirements live in [CQA_HACKATHON.md](../CQA_HACKATHON.md). This file says how we build it and who owns what.

## What wins

Accuracy against Ground Truth on 10 unseen transcripts is the main criterion. Everything in the AI core is designed around that. The UI must cover the six required features so the 5-minute demo runs clean, and the judges must be able to see that every score comes from a live model call on the given transcript.

## Division of labor

Four members: one fullstack, three ML. Roles below use those labels.

| Role | Owns | Lives in |
| --- | --- | --- |
| Fullstack | D1 schema, Hono routes, dataset import, React UI, deploy, secrets, README run steps | `apps/api`, `apps/web`, `packages/db`, root |
| ML 1, scoring and contracts | Zod contracts, default checklist JSON, scoring engine with tests, `applyDecisions` | `packages/contracts`, `packages/scoring` |
| ML 2, evaluator | Prompt, LLM client, output parsing and retry, voting, verifier | `packages/evaluator` |
| ML 3, calibration | Calibration CLI, labeling sheet and guide, agreement reports, error analysis that feeds ML 2 | `tools/calibrate`, `data/labels.csv` |

All three ML members label DEV dialogs in step 8. The boundary between ML and Fullstack is the two JSON contracts below. The evaluator is a function `evaluate(conversation, checklist, options) -> EvaluationResult` with no database or framework imports, so it runs inside the Worker and inside the calibration CLI unchanged.

## Model

Qwen3.8-27B served by Cerebras through the Hugging Face router, OpenAI-compatible chat completions, JSON mode, reasoning enabled.

| Fact | Value |
| --- | --- |
| Endpoint | `https://router.huggingface.co/v1/chat/completions` |
| Model id | `Qwen/Qwen3.8-27B:cerebras` |
| Auth | `HF_TOKEN` secret |
| Price | $0.99 / M input, $1.49 / M output |
| Measured latency | about 1.2 s for 700 tokens |
| Estimated cost per evaluation | about $0.01 single pass, about $0.03 with 3-sample voting |

It is a reasoning model. `max_tokens` must be at least 6000 or the answer is cut off inside the thinking. Reasoning comes back in `message.reasoning`, the JSON in `message.content`. Token usage from `usage` is stored on every evaluation so the UI can show cost.

Fallback model on the same endpoint: `openai/gpt-oss-120b:cerebras`. A second-opinion mode using it is a bonus feature, not baseline.

## Contracts

### ChecklistConfig

```json
{
  "id": "default-v1",
  "name": "Чек-лист качества чатов",
  "version": 1,
  "sections": [
    { "id": "opening", "title": "Начало и понимание запроса" },
    { "id": "security", "title": "Безопасность и решение" },
    { "id": "closing", "title": "Ведение и завершение диалога" },
    { "id": "violations", "title": "Грубые нарушения" }
  ],
  "criteria": [
    {
      "id": "c01",
      "sectionId": "opening",
      "order": 1,
      "title": "Установление контакта",
      "description": "Да — оператор поздоровался на языке клиента и представился в первом ответе.",
      "answerType": "yes_no",
      "weight": 10,
      "allowNA": false,
      "naCondition": null,
      "scale": null,
      "isGross": false
    },
    {
      "id": "c04",
      "sectionId": "security",
      "order": 4,
      "title": "Корректная и полная консультация",
      "description": "Оцените ответ или следующий шаг по шкале.",
      "answerType": "scale",
      "weight": 20,
      "allowNA": true,
      "naCondition": "Чат закончился до того, как клиент сформулировал запрос.",
      "scale": [
        { "value": 20, "label": "Все существенные вопросы закрыты или дан корректный следующий шаг." },
        { "value": 15, "label": "Основной вопрос решён, пропущена второстепенная деталь." },
        { "value": 10, "label": "Часть запроса закрыта, существенный вопрос остался открытым." },
        { "value": 5,  "label": "Есть общая подсказка, но клиенту всё ещё непонятно, как действовать." },
        { "value": 0,  "label": "Ответа по существу нет или ключевая рекомендация ошибочна." }
      ],
      "isGross": false
    },
    {
      "id": "c08",
      "sectionId": "violations",
      "order": 8,
      "title": "Грубые ошибки",
      "description": "Да — оскорбление клиента, предложение платной услуги в обход компании или раскрытие конфиденциальной информации.",
      "answerType": "yes_no",
      "weight": 0,
      "allowNA": false,
      "naCondition": null,
      "scale": null,
      "isGross": true
    }
  ]
}
```

Rules: `answerType` is `yes_no` or `scale`. A `scale` criterion lists its steps explicitly, the top step equals full weight. `isGross: true` means no points and a separate flag. The default config is the eight criteria from the PDF, seeded on first run. Editing or adding a criterion changes only this JSON, the evaluator reads it at call time.

### EvaluationResult

```json
{
  "conversationId": "p1-ru-007",
  "checklistId": "default-v1",
  "checklistVersion": 1,
  "model": "Qwen/Qwen3.8-27B:cerebras",
  "createdAt": "2026-11-07T10:00:00Z",
  "criteria": [
    {
      "criterionId": "c07",
      "answer": "no",
      "scaleValue": null,
      "points": 0,
      "weight": 5,
      "effectiveWeight": 5.88,
      "explanation": "Оператор ответил на первый вопрос и закрыл чат без прощания и без ответа на второй вопрос.",
      "evidence": [{ "turnIndex": 12, "quote": "Путь к обновлению я указал. Хорошего дня!" }],
      "expectedAt": { "fromTurn": 11, "toTurn": 12 },
      "naReason": null,
      "confidence": 0.67
    }
  ],
  "sections": [{ "sectionId": "closing", "points": 21.2, "maxPoints": 41.2 }],
  "total": 64.71,
  "grossViolation": false,
  "grossEvidence": [],
  "usage": { "promptTokens": 2900, "completionTokens": 4100, "costUsd": 0.0090 },
  "raw": { "samples": 3, "prompt": "...", "responses": ["..."] }
}
```

`answer` is `yes`, `no`, `na`, or `scale`. `evidence` always points to turn indices in the original transcript array, never to copied text alone, so the UI can scroll to and highlight the turn. For a missed action `expectedAt` gives the span the model checked. For `na` the `naReason` quotes the checklist condition that applies. `raw` keeps the prompt and model outputs so the judges can verify the process.

Reviewer decisions do not mutate this object. They are a separate record `{ evaluationId, criterionId, newAnswer, newScaleValue, reason, reviewer }` and the final result is `applyDecisions(evaluation, decisions)` run through the same scoring function.

## Scoring engine

`packages/scoring`, pure TypeScript, no imports, unit-tested against the PDF rules:

1. `yes` gives full weight, `no` gives 0, `scale` gives `weight * value / maxStep`.
2. `na` only if `allowNA`. N/A criteria and gross criteria are excluded from weights.
3. `total = round2(sum(points) / sum(applicableWeights) * 100)`. If no applicable weight, total is null.
4. `effectiveWeight = weight / sum(applicableWeights) * 100` is reported per criterion so the UI can show redistribution.
5. Section totals use the same proportional math over the section's applicable criteria.
6. Gross flag is true if any `isGross` criterion is `yes`.

Test cases to encode: the example from the brief, all N/A on one section, a dialog with every criterion applicable, the gross case `p1-ru-022`, and a single applicable criterion.

## Evaluator

`packages/evaluator`, exports `evaluate()` and `buildPrompt()`.

**Prompt structure.** System message: role, the scoring philosophy from page 3 of the checklist PDF (No vs N/A, what counts as evidence, consultation vs dialog management, what counts as bypassing the company), output JSON schema, and the rule that only operator turns are judged while bot and system turns are context. User message: conversation metadata (channel, language), the numbered transcript `[12] operator (03:41): ...`, then the criteria rendered from ChecklistConfig with their answer type, scale steps, and N/A condition. The model answers every criterion in one JSON object. Instructions are in Russian, the transcript is passed as is in RU, KZ, or EN.

**Per-criterion guidance baked into the prompt**, derived from the DEV set:

- c01: the operator's first message only. The bot's greeting does not count. Language is the client's language.
- c02: N/A when the client's first messages already contain enough to answer. Most DEV chats are N/A here.
- c03: N/A for general questions. No when a protected action or account data was given without a check.
- c04: list the client's distinct questions first, then decide which were answered. Unanswered second questions are the common failure.
- c05: politeness alone is Yes unless the client voiced a complaint that was ignored.
- c06: deduct for making the client repeat, contradictions, or a long silent gap with no "please wait". Ignore ASR noise in voice calls.
- c07: No when the operator closed without a goodbye, N/A only when the system closed the chat before the operator could.
- c08: the offer alone is enough; quote it.

**Voice calls.** IVR bot turns and system events are kept as context. The prompt states that the transcript is automatic speech recognition and that spelling must not be judged. No audio is evaluated: the organizers provide transcripts only, so the card shows the `audio_url` as a link to the organizer's player page and nothing more.

**Accuracy boosters, in order of implementation.**

1. Temperature 0 single pass. Baseline.
2. Self-consistency: 3 samples at temperature 0.6, majority vote per criterion, `confidence` is the vote share. Cerebras latency makes this cheap. Low confidence is shown in the UI as "needs review".
3. Verifier pass: a second call receives each criterion's answer and cited turns and checks that the quote exists and supports the claim. Disagreements are reported, not auto-fixed.

**Output validation.** The JSON is parsed with the Zod schema from `packages/contracts`. Turn indices are clamped to the transcript. A failed parse retries once with the parse error appended, then marks the evaluation as failed with the raw response kept.

## Calibration

`tools/calibrate` is a Node CLI, not deployed.

- `run --group DEV` evaluates every conversation and writes `data/eval/<run-id>.json`.
- `compare --labels data/labels.csv` prints per-criterion agreement, mean absolute error on total, and the list of mismatches with the model's explanation next to the human answer.
- `data/labels.csv` has one row per conversation and criterion. The three ML members label about 20 DEV dialogs mixed across RU, KZ, EN, and two calls, about 7 each, after the baseline exists.

Prompt changes are judged only by this report. The DEV JSON lives in `data/raw/dev.json` locally, ignored by git.

## App side, for Fullstack

**Tables.** `conversations` (id, group_id, channel, language, transcript JSON, audio_url, imported_at), `checklists` (id, name, version, config JSON, created_at, is_active), `evaluations` (id, conversation_id, checklist_id, checklist_version, result JSON, status, created_at), `appeals` (id, evaluation_id, criterion_id, comment, status, created_at), `decisions` (id, appeal_id, new_answer, new_scale_value, reason, reviewer, created_at). Final results are computed on read with `applyDecisions`, not stored twice.

**Routes, all public.** `POST /api/datasets/import {groupId}` fetches the organizer URL server-side (base URL in a secret, `group_id` appended) and upserts conversations. `GET /api/conversations`, `GET /api/conversations/:id`. `GET|POST|PUT /api/checklists`. `POST /api/conversations/:id/evaluate {checklistId}` calls `evaluate()` and stores the result. `GET /api/evaluations/:id` returns original, decisions, and final. `POST /api/appeals`, `POST /api/appeals/:id/decide`.

Batch "evaluate all" is driven from the browser, one request per conversation with concurrency 4, so no single Worker request runs long.

**Screens.** Conversation list with language and channel filters, per-row total, gross flag, status, and "evaluate" and "evaluate all". Conversation card: transcript left with turn anchors, scorecard right with per-criterion answer, points, weight, effective weight, explanation, evidence links, N/A reason, confidence, section totals, total, gross flag, cost. Clicking evidence scrolls to and highlights the turn. For calls the card shows a link to the organizer's player page. Appeal drawer: pick criterion, comment, submit. Reviewer panel: lists appeals, shows the disputed criterion, comment, and the cited turns, confirm or change with reason, and shows original, decision, final side by side. Checklist editor: edit title, description, weight, answer type, scale steps, allow N/A, N/A condition, add and remove criteria, save as new version, set active.

## Plan

Four tracks run in parallel from the start. Steps in a row depend on the steps above them in the same column only.

| Order | Fullstack | ML 1, scoring | ML 2, evaluator | ML 3, calibration |
| --- | --- | --- | --- | --- |
| 1 | Drop login, add tables, import route | Contracts and default checklist JSON | Prompt draft and LLM client against the contracts | Labeling sheet, labeling guide, pick 20 DEV dialogs |
| 2 | List and card screens on a stubbed EvaluationResult | Scoring engine with tests | Baseline single pass, parsing and retry | Calibration CLI: run DEV, write results |
| 3 | Evaluate route calling `evaluate()`, scorecard with evidence jump | `applyDecisions` with tests, then help Fullstack wire scoring into the API | First full run on 65 dialogs, fix failures | Compare command: agreement per criterion, mismatch list |
| 4 | Appeals and reviewer decisions with recompute | Label | Label | Label |
| 5 | Checklist editor with versioning | Prompt iteration on the mismatch list with ML 2 | Prompt iteration | Re-run and report after every prompt change |
| 6 | Polish, README, cost shown on the card | Bonus feature | Voting with confidence, then verifier | Control-set rehearsal: replace a criterion through the UI and re-run |
| 7 | Demo dry run | Demo dry run | Demo dry run | Demo dry run |

Done when, per milestone:

| Milestone | Proof |
| --- | --- |
| Scoring correct | Unit tests pass on the cases listed in the scoring section |
| Evaluator baseline | All 65 DEV dialogs produce a valid EvaluationResult |
| Demo parts 1 and 2 | A dialog opens, evaluates, and evidence links scroll to the right turn |
| Demo part 3 | An appeal changes a criterion and the total recomputes |
| Demo part 4 | A replaced criterion is saved in the UI and applied to all dialogs |
| Accuracy | Per-criterion agreement on the 20 labeled dialogs stops improving between prompt versions |

Bonus candidates, ranked by judge value: second-opinion model toggle, operator and language analytics page, per-criterion confidence and needs-review queue, export of evaluations, prompt and response viewer on the card for the process-validity check.

## Secrets

`HF_TOKEN` and `CQA_DATASET_URL` go in `apps/api/.dev.vars` locally and in Worker secrets for production. Both files are gitignored. Nothing secret is committed, including the DEV JSON.

## Open questions for the organizers

1. Ground Truth content and metric: per-criterion answers or only the final score, and how is a disagreement on N/A counted?
2. Will the control set include KZ dialogs and voice calls? Are calls scored with the same checklist?
3. Will the replaced criterion come with wording, weight, answer type, scale, and N/A rule? Is control Ground Truth computed with the original or the replaced checklist?
4. Criterion 01: client language from the dataset field or the client's messages, and does only the operator's first reply count?
5. Criterion 03: does a bot or system identity check before the operator joins count?
6. Criterion 05: with no complaint, is politeness alone a Yes?
7. Criterion 06: what counts as an explicit wait that needs a warning?
8. Criterion 08: separate flag only, or does it change the total?
9. Voice calls: should ASR noise be ignored when judging literacy?
10. Will the control set come through the same API with a new group_id?
