import app from "../apps/api/src/index.ts";
import type { Bindings } from "../apps/api/src/env.ts";

export default {
  fetch(request: Request, env: Bindings) {
    const mode = request.headers.get("X-CQA-Test-Model");
    if (!mode || !new URL(request.url).pathname.startsWith("/api/cqa/")) {
      return app.fetch(request, env);
    }

    const AI = {
      async run(_model: string, input: { messages: { content: string }[] }) {
        const { criteria } = JSON.parse(input.messages[1].content) as {
          criteria: { criterionId: string; title: string; allowedAnswers: (string | number)[] }[];
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
        return { choices: [{ message: { content: JSON.stringify({ ratings }) } }] };
      },
    } as NonNullable<Bindings["AI"]>;

    return app.fetch(request, { ...env, AI });
  },
};
