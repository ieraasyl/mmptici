# CQA web app

Run `vp run dev` from the repo root. The Cloudflare Vite plugin serves the React app and Hono API together at `http://127.0.0.1:5173`. See the [local setup](../../README.md#local-setup) for database and dataset instructions.

TanStack Router generates `src/routeTree.gen.ts` from `src/routes`. TanStack Query uses the typed Hono client in `src/lib/api.ts` for API requests. Feature components live in `src/components/cqa`. See the [shadcn/ui conventions](../../SHADCN.MD) for shared components and styling.
