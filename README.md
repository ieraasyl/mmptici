# mmptici

Conversation Quality Analytics (CQA) prototype. The React UI and Hono API deploy together as one Cloudflare Worker.

[Live app](https://mmptici.ieraasyl.workers.dev)

## Project layout

| Directory            | Contents                                      |
| -------------------- | --------------------------------------------- |
| `apps/web`           | React UI, TanStack Router and Query           |
| `apps/api`           | Hono RPC and the evaluator                    |
| `packages/contracts` | Shared Zod validation                         |
| `packages/db`        | Drizzle schemas and migrations                |
| `tests`              | HTTP tests and server setup                   |
| `data`               | Hackathon DEV dataset and bundled evaluations |
| `tools/submission`   | Results JSON 1.0 run, export, validate        |
| `tools/calibrate`    | Calibration runs and reports                  |
| `results`            | Submitted results files                       |

See [AGENTS.md](AGENTS.md) for implementation conventions.

## Local setup

Use the Node.js 26 version pinned in [`.node-version`](.node-version) and Vite+ (`vp`).

```sh
vp install
vp run db:migrate:local
vp run dev
```

Open <http://127.0.0.1:5173>. D1 runs locally and stores data in `.wrangler/state`. The default `CLOUDFLARE_VITE_FORCE_LOCAL=true` in `apps/web/.env.development.local` lets you start the app without a Cloudflare login. No Cloudflare account is needed for the database or the evaluator.

On the Conversations page, click **Load DEV dataset** to load [data/invoke.json](data/invoke.json) together with the bundled evaluations in [data/evaluations-dev.json](data/evaluations-dev.json). Those bundled evaluations were produced earlier by three models and are imported as they are: loading them makes no model calls. Use **Import JSON** to load an organizer dataset in any environment, then **Run evaluation** to score it with the model. See [Datasets and API](CQA_HACKATHON.md#datasets-and-api) for the file format.

## Evaluation model

Evaluations call `Qwen/Qwen3.8-27B:cerebras` through the Hugging Face Inference Providers router. The credential is a Hugging Face token with the "Inference Providers" permission. The evaluator never uses the Workers AI binding.

1. Copy [`apps/api/.dev.vars.example`](apps/api/.dev.vars.example) to `apps/api/.dev.vars`.
2. Set `HF_TOKEN=<your token>`. `apps/api/.dev.vars` is git-ignored.
3. Optionally set `CQA_MODEL` to another model name the router serves, for example `openai/gpt-oss-120b:cerebras`.
4. Restart `vp run dev`.

Without `HF_TOKEN`, running an evaluation returns `503 AI_UNAVAILABLE` with the message "The evaluation model is not configured. Set HF_TOKEN to run an evaluation." and a batch stops after the first failure. In production the same values are Worker secrets: `vp -C apps/api exec wrangler secret put HF_TOKEN`.

Cost: at $0.99 per million input tokens and $1.49 per million output tokens, one chat costs about $0.01 (the 59-chat calibration run cost $0.59, most of it reasoning tokens). One evaluation makes one model call. A reply that fails validation gets one corrective call, a cut-off reply gets one more with a larger token budget, and rate-limited or failed requests are retried twice, so a single evaluation can make up to four calls.

## Results files

The organizers' results files live in `results/dev/results.json` and `results/prod/results.json` (Results JSON 1.0, see [CQA_HACKATHON.md](CQA_HACKATHON.md#results-submission)). They are produced outside the app by a checkpointed runner that uses the same evaluator, default checklist, and scorer. Run files are written to `tools/submission/runs/`, which is git-ignored, and hold every model answer so an interrupted run never repeats a paid call.

```sh
# Evaluate every record of an organizer dataset (needs HF_TOKEN; at most 4 calls in flight)
vp run submission:run --input data/invoke.json --run tools/submission/runs/dev.json
# Continue after an interruption, or retry only the failed conversations
vp run submission:run --resume tools/submission/runs/dev.json
vp run submission:run --retry-failed tools/submission/runs/dev.json
# Write and validate the results file, keeping the input's order and IDs
vp run submission:export --input data/invoke.json --run tools/submission/runs/dev.json \
  --team-name <team> --dataset dev --out results/dev/results.json
vp run submission:validate --input data/invoke.json --results results/dev/results.json --dataset dev
```

For the control set, download the organizer JSON for the control `group_id` with `curl`, then run the same three commands with `--dataset prod` and `results/prod/results.json`. `submission:export` refuses while any conversation is unfinished, when the run was made from a different input, or when the checklist no longer has the eight default criteria, and it recomputes every score before writing.

## Checks and tools

| Command                   | Purpose                                       |
| ------------------------- | --------------------------------------------- |
| `vp run ready`            | Check formatting, lint, types, and build      |
| `vp check --fix`          | Apply formatting and fixable lint corrections |
| `vp run test`             | Run all tests                                 |
| `vp test watch`           | Run tests in watch mode                       |
| `vp run db:studio:local`  | Inspect local D1                              |
| `vp run db:studio:remote` | Inspect remote D1                             |

Tests start their own server, migrate a temporary D1 database, and stub the evaluation model.

Studio opens at <https://local.drizzle.studio>. Remote Studio requires `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_DATABASE_ID`, and `CLOUDFLARE_D1_TOKEN` in `packages/db/.env`. The token needs D1 Edit permission.

## Schema changes

After changing table definitions in `packages/db/src/schema.ts`, generate and apply the local migration.

```sh
vp run db:generate
vp run db:migrate:local
```

Commit generated SQL and metadata in `packages/db/migrations`. For Worker binding changes, update `apps/api/src/env.ts` and run `vp run cf:types`.

## Deployment

Log in with `vp -C apps/api exec wrangler login`. For a different Cloudflare account or database, update the account ID and D1 database name and ID in `apps/api/wrangler.jsonc`. Set the `HF_TOKEN` secret once with `vp -C apps/api exec wrangler secret put HF_TOKEN`.

After checks and tests pass, preview the deployment, apply the remote migrations, and deploy.

```sh
vp run deploy:dry
vp run db:migrate:remote
vp run deploy
```
