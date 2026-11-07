# mmptici

Conversation Quality Analytics (CQA) prototype. The React UI and Hono API deploy together as one Cloudflare Worker.

[Live app](https://mmptici.ieraasyl.workers.dev)

## Project layout

| Directory            | Contents                            |
| -------------------- | ----------------------------------- |
| `apps/web`           | React UI, TanStack Router and Query |
| `apps/api`           | Hono RPC and Workers AI             |
| `packages/contracts` | Shared Zod validation               |
| `packages/db`        | Drizzle schemas and migrations      |
| `tests`              | HTTP tests and server setup         |
| `data`               | Hackathon DEV dataset               |

See [AGENTS.md](AGENTS.md) for implementation conventions.

## Local setup

Use the Node.js 26 version pinned in [`.node-version`](.node-version) and Vite+ (`vp`).

```sh
vp install
vp run db:migrate:local
vp run dev
```

Open <http://127.0.0.1:5173>. D1 runs locally and stores data in `.wrangler/state`. The default `CLOUDFLARE_VITE_FORCE_LOCAL=true` in `apps/web/.env.development.local` lets you start the app without a Cloudflare login.

On the Conversations page, click **Load DEV dataset** to load [data/invoke.json](data/invoke.json) during local development. Use **Import JSON** to load an organizer dataset in any environment. See [Datasets and API](CQA_HACKATHON.md#datasets-and-api) for the file format.

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
