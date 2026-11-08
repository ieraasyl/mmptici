import app from "../apps/api/src/index.ts";
import type { Bindings } from "../apps/api/src/env.ts";
import devDataset from "../data/invoke.json";

export default {
  fetch(request: Request, env: Bindings) {
    const url = new URL(request.url);
    const swapFixture = "/api/test-swap-dataset";
    if (url.pathname === swapFixture) {
      if (request.method !== "GET") return new Response(null, { status: 405 });
      return Response.json({
        isSuccess: true,
        data: { dataset_group_id: "Swap", records: devDataset.data.records.slice(0, 1) },
      });
    }
    if (request.headers.get("X-CQA-Test-Dataset") === "swap") {
      return app.fetch(request, { ...env, CQA_SWAP_DATASET_URL: new URL(swapFixture, url).href });
    }
    const mode = request.headers.get("X-CQA-Test-Model");
    if (!mode || !url.pathname.startsWith("/api/cqa/")) {
      return app.fetch(request, env);
    }

    // Stands in for the Hugging Face model: answers from the criteria in the prompt.
    const LLM: NonNullable<Bindings["LLM"]> = {
      model: "test-model",
      async complete(messages) {
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
