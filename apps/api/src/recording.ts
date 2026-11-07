import type {
  HTMLRewriter as WorkerHTMLRewriter,
  Response as WorkerResponse,
} from "@cloudflare/workers-types";

declare const HTMLRewriter: typeof WorkerHTMLRewriter;

const playerOrigin = "https://ec88f21f1accecf38e20095a9fe175.a5.environment.api.powerplatform.com";
const playerPath =
  /^\/powerautomate\/automations\/direct\/cu\/\d+\/workflows\/[\da-f]+\/triggers\/manual\/paths\/invoke\/Conversation\/[\da-f-]+$/i;
const audioOrigin = "https://freedomholdingcorporation.crm11.dynamics.com";

export async function resolveRecordingUrl(audioUrl: string) {
  const url = new URL(audioUrl);
  if (url.origin !== playerOrigin || !playerPath.test(url.pathname)) return url.href;

  const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(8_000) });
  if (!response.ok) return null;

  const source: { url: string | null } = { url: null };
  const player = new HTMLRewriter().on("audio source[src]", {
    element(element) {
      source.url ??= element.getAttribute("src");
    },
  });
  await player.transform(response as unknown as WorkerResponse).arrayBuffer();
  const recording = source.url && URL.parse(source.url);
  return recording && recording.origin === audioOrigin ? recording.href : null;
}
