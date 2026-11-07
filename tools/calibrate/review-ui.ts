// Local web page for deciding AI-label disagreements. Saves straight into the decisions CSV.
//
//   node tools/calibrate/review-ui.ts [--decisions tools/calibrate/labels/ai-round1-decisions.csv] [--port 8787]
//
// Shows each review row with the full dialog (cited turns highlighted) and both labelers'
// answers, evidence, and notes. Binds to 127.0.0.1 only.

import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { defaultChecklist } from "../../apps/api/src/checklist.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const { values: args } = parseArgs({
  options: {
    decisions: { type: "string", default: `${root}tools/calibrate/labels/ai-round1-decisions.csv` },
    labels: { type: "string", multiple: true },
    port: { type: "string", default: "8787" },
  },
});
const decisionsPath = args.decisions!;
const labelPaths = args.labels ?? [
  `${root}tools/calibrate/labels/ai-fable.csv`,
  `${root}tools/calibrate/labels/ai-opus.csv`,
];

/** RFC 4180 CSV: quoted fields, doubled quotes, embedded commas and newlines, optional BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

function toObjects(rows: string[][]): Record<string, string>[] {
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

function csvField(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

const DECISION_HEADER = [
  "conversation_id",
  "criterion_id",
  "a_labeler",
  "a_answer",
  "b_labeler",
  "b_answer",
  "decision",
  "reviewer",
  "reason",
];

function readDecisions() {
  return toObjects(parseCsv(readFileSync(decisionsPath, "utf8")));
}

function writeDecisions(rows: Record<string, string>[]) {
  const lines = [DECISION_HEADER.join(",")];
  for (const r of rows) lines.push(DECISION_HEADER.map((h) => csvField(r[h] ?? "")).join(","));
  const tmp = `${decisionsPath}.tmp`;
  writeFileSync(tmp, `${lines.join("\r\n")}\r\n`);
  renameSync(tmp, decisionsPath);
}

function allowed(criterionId: string): string[] {
  const c = defaultChecklist.criteria.find((x) => x.id === criterionId);
  if (!c) return [];
  const base = c.kind === "numeric" ? c.scale.map(String) : ["yes", "no"];
  return c.allowNA ? [...base, "na"] : base;
}

type Turn = { timestamp: string; speaker: string; text: string };
const records: {
  conversation_id: string;
  language: string;
  channel: string;
  transcript: Turn[];
}[] = JSON.parse(readFileSync(`${root}data/invoke.json`, "utf8")).data.records;
const dialogs = new Map(records.map((r) => [r.conversation_id, r]));

function payload() {
  const labels = labelPaths.flatMap((p) => toObjects(parseCsv(readFileSync(p, "utf8"))));
  const byKey = new Map(
    labels.map((l) => [`${l.labeler}|${l.conversation_id}|${l.criterion_id}`, l]),
  );
  const rows = readDecisions().map((d) => {
    const side = (labeler: string) => {
      const l = byKey.get(`${labeler}|${d.conversation_id}|${d.criterion_id}`);
      return {
        labeler,
        answer: l?.answer ?? "",
        evidence: (l?.evidence_turns ?? "")
          .split(/[;,\s]+/)
          .filter(Boolean)
          .map(Number),
        note: l?.note ?? "",
      };
    };
    const crit = defaultChecklist.criteria.find((c) => c.id === d.criterion_id);
    return {
      ...d,
      title: crit?.title ?? d.criterion_id,
      guidance: crit?.guidance ?? "",
      allowed: allowed(d.criterion_id),
      a: side(d.a_labeler),
      b: side(d.b_labeler),
    };
  });
  const used = new Set(readDecisions().map((d) => d.conversation_id));
  return {
    file: decisionsPath.replace(root, ""),
    rows,
    dialogs: Object.fromEntries(
      [...used].map((id) => {
        const d = dialogs.get(id)!;
        return [id, { language: d.language, channel: d.channel, transcript: d.transcript }];
      }),
    ),
  };
}

const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Label review</title><style>
:root{--bg:#f7f7f5;--card:#fff;--ink:#1d1d1b;--muted:#6b6b66;--line:#e2e2dc;--accent:#2f5bd3;--hit:#fff3c4;--ok:#1f7a4d;--warn:#a45b00}
@media (prefers-color-scheme:dark){:root{--bg:#161615;--card:#1f1f1d;--ink:#ecece8;--muted:#9a9a93;--line:#33332f;--accent:#7c9cff;--hit:#4a3f12;--ok:#5cc28f;--warn:#e0a24d}}
*{box-sizing:border-box}body{margin:0;font:14px/1.45 system-ui,sans-serif;background:var(--bg);color:var(--ink)}
header{position:sticky;top:0;z-index:2;background:var(--card);border-bottom:1px solid var(--line);padding:10px 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
header b{font-size:15px}.muted{color:var(--muted)}input,textarea,select{font:inherit;color:inherit;background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:6px 8px}
main{display:grid;grid-template-columns:280px 1fr;gap:16px;padding:16px;max-width:1500px;margin:0 auto}
@media (max-width:900px){main{grid-template-columns:1fr}}
nav{background:var(--card);border:1px solid var(--line);border-radius:10px;max-height:calc(100vh - 90px);overflow:auto;position:sticky;top:70px}
nav button{display:flex;justify-content:space-between;width:100%;text-align:left;border:0;border-bottom:1px solid var(--line);background:none;color:inherit;padding:8px 10px;cursor:pointer;font:inherit}
nav button.on{background:var(--hit)}.done{color:var(--ok)}.todo{color:var(--warn)}
section{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media (max-width:1200px){section{grid-template-columns:1fr}}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px}
.turn{padding:4px 6px;border-radius:5px;white-space:pre-wrap}.turn.hit{background:var(--hit)}.turn .n{color:var(--muted);font-variant-numeric:tabular-nums}
.sp-operator{font-weight:600}.sp-bot,.sp-system{color:var(--muted)}
.lab{border-top:1px solid var(--line);padding-top:8px;margin-top:8px}.ans{font-weight:700;font-size:16px}
.choices{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.choices button{border:1px solid var(--line);background:var(--bg);color:inherit;border-radius:6px;padding:6px 12px;cursor:pointer;font:inherit}
.choices button.on{background:var(--accent);border-color:var(--accent);color:#fff}
textarea{width:100%;min-height:70px}.save{background:var(--accent);color:#fff;border:0;border-radius:6px;padding:8px 16px;cursor:pointer;font:inherit}
.status{margin-left:8px}.transcript{max-height:calc(100vh - 140px);overflow:auto}
</style></head><body>
<header><b>Label review</b><span class="muted" id="file"></span><span id="progress"></span>
<label class="muted">Reviewer <input id="reviewer" size="12" placeholder="your name"></label>
<label class="muted"><input type="checkbox" id="onlyTodo"> only undecided</label></header>
<main><nav id="list"></nav><section><div class="card" id="detail"></div><div class="card transcript" id="transcript"></div></section></main>
<script>
let data, cur = 0, pick = "";
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
try { $("reviewer").value = localStorage.getItem("reviewer") || ""; } catch {}
$("reviewer").oninput = () => { try { localStorage.setItem("reviewer", $("reviewer").value); } catch {} };
$("onlyTodo").onchange = renderList;
async function load() { data = await (await fetch("/api/data")).json(); $("file").textContent = data.file; renderList(); show(cur); }
function renderList() {
  const done = data.rows.filter((r) => r.decision).length;
  $("progress").textContent = done + " / " + data.rows.length + " decided";
  $("list").innerHTML = data.rows.map((r, i) => (!$("onlyTodo").checked || !r.decision)
    ? '<button class="' + (i === cur ? "on" : "") + '" onclick="show(' + i + ')"><span>' + esc(r.conversation_id) + " · " + esc(r.criterion_id) +
      '</span><span class="' + (r.decision ? "done" : "todo") + '">' + (r.decision ? esc(r.decision) : "todo") + "</span></button>" : "").join("");
}
function side(s) {
  return '<div class="lab"><span class="muted">' + esc(s.labeler) + '</span> <span class="ans">' + esc(s.answer || "—") + '</span> <span class="muted">turns ' +
    (s.evidence.join(", ") || "—") + "</span><div>" + esc(s.note) + "</div></div>";
}
function show(i) {
  cur = i; const r = data.rows[i]; pick = r.decision || "";
  const d = data.dialogs[r.conversation_id];
  const hits = new Set([...r.a.evidence, ...r.b.evidence]);
  $("detail").innerHTML = "<div class='muted'>" + esc(r.conversation_id) + " · " + esc(d.language) + " · " + esc(d.channel) + "</div><h2 style='margin:4px 0'>" +
    esc(r.title) + "</h2><div class='muted'>" + esc(r.guidance) + "</div>" + side(r.a) + side(r.b) +
    "<div class='lab'><b>Decision</b><div class='choices'>" + r.allowed.map((a) => "<button data-a='" + esc(a) + "' class='" + (a === pick ? "on" : "") + "'>" + esc(a) + "</button>").join("") +
    "</div><textarea id='reason' placeholder='Reason (one sentence)'>" + esc(r.reason || "") + "</textarea><div style='margin-top:8px'><button class='save' id='save'>Save and next</button><span class='status muted' id='status'></span></div></div>";
  document.querySelectorAll(".choices button").forEach((b) => b.onclick = () => { pick = b.dataset.a; document.querySelectorAll(".choices button").forEach((x) => x.classList.toggle("on", x === b)); });
  $("save").onclick = save;
  $("transcript").innerHTML = d.transcript.map((t, k) => "<div class='turn " + (hits.has(k + 1) ? "hit" : "") + "' id='t" + (k + 1) + "'><span class='n'>[" + (k + 1) + "]</span> <span class='sp-" + esc(t.speaker) + "'>" +
    esc(t.speaker) + "</span> <span class='muted'>" + esc(t.timestamp) + "</span>: " + esc(t.text) + "</div>").join("");
  const first = [...hits].sort((x, y) => x - y)[0]; if (first) $("t" + first)?.scrollIntoView({ block: "center" });
  renderList();
}
async function save() {
  const r = data.rows[cur];
  if (!pick) { $("status").textContent = "Pick an answer first."; return; }
  if (!$("reviewer").value.trim()) { $("status").textContent = "Enter your name at the top."; return; }
  const res = await fetch("/api/decision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
    conversation_id: r.conversation_id, criterion_id: r.criterion_id, decision: pick, reviewer: $("reviewer").value.trim(), reason: $("reason").value.trim() }) });
  const out = await res.json();
  if (!res.ok) { $("status").textContent = out.error; return; }
  Object.assign(r, { decision: pick, reviewer: $("reviewer").value.trim(), reason: $("reason").value.trim() });
  const next = data.rows.findIndex((x, k) => k > cur && !x.decision);
  show(next === -1 ? cur : next); $("status").textContent = "Saved.";
}
load();
</script></body></html>`;

const server = createServer((req, res) => {
  const send = (status: number, body: unknown, type = "application/json") => {
    res.writeHead(status, {
      "Content-Type": `${type}; charset=utf-8`,
      "Cache-Control": "no-store",
    });
    res.end(typeof body === "string" ? body : JSON.stringify(body));
  };
  try {
    const ports = [`127.0.0.1:${args.port}`, `localhost:${args.port}`];
    if (!ports.includes(req.headers.host ?? "")) return send(403, { error: "Bad Host header." });
    if (req.method === "POST") {
      const origin = req.headers.origin;
      if (origin !== undefined && !ports.some((h) => origin === `http://${h}`))
        return send(403, { error: "Bad Origin header." });
      const type = (req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
      if (type !== "application/json")
        return send(415, { error: "Content-Type must be application/json." });
    }
    if (req.method === "GET" && req.url === "/") return send(200, page, "text/html");
    if (req.method === "GET" && req.url === "/api/data") return send(200, payload());
    if (req.method === "POST" && req.url === "/api/decision") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          const input = JSON.parse(body) as Record<string, string>;
          const rows = readDecisions();
          const row = rows.find(
            (r) =>
              r.conversation_id === input.conversation_id && r.criterion_id === input.criterion_id,
          );
          if (!row) return send(404, { error: "Row not found in the decisions file." });
          if (!allowed(row.criterion_id).includes(input.decision))
            return send(400, { error: `Not an allowed answer: ${input.decision}` });
          if (!input.reviewer?.trim()) return send(400, { error: "Reviewer name is required." });
          Object.assign(row, {
            decision: input.decision,
            reviewer: input.reviewer.trim(),
            reason: (input.reason ?? "").trim(),
          });
          writeDecisions(rows);
          send(200, { ok: true });
        } catch (error) {
          send(400, { error: error instanceof Error ? error.message : String(error) });
        }
      });
      return;
    }
    send(404, { error: "Not found" });
  } catch (error) {
    send(500, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(Number(args.port), "127.0.0.1", () => {
  console.log(`Label review: http://127.0.0.1:${args.port}  (saving to ${decisionsPath})`);
});
