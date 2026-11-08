import app from "../apps/api/src/index.ts";
import { defaultChecklist } from "../apps/api/src/checklist.ts";
import { InferenceApiError } from "../apps/api/src/inference/client.ts";
import type { Bindings } from "../apps/api/src/env.ts";

async function seedLegacyEvaluation(request: Request, env: Bindings) {
  const { conversationId, model } = (await request.json()) as {
    conversationId: string;
    model: string;
  };
  await env.DB.prepare(
    "INSERT INTO cqa_evaluations (id, conversation_id, checklist, ratings, model, created_at) VALUES (?, ?, ?, '[]', ?, ?)",
  )
    .bind(crypto.randomUUID(), conversationId, JSON.stringify(defaultChecklist), model, Date.now())
    .run();
  return new Response(null, { status: 204 });
}

export default {
  fetch(request: Request, env: Bindings) {
    const { pathname } = new URL(request.url);
    if (request.method === "POST" && pathname === "/api/cqa/test-legacy-evaluation") {
      // Stands in for a row saved before evaluations had an origin: random ID, origin left at its default.
      return seedLegacyEvaluation(request, env);
    }
    const mode = request.headers.get("X-CQA-Test-Model");
    if (!mode || !new URL(request.url).pathname.startsWith("/api/cqa/")) {
      return app.fetch(request, env);
    }

    // Stands in for the Hugging Face model: answers from the criteria in the prompt.
    const LLM: NonNullable<Bindings["LLM"]> = {
      model: "test-model",
      async complete(messages) {
        if (mode === "no-credits") throw new InferenceApiError(402, "Payment required");
        const { criteria } = JSON.parse(messages[1].content) as {
          criteria: { criterionId: string; title: string; allowedAnswers: string[] }[];
        };
        const ratings = Object.fromEntries(
          criteria.map(({ criterionId, title, allowedAnswers }) => [
            criterionId,
            {
              answer:
                criterionId === "opening" || criterionId === "violations"
                  ? "no"
                  : allowedAnswers.includes("na")
                    ? "na"
                    : allowedAnswers.at(-1) === "no"
                      ? "yes"
                      : allowedAnswers.at(-1),
              explanation: `Checked ${title} against the test transcript.`,
              evidence: [mode === "invalid" ? 999 : 2],
            },
          ]),
        );
        return { content: JSON.stringify({ ratings }), model: "test-model" };
      },
    };

    return app.fetch(request, { ...env, LLM });
  },
};
