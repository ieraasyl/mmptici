# mmptici

Built by **ММ..ПТИЦЫ**.

**Conversation Quality Analytics (CQA)** for Freedom Broker. The app scores operator work in support chats and calls against a weighted checklist, explains every score with quotes from the transcript, and lets reviewers appeal a rating. The React UI and Hono API deploy together as one Cloudflare Worker.

[Live app](https://mmptici.ieraasyl.workers.dev) · [Hackathon brief](CQA_HACKATHON.md) · [Agent conventions](AGENTS.md)

## Contents

- [What it does](#what-it-does)
- [Results](#results)
- [Project layout](#project-layout)
- [Local setup](#local-setup)
- [Checks and tools](#checks-and-tools)
- [Schema changes](#schema-changes)
- [Deployment](#deployment)
- [Documentation](#documentation)

## What it does

| Area          | What you get                                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Conversations | Import a dataset, filter by dataset, language and channel, and run evaluations on one conversation or on a whole selection.          |
| Evaluation    | One model call per dialog. Each criterion gets an answer, an explanation and the transcript turns that support it.                   |
| Checklists    | The original checklist plus your own. Every evaluation keeps a copy of the checklist it used, so old results stay valid after edits. |
| Dashboard     | Average score, serious violations, a per-criterion breakdown with the points lost, and the score distribution. Filter by checklist.  |
| Appeals       | Reviewers contest a rating, and a decision records the final answer. The queue shows how the conversation's score changed afterward. |
| Submission    | [`results/dev/results.json`](results/dev/results.json) holds the DEV scores in the organizers' Results JSON 1.0 format.              |

### How a score is calculated

- Criteria marked **N/A** are dropped, and their weight leaves the total.
- A **Yes** earns the full weight, a **No** earns nothing, and a scale answer earns its share of the weight.
- The remaining weights are rescaled to 100 and the result is rounded to two decimals.
- **Serious violations** are a separate flag. They do not change the score.

## Results

Scores come from the weighted checklist above. The numbers below are computed from the submission files [`results/dev/results.json`](results/dev/results.json) and [`results/prod/results.json`](results/prod/results.json).

### Submission files

The organizers ask for one file per dataset, in Results JSON 1.0 (see [the brief](CQA_HACKATHON.md#results-json-10)).

| File                                                     | Dialogs                            | Status |
| -------------------------------------------------------- | ---------------------------------- | ------ |
| [`results/dev/results.json`](results/dev/results.json)   | 65 DEV dialogs (60 chats, 5 calls) | Done   |
| [`results/prod/results.json`](results/prod/results.json) | 10 control chats (`FBroker`)       | Done   |

Both files share one structure:

```json
{
  "schema_version": "1.0",
  "team_name": "ММ..ПТИЦЫ",
  "model": { "mode": "local", "name": "Qwen/Qwen3.8-27B" },
  "results": [
    {
      "conversation_id": "p1-ru-001", // the original dataset id, not a database id
      "status": "ok", // "error" keeps the id, with empty criteria and score null
      "criteria": [
        // always the eight criteria below, in this order
        {
          "criterion_id": "contact",
          "value": true, // true = Yes, false = No, null = N/A, a number = raw scale rating
          "rationale": "The operator greeted the customer in Russian and introduced themselves.",
          "evidence_turns": [10] // 1-based turns of the full transcript, bots and system included
        }
        // …
      ],
      "score": { "final_score": 92.31, "critical_flag": false }
    }
  ]
}
```

The checklist criteria in the app map to the fixed ids in the file.

| App criterion                                     | `criterion_id`   | `value`                            | Weight |
| ------------------------------------------------- | ---------------- | ---------------------------------- | -----: |
| Opening the conversation                          | `contact`        | `true`, `false`                    |     10 |
| Understanding the customer's needs                | `discovery`      | `true`, `false`, `null`            |     15 |
| Identity verification                             | `identification` | `true`, `false`, `null`            |     20 |
| Correct and complete guidance                     | `consultation`   | `0`, `5`, `10`, `15`, `20`, `null` |     20 |
| Empathy and customer focus                        | `empathy`        | `true`, `false`                    |     15 |
| Conversation management, response speed, language | `dialogue`       | `0`, `4`, `7`, `10`                |     15 |
| Closing the conversation                          | `closure`        | `true`, `false`, `null`            |      5 |
| Serious violations                                | `critical`       | `true`, `false`                    |      – |

What was checked for both files:

- It is valid UTF-8 JSON, and every `conversation_id` matches its source dataset with no duplicates: 65 ids in [data/invoke.json](data/invoke.json) for DEV, 10 ids in [data/PROD.json](data/PROD.json) for PROD.
- Every result has `status: "ok"` and exactly the eight criteria, each with an allowed `value`.
- Every cited turn exists in its transcript, and `critical_flag` equals the `critical` value.
- `final_score` follows the [scoring rules](#how-a-score-is-calculated).

The DEV file is a saved run of one model, not regenerated on demand. Running the evaluation again can give different answers, so the DEV tables below describe this file and not a fresh run. The app loads the same run through **Load DEV dataset**, and [data/evaluations-dev.json](data/evaluations-dev.json) holds it in the app's own format.

The PROD file was exported from the app's database after the 10 chats of [data/PROD.json](data/PROD.json) were imported and evaluated with Qwen3.8-27B on the original checklist. Its rationales are in the dialog's language, so the RU chats are explained in Russian.

### DEV

65 dialogs: 60 chats (RU, KZ, EN) and 5 RU calls.

| Field                              | Value                       |
| ---------------------------------- | --------------------------- |
| Model (`model.name`, `model.mode`) | `Qwen/Qwen3.8-27B`, `local` |
| Dialogs scored                     | 65 of 65                    |
| Average score                      | 84.38                       |
| Median score                       | 92.31                       |
| Lowest / highest score             | 16 / 100                    |
| Dialogs with a serious violation   | 7 of 65                     |

| Slice       | Dialogs | Average score | Serious violations |
| ----------- | ------: | ------------: | -----------------: |
| RU          |      35 |          82.4 |                  4 |
| KZ          |      15 |          88.2 |                  1 |
| EN          |      15 |          85.1 |                  2 |
| Chats       |      60 |          84.5 |                  7 |
| Voice calls |       5 |          82.6 |                  0 |

Per criterion. A criterion is **applied** when the model did not answer N/A. The average and the count of dialogs below full marks use only the applied dialogs.

| Criterion                                         | Weight | Applied | N/A | Average | Below full marks |
| ------------------------------------------------- | -----: | ------: | --: | ------: | ---------------: |
| Opening the conversation                          |     10 |      65 |   0 |   92.3% |                5 |
| Understanding the customer's needs                |     15 |      23 |  42 |   78.3% |                5 |
| Identity verification                             |     20 |      13 |  52 |   61.5% |                5 |
| Correct and complete guidance                     |     20 |      64 |   1 |   88.3% |               15 |
| Empathy and customer focus                        |     15 |      65 |   0 |   90.8% |                6 |
| Conversation management, response speed, language |     15 |      65 |   0 |   87.5% |               21 |
| Closing the conversation                          |      5 |      58 |   7 |   24.1% |               44 |
| Serious violations (flag, no weight)              |      – |      65 |   0 |       – |        7 flagged |

### PROD

10 control chats from the organizers' `FBroker` dataset: 4 RU, 4 KZ and 2 EN.

| Field                              | Value                       |
| ---------------------------------- | --------------------------- |
| Model (`model.name`, `model.mode`) | `Qwen/Qwen3.8-27B`, `local` |
| Dialogs scored                     | 10 of 10                    |
| Average score                      | 73.56                       |
| Median score                       | 90.53                       |
| Lowest / highest score             | 16 / 100                    |
| Dialogs with a serious violation   | 1 of 10                     |

| Slice       | Dialogs | Average score | Serious violations |
| ----------- | ------: | ------------: | -----------------: |
| RU          |       4 |          64.7 |                  0 |
| KZ          |       4 |          72.0 |                  1 |
| EN          |       2 |          94.4 |                  0 |
| Chats       |      10 |          73.6 |                  1 |
| Voice calls |       0 |             – |                  – |

| Criterion                                         | Weight | Applied | N/A | Average | Below full marks |
| ------------------------------------------------- | -----: | ------: | --: | ------: | ---------------: |
| Opening the conversation                          |     10 |      10 |   0 |   90.0% |                1 |
| Understanding the customer's needs                |     15 |       5 |   5 |   80.0% |                1 |
| Identity verification                             |     20 |       3 |   7 |   33.3% |                2 |
| Correct and complete guidance                     |     20 |       9 |   1 |   69.4% |                5 |
| Empathy and customer focus                        |     15 |      10 |   0 |   70.0% |                3 |
| Conversation management, response speed, language |     15 |      10 |   0 |   70.0% |                6 |
| Closing the conversation                          |      5 |       9 |   1 |   77.8% |                2 |
| Serious violations (flag, no weight)              |      – |      10 |   0 |       – |        1 flagged |

With 10 dialogs, one chat moves an average by up to 10 points, and a criterion that applied in 3 chats is a weak signal.

## Project layout

| Directory            | Contents                                                            |
| -------------------- | ------------------------------------------------------------------- |
| `apps/web`           | React UI, TanStack Router and Query                                 |
| `apps/api`           | Hono RPC and Workers AI                                             |
| `packages/contracts` | Shared Zod validation                                               |
| `packages/db`        | Drizzle schemas and migrations                                      |
| `tests`              | HTTP tests and server setup                                         |
| `data`               | DEV dataset and evaluations, the PROD control set, a 10-chat sample |
| `results`            | Submission files in Results JSON 1.0 (`dev` and `prod`)             |
| `tools/calibrate`    | Scripts and reports that compare model runs with human labels       |
| `docs`               | Architecture, labeling guide and research notes                     |

## Local setup

Use the Node.js 26 version pinned in [`.node-version`](.node-version) and Vite+ (`vp`).

```sh
vp install
vp run db:migrate:local
vp run dev
```

Open <http://127.0.0.1:5173>. D1 runs locally and stores data in `.wrangler/state`. The default `CLOUDFLARE_VITE_FORCE_LOCAL=true` in `apps/web/.env.development.local` lets you start the app without a Cloudflare login.

> [!NOTE]
> Open the app on `127.0.0.1`, not `localhost`. The workspace cookie belongs to one address, so the other one shows an empty workspace.

### Loading data

On the Conversations page, use the **Import** menu.

- **Load DEV dataset** loads [data/invoke.json](data/invoke.json) and the finished DEV evaluations from [data/evaluations-dev.json](data/evaluations-dev.json), so nothing has to be re-run.
- **Import JSON** loads an organizer dataset in any environment. The dataset id in the file becomes the dataset name in the **Dataset** filter, so a file with a new id appears next to DEV. A file that reuses an existing id adds nothing, because those conversations already exist. [data/PROD.json](data/PROD.json) is the 10-chat control set with the id `FBroker`, and [data/dev_10selected.json](data/dev_10selected.json) is a 10-chat sample of DEV with its own id.

See [Datasets and API](CQA_HACKATHON.md#datasets-and-api) for the file format.

### Running evaluations

Running evaluations requires the remote Workers AI binding. Set `CLOUDFLARE_VITE_FORCE_LOCAL=false` in `apps/web/.env.development.local`, run `vp -C apps/api exec wrangler login`, and restart the dev server. AI calls use your Cloudflare account's allowance or billing.

## Checks and tools

| Command                   | Purpose                                       |
| ------------------------- | --------------------------------------------- |
| `vp run ready`            | Check formatting, lint, types, and build      |
| `vp check --fix`          | Apply formatting and fixable lint corrections |
| `vp run test`             | Run all tests                                 |
| `vp test watch`           | Run tests in watch mode                       |
| `vp run db:studio:local`  | Inspect local D1                              |
| `vp run db:studio:remote` | Inspect remote D1                             |

Tests start their own server, migrate a temporary D1 database, and stub Workers AI.

Studio opens at <https://local.drizzle.studio>. Remote Studio requires `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_DATABASE_ID`, and `CLOUDFLARE_D1_TOKEN` in `packages/db/.env`. The token needs D1 Edit permission.

## Schema changes

After changing table definitions in `packages/db/src/schema.ts`, generate and apply the local migration.

```sh
vp run db:generate
vp run db:migrate:local
```

Commit generated SQL and metadata in `packages/db/migrations`. For Worker binding changes, update `apps/api/src/env.ts` and run `vp run cf:types`.

## Deployment

Log in with `vp -C apps/api exec wrangler login`. For a different Cloudflare account or database, update the account ID and D1 database name and ID in `apps/api/wrangler.jsonc`.

After checks and tests pass, preview the deployment, apply the remote migrations, and deploy.

```sh
vp run deploy:dry
vp run db:migrate:remote
vp run deploy
```

## Documentation

| File                                                                 | Topic                           |
| -------------------------------------------------------------------- | ------------------------------- |
| [CQA_HACKATHON.md](CQA_HACKATHON.md)                                 | Task, data formats and rules    |
| [docs/CQA_ARCHITECTURE.md](docs/CQA_ARCHITECTURE.md)                 | Architecture                    |
| [docs/LABELING_GUIDE.md](docs/LABELING_GUIDE.md)                     | How dialogs are labeled         |
| [tools/calibrate/reports/INDEX.md](tools/calibrate/reports/INDEX.md) | Model runs compared with labels |
| [docs/research](docs/research)                                       | Research notes                  |
