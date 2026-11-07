# Freedom Broker CQA Hackathon

Teams have 24 hours to build a Conversation Quality Analytics prototype. It must evaluate an operator's work from a conversation transcript using a configurable checklist, show the evidence for each rating, and let a reviewer resolve appeals.

## Top-50 selection

AI evaluation accuracy is the primary criterion. During the control stage, teams receive 10 previously unseen chat transcripts. Organizers compare answers per criterion with reference ratings prepared in advance (Ground Truth). Closer agreement is better. The exact comparison metric and the weights of the selection factors remain unpublished. [Q&A message 2978](https://t.me/c/4473389149/732/2978), [message 3004](https://t.me/c/4473389149/732/3004)

Organizers also consider four factors when selecting the top 50.

1. **Functionality and distinctive features.** Useful additions, interesting technical choices, and implementation quality.
2. **Usability.** How easy the interface is to understand and how smoothly users can complete an evaluation.
3. **Validity of the evaluation.** The system must generate ratings by applying the configured criteria to each new transcript. Replaying prepared ratings fails this check.
4. **Diversity of technical approaches.** Organizers aim to include different architectures, including solutions that use local LLMs and those that use cloud AI services.

The organizers use the accuracy comparison as their main guide and exercise judgment across all five factors when making the final selection.

## Prototype requirements

### Configure a checklist and run an evaluation

1. **Configure and save a checklist.** Start with the [initial chat quality checklist](#initial-chat-quality-checklist). Users must be able to add and edit criteria in the interface, including their wording, weights, answer types, numeric scales, and whether `N/A` is allowed.
2. **Evaluate a conversation.** Let users load a transcript, select a checklist, and start an evaluation. Support Russian, Kazakh, and English. Evaluate the operator's work and use bot messages and system events as context.
3. **Show the result.** For each criterion, show the answer, points, weight, explanation, and supporting message or call segment. When an action is missing, point to the part of the conversation where it was expected. For `N/A`, explain why the criterion does not apply. Show the total, any section scores, and a separate flag for serious violations.

In a separate check, organizers will ask the team to replace one criterion. Save the revised checklist through the interface and reevaluate the already processed control conversations using the frozen code version. Whether the replacement must retain the original criterion's weight remains unclear. [Q&A message 2978](https://t.me/c/4473389149/732/2978)

### Review results and resolve appeals

1. **Open a conversation from the list.** The conversation page shows the transcript and its evaluation. Evidence links take the user to the relevant message or call segment. For recorded calls, provide playback or a link to a player.
2. **Submit an appeal.** The user selects a criterion, adds a comment, and saves the appeal. The reviewer can see the disputed rating, the comment, and the relevant transcript excerpt.
3. **Decide the appeal.** The reviewer confirms or changes the rating and records a reason. The system recalculates the total. The conversation page retains the original rating, the reviewer's decision, and the final result.

### Interface and implementation

- Structure the UI so it can later be adapted into a Dynamics 365 HTML component.
- Teams choose the evaluation model, backend, and storage. Local models and free or paid APIs are allowed. If using a paid model, state its name and estimate the cost of one evaluation across all model calls.
- The demo requires no registration or sign-in. Show submitting an appeal and reviewing it as separate actions in the interface.
- Call transcripts are provided, so speech recognition is unnecessary. Assessing diction or intonation requires the audio.

## Datasets and API

The `DEV` set contains 65 conversations, including 60 synthetic chats and 5 real calls. It includes 35 Russian (`RU`), 15 Kazakh (`KZ`), and 15 English (`EN`) conversations. Call records include a transcript and a link to the recording.

The full DEV API response is in [data/invoke.json](data/invoke.json). You can also [fetch the DEV dataset from the API](https://ec88f21f1accecf38e20095a9fe175.a5.environment.api.powerplatform.com/powerautomate/automations/direct/cu/11/workflows/b3d2a68006a24662be2b721454cb4e00/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=5Sog2MThgCRTlk3HObv70LRmRk6u7IOwzlwMpe804qo&group_id=DEV).

The temporary API returns a dataset in response to a GET request with a `group_id` parameter. Organizers will provide a different `group_id` for the control set. If the browser blocks the request because of CORS, make it from the backend or use a local adapter.

On success, `isSuccess` is `true`, and `data.records` contains the conversations. This example from the guide shows one record.

```json
{
  "error": "",
  "isSuccess": true,
  "data": {
    "dataset_group_id": "DEV",
    "total_records": 65,
    "records": [
      {
        "conversation_id": "p1-ru-001",
        "channel": "agent chat",
        "language": "RU",
        "transcript": [
          {
            "timestamp": "00:02",
            "speaker": "operator",
            "text": "Здравствуйте!"
          }
        ],
        "audio_url": null
      }
    ]
  }
}
```

- `conversation_id` identifies the conversation. The `channel` value is `agent chat` or `voice call`.
- `transcript` is already an array. Each entry has `timestamp`, `speaker`, and `text`. Speaker roles are `client`, `operator`, `bot`, and `system`.
- Preserve the original timestamps. Chats use `MM:SS`. Calls use ISO 8601 with time zone information.
- `audio_url` is empty for chats and contains a recording link for calls.

## Initial chat quality checklist

Use the same checklist for chats in Russian, Kazakh, and English. The first seven criteria have a combined weight of 100. The eighth flags serious violations separately.

The participant guide includes calls in the DEV dataset and provides for recording playback or a link to a player. The Q&A adds a call-specific exception to the chat checklist below: if a recording starts after the operator's greeting, rate opening as `N/A`. However, the results appendix published on 7 November permits only `true` or `false` for the corresponding `contact` criterion. How to represent this exception in the DEV submission remains unresolved; the appendix does not permit `null` for `contact`. [Q&A message 2978](https://t.me/c/4473389149/732/2978)

| #   | Criterion                                                     | Allowed answers        |    Weight | How to evaluate                                                                                                                                                                |
| --- | ------------------------------------------------------------- | ---------------------- | --------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 01  | Opening the conversation                                      | Yes / No               |        10 | Yes if the operator greeted the customer in the customer's language and introduced themselves in the first reply.                                                              |
| 02  | Understanding the customer's needs                            | Yes / No / N/A         |        15 | Yes if the operator used the details already available and clarified missing information before answering. Use `N/A` if there was enough information to answer from the start. |
| 03  | Identity verification                                         | Yes / No / N/A         |        20 | Yes if identity verification was confirmed before the operator disclosed data or took a protected action. Use `N/A` if the request did not require verification.               |
| 04  | Correct and complete guidance                                 | 0, 5, 10, 15, 20 / N/A |        20 | Rate the answer or next step using the scale below. Use `N/A` if the chat ended before the customer stated their request.                                                      |
| 05  | Empathy and customer focus                                    | Yes / No               |        15 | Yes if the operator was polite and, when the customer expressed dissatisfaction or described an inconvenience, responded to that specific issue.                               |
| 06  | Conversation management, response speed, and language quality | 0, 4, 7, 10            |        15 | Use the scale below to assess how clearly and logically the operator responded and whether they told the customer about a wait.                                                |
| 07  | Closing the conversation                                      | Yes / No / N/A         |         5 | Yes if the operator said goodbye and either summarized the outcome or offered further help. Use `N/A` if the chat was cut off before the operator had a chance to close it.    |
| 08  | Serious violations                                            | Yes / No               | No points | Yes if the operator insulted the customer, offered a paid service outside the company, or disclosed confidential information. No if none of these violations are identified.   |

The PDF groups criteria 01 and 02 under opening and understanding the request, 03 and 04 under security and resolution, 05 through 07 under managing and closing the conversation, and 08 under serious violations.

### 04. Correct and complete guidance

| Rating | Description                                                                                |
| -----: | ------------------------------------------------------------------------------------------ |
|     20 | The operator addressed all material questions or gave the correct next step.               |
|     15 | The operator resolved the main issue and missed a minor detail.                            |
|     10 | The operator addressed part of the request and left a material question unresolved.        |
|      5 | The operator gave general guidance, but the customer still could not tell what to do next. |
|      0 | The operator gave no substantive answer or made an incorrect key recommendation.           |

### 06. Conversation management, response speed, and language quality

| Rating | Description                                                                                                 |
| -----: | ----------------------------------------------------------------------------------------------------------- |
|     10 | The replies were clear and coherent. If there was an obvious wait, the operator told the customer about it. |
|      7 | There was one noticeable lapse, but the customer could still understand the answer and continue.            |
|      4 | The customer had to ask again because of the wording or order of the replies.                               |
|      0 | Disjointed or contradictory replies made the flow of the conversation unclear.                              |

### Scoring

1. Determine applicability. Use `N/A` only when the criterion allows it and its condition is met. If a required action was missed or performed incorrectly, mark a binary criterion No.
2. Convert ratings to points. For a weighted Yes/No criterion, Yes earns its full weight and No earns zero. For a numeric criterion, multiply its weight by the rating divided by the highest value on its scale.
3. Exclude criteria marked `N/A` and redistribute their weight proportionally across applicable criteria. Divide the sum of earned points by the sum of applicable weights and multiply by 100.
4. Round the total half up to two decimal places, for example `50.625` becomes `50.63`. Leave it uncalculated if no applicable criteria carry weight. Report serious violations separately. [Q&A message 2978](https://t.me/c/4473389149/732/2978)

The three-minute first-response threshold, tags, and attachments are outside the scope of scoring.

### Applying the criteria

- **Identity verification.** A general question about fees does not require verification. If a protected action required verification and the transcript does not confirm it, mark No.
- **Guidance and conversation management.** Guidance measures whether the operator resolved the request correctly and fully. Conversation management measures whether the operator communicated clearly and in a logical order. A clear answer to one of two important questions may score well on conversation management and earn partial credit for guidance.
- **Paid services outside the company.** Flag offers such as asking a customer to send investment funds to the operator personally or requesting a personal phone number to provide private paid advice. The offer alone is enough to flag the violation.
- **Evidence.** Cite a specific message or system event and say what it shows. For example, if an operator closes a chat without saying goodbye, cite the last operator reply and the chat-closure event to support a No for closing.

## Submission and demo

The live product can run locally or be hosted. Judges must be able to interact with the UI in real time. Organizers said they would read the README. At later stages, they may ask to use the running application on a team's laptop. [Q&A message 2968](https://t.me/c/4473389149/732/2968), [message 2980](https://t.me/c/4473389149/732/2980), [message 2991](https://t.me/c/4473389149/732/2991)

| When                     | What happens                                                                                                                                                          |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 23 hours after the start | Organizers release the 10 control chats and announce access details. The final hour includes fetching, evaluation, JSON validation, and pushing the results.          |
| Before the code freeze   | Commit and push the solution and both results files to the public repository whose link was provided to organizers. Include a README with clear startup steps.        |
| 24 hours after the start | Code freeze. Both results files must already be available in Git. Later processing and checklist changes through the frozen interface remain part of the live checks. |

### Results submission

Source: `CQA_Student_Guide_Appendix_Results.pdf`, distributed by Nikolay Borovinskiy on 7 November 2026. His accompanying announcement reiterates the file paths, the one-hour control window, and the requirement to push before code freeze. This appendix adds a results deadline to the original guide: having results only in the running application, local files, or an unpushed commit is insufficient.

Prepare the export before the control set arrives. Place these files in the repository root:

```text
results/
  dev/
    results.json
  prod/
    results.json
```

- `results/dev/results.json` contains one result for each of the 65 DEV conversations: 60 chats and 5 calls.
- `results/prod/results.json` contains one result for each of the 10 control chats, including any evaluation failures.
- Preserve each original API `conversation_id` exactly. Do not substitute internal database IDs, omit conversations, or duplicate IDs.
- Use the same JSON structure for both files. The directory determines the dataset.
- Validate UTF-8 JSON with no comments or trailing commas, then commit and push both files before code freeze.

### Results JSON 1.0

Each file is one object with these fields. Keep the prescribed field names, criterion IDs, and value types.

| Field            | Required content                                                                                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema_version` | The string `"1.0"`.                                                                                                                                                          |
| `team_name`      | The team's name.                                                                                                                                                             |
| `model`          | An object with `mode` and `name`. `mode` is `"local"`, `"external_api"`, or `"hybrid"`. `name` identifies the actual model used; list the names if multiple models are used. |
| `results`        | An array with one result per conversation in the dataset.                                                                                                                    |

A successful result has `conversation_id`, `status: "ok"`, `criteria`, and `score`. Its `criteria` array contains exactly eight objects, each with `criterion_id`, `value`, `rationale`, and `evidence_turns`. Include each criterion below exactly once.

| `criterion_id`   | Criterion                                                     | Allowed `value`                    |    Weight |
| ---------------- | ------------------------------------------------------------- | ---------------------------------- | --------: |
| `contact`        | Opening the conversation                                      | `true`, `false`                    |        10 |
| `discovery`      | Understanding the customer's needs                            | `true`, `false`, `null`            |        15 |
| `identification` | Identity verification                                         | `true`, `false`, `null`            |        20 |
| `consultation`   | Correct and complete guidance                                 | `0`, `5`, `10`, `15`, `20`, `null` |        20 |
| `empathy`        | Empathy and customer focus                                    | `true`, `false`                    |        15 |
| `dialogue`       | Conversation management, response speed, and language quality | `0`, `4`, `7`, `10`                |        15 |
| `closure`        | Closing the conversation                                      | `true`, `false`, `null`            |         5 |
| `critical`       | Serious violations                                            | `true`, `false`                    | No points |

- `value`: use `true` for Yes, `false` for No, and `null` for N/A where allowed. Numeric values are raw criterion ratings before applying weights: `dialogue: 7` means 7 out of 10, with weight 15.
- `rationale`: briefly explain the rating, including why a criterion is N/A.
- `evidence_turns`: an array of supporting turn numbers, starting at 1 in the original full transcript. Include client, operator, bot, and system entries when counting; do not renumber operator replies separately.
- `score`: an object with `final_score` and `critical_flag`. `final_score` is between 0 and 100, rounded to two decimal places using the scoring rules above. Exclude N/A criteria and redistribute their weight proportionally.
- `critical_flag`: must equal the `value` of `critical`. A serious violation is reported separately and does not automatically set the total to zero.

If evaluation fails, keep the conversation's ID and include `status: "error"`, an empty `criteria` array, `score: null`, and an `error` string explaining the failure. Do not hide failures or substitute a zero score. This illustrative result uses a placeholder ID; replace it with the original ID from the dataset:

```json
{
  "conversation_id": "demo-002",
  "status": "error",
  "criteria": [],
  "score": null,
  "error": "The model did not return an evaluation."
}
```

### Live demo

The demo has a five-minute limit. Organizers will announce the exact schedule and team count separately. The guide suggests this allocation.

1. **1 minute.** Show the interface and a selected conversation.
2. **2 minutes.** Show the evaluation and its evidence, follow a link to the transcript, and show an `N/A` example and the total score.
3. **1 minute.** Appeal a rating, show the reviewer's decision, and show the recalculated total.
4. **1 minute.** Change a criterion through the interface and apply the revised checklist.

Judges may ask to see all conversations flagged for serious violations with their explanations, submit an appeal, add or edit a criterion or its weight, or inspect a specific conversation's ratings and justifications. Prepare these workflows for a live demonstration. [Q&A message 2991](https://t.me/c/4473389149/732/2991)

## Organizer Q&A clarifications, 7 November 2026

This section records replies from Максим and Nikolay Borovinskiy in the Freedom Broker Q&A topic. The corresponding clarifications are also incorporated into the sections above.

- TypeScript and Tailwind CSS are allowed. Teams may choose their model and external AI service. [Message 2303](https://t.me/c/4473389149/732/2303), [message 2719](https://t.me/c/4473389149/732/2719)
- The DEV API link may be published in the repository. The control dataset will be available through the same API. Expert reference labels have not been provided. [Message 2716](https://t.me/c/4473389149/732/2716), [message 2966](https://t.me/c/4473389149/732/2966)
- If the customer supplied enough details from the start, including details given to the bot, understanding the customer's needs is `N/A`. The overlap between failed identity verification and a serious confidentiality violation was left to teams' judgment. [Message 2814](https://t.me/c/4473389149/732/2814)
- Recordings supplement transcripts for reviewers. Speech recognition and analysis of intonation, volume, or speaking speed are optional extensions after the main workflow works. [Message 2826](https://t.me/c/4473389149/732/2826), [message 2838](https://t.me/c/4473389149/732/2838)
- Organizers expect logical, evidence-based, reproducible evaluations. Handle insufficient information and disputed facts without inventing details. They acknowledge that human experts can disagree and will consider the overall reasonableness of the ratings. [Message 2981](https://t.me/c/4473389149/732/2981)

### Points still unspecified

The exact comparison metric and selection weights remain unpublished. The replies leave replacement-criterion weight handling unclear and give no explicit ruling on masked operator names. They leave the identity-verification method to teams and mention a broker knowledge base without supplying its location or contents. For the closing criterion, the answer directs teams back to the checklist. [Message 2814](https://t.me/c/4473389149/732/2814), [message 2978](https://t.me/c/4473389149/732/2978), [message 3004](https://t.me/c/4473389149/732/3004)
