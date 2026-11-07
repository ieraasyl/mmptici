# Labeling Guide

For the four labelers of the 20 DEV dialogs. Budget: about an hour each.

## 1. Purpose and rules

- Your labels measure the LLM evaluator. They stand in for the organizers' Ground Truth.
- Label what the transcript shows. Do not guess what happened off screen.
- Judge only the operator. Bot and system turns are context: they tell you what the client already said and what was already checked, but they never earn or lose credit.
- Six dialogs are held out: `p1-ru-012`, `p1-kz-012`, `p1-kz-013`, `p1-en-001`, `p1-en-004`, `p4-ru-002`. Never discuss them with ML A, who tunes the prompt.
- The decision rules below are provisional. Each depends on an open organizer question. If an answer changes a rule, we relabel that criterion.

## 2. How to label

1. Find your dialogs in `tools/calibrate/labels/sets.json` under `assignments.<you>`. Your IDs are `dauka`, `ml-a`, `ml-c` or `fullstack`. Do `primary` first, then `second`. If you finish early, take a dialog from `unassigned`.
2. Print your dialogs:

   ```
   python3 tools/calibrate/print_dialogs.py --set p1-ru-003,p1-ru-007
   ```

   `--set` also takes `tuning`, `heldout` or `all20`. Each dialog becomes a Markdown file in `tools/calibrate/print/`, turns numbered `[n] speaker timestamp: text`.
3. Write your CSV template:

   ```
   python3 tools/calibrate/print_dialogs.py --template <labeler>
   ```

   This writes `tools/calibrate/print/labels-<labeler>.csv` with one row per assigned dialog and criterion. It covers `primary` and `second`. For an `unassigned` dialog, add the eight rows yourself.
4. Fill the columns `conversation_id,labeler,criterion_id,answer,evidence_turns,note`:
   - `answer`: `yes`, `no`, `na`, or a scale number (`guidance`: 0, 5, 10, 15, 20; `management`: 0, 4, 7, 10).
   - `evidence_turns`: the turn numbers as printed. They are 1-based. Separate them with `;`, for example `10;12`. Cite the turns that decide the answer. For a missing action, cite where it should have happened.
   - `note`: one short sentence when the case is borderline or a rule did not fit. Leave it empty otherwise.
5. Send the CSV to ML B.

## 3. No versus N/A

From the checklist:

- **No**: the action was needed, and the operator missed it or did it wrong.
- **N/A**: the criterion's own N/A condition holds. Each criterion states it.
- Use N/A only where the criterion allows it. `opening`, `empathy`, `management` and `violations` have no N/A.

If you cannot decide between No and N/A, pick the closer one and write a note.

## 4. Criteria

Turn numbers in the examples are 1-based, as printed. All examples come from the tuning set.

### 4.1 opening

> «Да — оператор поздоровался на языке клиента и представился в первом ответе.»

Answers: `yes`, `no`.

Rule (provisional, organizer question 4): look only at the operator's first message. Yes needs a greeting in the client's language plus a name. "[Имя скрыто]" counts as a name. The bot's greeting never counts.

Example: `p4-ru-003`, **yes**, turns `13`. The operator says «Здравствуйте, Фридом брокер меня зовут [Имя скрыто], чем могу помочь?»: a Russian greeting plus a masked name, which counts. The IVR greeting in turn 3 is irrelevant.

Contrast: `p1-kz-008` turn 10, «Сәлем. Қай сайтқа кірдіңіз?», greets but gives no name, so **no**.

### 4.2 understanding

> «Да — оператор учёл известные детали и уточнил недостающее до ответа. N/A — данных для ответа хватало с самого начала.»

Answers: `yes`, `no`, `na`.

Rule (provisional, organizer question 5):
- N/A when the client's messages before the operator's first reply, including those to the bot, already contain enough to answer.
- Yes when the operator used the known details and asked only for what was missing.
- No when the operator answered without a needed clarification, or asked again for something already stated.

Example: `p1-kz-008`, **no**, turns `5;10;11`. The client named the site to the bot in turn 5. The operator asks again which site in turn 10, and the client replies "I wrote above" in turn 11.

Contrast: `p1-en-009` is **na**. Turn 1 already holds the full question (how to switch off Use Margin), and the operator answers it in turn 10.

### 4.3 verification

> «Да — проверка личности подтверждена до раскрытия данных или защищённого действия. N/A — запрос не требовал идентификации.»

Answers: `yes`, `no`, `na`.

Rule (provisional, organizer question 6):
- N/A for general information, such as where a menu item is.
- Required for account-specific data or a protected action.
- Yes only when a check is visibly confirmed before the disclosure, either by a system event or by an explicit operator statement.
- A confirmed bot check before the handoff counts.

Example: `p1-en-014`, **no**, turns `11;12;13`. The operator discloses a withdrawal restriction on the account in turn 11 with no check. The client objects in turn 12, and the operator answers "We can skip that" in turn 13.

Contrast: `p1-kz-003` is **yes**. The operator asks for identification in turn 11, and the system event in turn 13 confirms it before the payment is handled.

### 4.4 guidance

> «Оцените ответ или следующий шаг по шкале. N/A — чат закончился до того, как клиент сформулировал запрос.»

| Score | Wording |
| --- | --- |
| 20 | «Все существенные вопросы закрыты или дан корректный следующий шаг.» |
| 15 | «Основной вопрос решён, пропущена второстепенная деталь.» |
| 10 | «Часть запроса закрыта, существенный вопрос остался открытым.» |
| 5 | «Есть общая подсказка, но клиенту всё ещё непонятно, как действовать.» |
| 0 | «Ответа по существу нет или ключевая рекомендация ошибочна.» |

