import { Hono } from "hono";
import { cqaRoutes } from "./routes/cqa.ts";
import { handleError } from "./errors.ts";
import type { Bindings } from "./env.ts";

const app = new Hono<{ Bindings: Bindings }>();

app.onError(handleError);
app.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "Endpoint not found." } }, 404));

const routes = app.get("/api/health", (c) => c.json({ ok: true })).route("/api/cqa", cqaRoutes);

export type AppType = typeof routes;

export default app;
