# Freedom Broker CQA Hackathon

Teams have 24 hours to build a Conversation Quality Analytics prototype. It must evaluate an operator's work from a conversation transcript using a configurable checklist, show the evidence for each rating, and let a reviewer resolve appeals.

## Top-50 selection

AI evaluation accuracy is the primary criterion. During the control stage, teams receive 10 previously unseen transcripts. Organizers compare each system's ratings with reference ratings prepared in advance (Ground Truth). Closer agreement is better. The brief does not specify the comparison metric.

Organizers also consider four factors when selecting the top 50.

1. **Functionality and distinctive features.** Useful additions, interesting technical choices, and implementation quality.
2. **Usability.** How easy the interface is to understand and how smoothly users can complete an evaluation.
3. **Validity of the evaluation.** The system must generate ratings by applying the configured criteria to each new transcript. Replaying prepared ratings fails this check.
4. **Diversity of technical approaches.** Organizers aim to include different architectures, including solutions that use local LLMs and those that use cloud AI services.

The organizers use the accuracy comparison as their main guide and exercise judgment across all five factors when making the final selection.

## Prototype requirements

### Configure a checklist and run an evaluation

1. **Configure and save a checklist.** Use the supplied checklist as the starting configuration. Users must be able to add and edit criteria in the interface, including their wording, weights, answer types, numeric scales, and whether `N/A` is allowed.
2. **Evaluate a conversation.** Let users load a transcript, select a checklist, and start an evaluation. Support Russian, Kazakh, and English. Evaluate the operator's work and use bot messages and system events as context.
3. **Show the result.** For each criterion, show the answer, points, weight, explanation, and supporting message or call segment. When an action is missing, point to the part of the conversation where it was expected. For `N/A`, explain why the criterion does not apply. Show the total, any section scores, and a separate flag for serious violations.

In a separate check, organizers will ask the team to replace one criterion. Save the revised checklist through the interface and apply it to the supplied conversations using the frozen code version.

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

The temporary API returns a dataset in response to a GET request with a `group_id` parameter. Copy the signed `DEV` URL from the “Открыть GET для DEV” button on page 3 of the student guide to make the request from a terminal. Organizers will provide a different `group_id` for the control set. If the browser blocks the request because of CORS, make it from the backend or use a local adapter.

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

The participant guide includes calls in the dataset and provides for recording playback or a link to a player. The supplied materials give no separate scoring rubric for calls.

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
4. Round the total to two decimal places. Leave it uncalculated if no applicable criteria carry weight. Report serious violations separately.

The three-minute first-response threshold, tags, and attachments are outside the scope of scoring.

### Applying the criteria

- **Identity verification.** A general question about fees does not require verification. If a protected action required verification and the transcript does not confirm it, mark No.
- **Guidance and conversation management.** Guidance measures whether the operator resolved the request correctly and fully. Conversation management measures whether the operator communicated clearly and in a logical order. A clear answer to one of two important questions may score well on conversation management and earn partial credit for guidance.
- **Paid services outside the company.** Flag offers such as asking a customer to send investment funds to the operator personally or requesting a personal phone number to provide private paid advice. The offer alone is enough to flag the violation.
- **Evidence.** Cite a specific message or system event and say what it shows. For example, if an operator closes a chat without saying goodbye, cite the last operator reply and the chat-closure event to support a No for closing.

## Submission and demo

| When                     | What happens                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 23 hours after the start | Organizers release the control transcripts. Start processing them in time to have the results ready for the demo.                                       |
| Before the code freeze   | Commit the solution to a public Git repository, include a README with clear startup steps, and send the repository link to the organizers.              |
| 24 hours after the start | Freeze the final commit. Judges review that version. Teams can still process data and change the checklist through the interface on the frozen version. |

The demo has a five-minute limit. Organizers will announce the exact schedule and team count separately. The guide suggests this allocation.

1. **1 minute.** Show the interface and a selected conversation.
2. **2 minutes.** Show the evaluation and its evidence, follow a link to the transcript, and show an `N/A` example and the total score.
3. **1 minute.** Appeal a rating, show the reviewer's decision, and show the recalculated total.
4. **1 minute.** Change a criterion through the interface and apply the revised checklist.
