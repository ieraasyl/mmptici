# CQA API

The Hono Worker serves `/api/health` and `/api/cqa`. It uses D1 for workspace data and Workers AI for transcript evaluation. The web app uses the `AppType` export from `@app/api/types` for typed RPC calls.

Run `vp run dev` from the repo root to serve the web app and API together. See the [local setup](../../README.md#local-setup) for D1 migrations and Workers AI configuration.

After changing Worker bindings in `wrangler.jsonc`, update `src/env.ts` and run `vp run cf:types` from the repo root. Use the [root deployment commands](../../README.md#deployment) to ship the Worker with its web assets.