Answers: `20`, `15`, `10`, `5`, `0`, `na`.

Rule (provisional, organizer question 7):
- First list every distinct client question, including those asked to the bot. Then score with the scale.
- A correct escalation or next step earns 20.
- Bot information is correct context unless the operator contradicts it.
- N/A only when no request was ever stated.

Example: `p1-ru-003`, **10**, turns `1;5;13;14;15`. The client asks two things: the commission for buying stocks on the Investor tariff (turns 1 and 5) and where to see the tariff (turn 5). Turn 13 answers where to see the tariff. The client repeats the commission question in turn 14, and turn 15 only repeats the tariff location. The main question stays open, so 10.

Contrast: `p1-ru-025` is **na**. The client asks only for a human (turns 1 and 5) and leaves in turn 11 without stating the actual question.

### 4.5 empathy

> «Да — оператор вежлив и, если клиент выразил недовольство или описал неудобство, отреагировал на конкретную проблему.»

Answers: `yes`, `no`.

Rule (provisional, organizer question 8): Yes when the operator is polite and did not ignore any complaint or inconvenience the client voiced. Politeness alone is Yes when the client voiced nothing.

Example: `p1-ru-029`, **no**, turns `10;13;14`. The operator is rude in turn 10 («Вы вообще читать умеете?»). The client complains about the tone in turn 13, and the operator only says «До свидания.» in turn 14.

Contrast: `p1-kz-003` is **yes**. In turn 11 the operator acknowledges the client's worry about the missing money before asking for identification.

### 4.6 management

> «Оцените ясность, порядок ответов и предупреждение об ожидании по шкале.»

| Score | Wording |
| --- | --- |
| 10 | «Ответы ясные и связные. Если было явное ожидание, оператор предупредил.» |
| 7 | «Один заметный сбой, но клиент может понять ответ и продолжить.» |
| 4 | «Клиенту приходится переспрашивать из-за формулировок или порядка ответов.» |
| 0 | «Из-за бессвязных или противоречивых реплик ход диалога непонятен.» |

Answers: `10`, `7`, `4`, `0`.

Rule (provisional, organizer questions 9 and 11):
- Start at 10. Drop to the step that matches the worst lapse.
- A visible delay after "let me check" without a wait warning is a lapse.
- The three-minute first-response rule does not apply.
- ASR noise in calls is never a lapse.

Example: `p1-ru-028`, **10**, turns `10;11;12`. The operator warns «Сейчас проверю путь» in turn 10. The client agrees to wait in turn 11. The answer comes about 2.5 minutes later in turn 12, with «Спасибо за ожидание». The delay was announced, so it is not a lapse.

The tuning set has no clean chat example of a partial score (7 or 4). Use the scale wording and add a note.

### 4.7 closing

> «Да — оператор подвёл итог или предложил дальнейшую помощь и попрощался. N/A — чат оборвался до возможности его завершить.»

Answers: `yes`, `no`, `na`.

Rule (provisional, organizer question 10, the least certain rule in this guide):
- Yes needs a goodbye plus either a summary or an offer of further help.
- A goodbye alone is No.
- N/A when the chat or call was cut off before the operator could close.

Example: `p1-en-014`, **no**, turns `14;15`. The client asks "Will I hear back here?" in turn 14. The operator replies only "Goodbye." in turn 15: no summary, no offer of help.

Contrast: `p1-kz-003` turn 26 is **yes**: it confirms the reply about the transfer will come in this chat and says goodbye. `p1-ru-025` is **na**: the client leaves (turn 11) right after the operator's first message.

### 4.8 violations

> «Да — выявлено оскорбление клиента, предложение платной услуги в обход компании или раскрытие конфиденциальной информации. Нет — ни одно из трёх не выявлено.»
>
> «Достаточно самого предложения в переписке. Согласие клиента или перевод денег для отметки не требуются.»

Answers: `yes`, `no`.

Rule: as worded. The offer alone is enough. Note that `yes` here is the bad outcome.

Example: `p1-ru-022`, **yes**, turns `10;12`. The operator asks the client to send money to his card so he can invest it (turn 10), and confirms in turn 12 that this bypasses the company. The client refuses in turn 13. That does not matter.

Second example: `p1-ru-029`, **yes**, turns `10`. «Вы вообще читать умеете?» mocks the client, and we count that as an insult. Mild rudeness without a personal jab only costs `empathy`; if you are unsure which side a remark falls on, explain in `note`.

## 5. Calls

- `p4` dialogs are phone calls. The transcripts are ASR output. Ignore recognition errors, garbled words and duplicated lines. Judge what the operator evidently meant.
- IVR menu turns (bot) and recording events (system) are context.
- For `p4` calls, judge the operator turns addressed to the client.
- Masked data such as "[Персональные данные скрыты]" or "[Данные идентификации скрыты]" means the data was given. It does not mean it was missing.

## 6. Disagreements

1. After everyone sends a CSV, ML B runs the agreement report: `python3 tools/calibrate/compare.py --pairs --name <name>`.
2. Disagreements are settled in a short call with the labelers involved.
3. If a disagreement exposes a gap in a rule, this guide is updated.
4. ML B writes one `final` row per dialog and criterion. Those rows are what we measure the LLM against.
