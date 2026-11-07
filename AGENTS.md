# Agent instructions

See [README.md](README.md) for setup and commands.

- Use `vp` for tooling. Check package scripts; run them with `vp run <name>`. Run `vp install` before work and after dependency changes.
- Set external dependency versions in the workspace catalog in [`pnpm-workspace.yaml`](pnpm-workspace.yaml) and use `catalog:` in package manifests.
- Import tooling from `vite-plus`, tests from `vite-plus/test`. For tooling failures, consult `node_modules/vite-plus/docs` and run `vp env doctor`.
- Keep UI in `apps/web` and shared validation in `packages/contracts`. Keep database access and workspace cookie handling out of browser imports. Use scoped `@cloudflare/workers-types` imports and keep Worker ambient globals confined to the API project.
- Follow the component and styling conventions in [SHADCN.MD](SHADCN.MD) when changing the UI.
- Use [CQA_HACKATHON.md](CQA_HACKATHON.md) for requirements when implementing hackathon features.
- Chain Hono routes for RPC inference. Use `apps/web/src/lib/api.ts`; import API types with `import type` from `@app/api/types`.
- Keep private Query data scoped to the active browser workspace and forward cancellation signals. Retain saved data when refresh fails. Never retry a confirmed write because its response is malformed.
- Add routes in `apps/web/src/routes`. Keep workspace initialization ahead of route rendering. Regenerate and commit `routeTree.gen.ts` without hand-editing it.
- Read the workspace ID from the HTTP-only cookie in API middleware. Scope private database reads and writes to that workspace.
- After binding changes, regenerate Cloudflare types and update `apps/api/src/env.ts`. Commit generated migration SQL and metadata without hand-editing them.
- Keep generation, migrations, and deployment uncached. Deploy through the root script.
- Validate code changes with `vp run ready` and `vp run test`; tests manage their own server/database.
- Edit documentation only when explicitly requested.

## Git conventions

- Branches: `feat/<short-kebab-case-description>` unless the user specifies otherwise.
- Conventional Commits with a short imperative subject, e.g. `fix(auth): reject expired sessions`. One line only; no body or trailers.
- Keep commits focused. Stage related files only and review the staged diff.
