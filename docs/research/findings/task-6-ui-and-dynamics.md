# Task 6: UI and workflow patterns for QA tools, and Dynamics 365 integration

Date: 2026-11-07. Researcher: Task 6. Scope: Part A (how QA tools present scored conversations), Part B (what "adaptable as a Dynamics 365 HTML component" means, from Microsoft Learn), Part C (demo tactics). Every claim carries a URL to a page I fetched today, unless it is marked "search snippet only" or "not verified".

## 0. Summary

1. **The strongest finding is in Part B, and the team's research brief did not have it: Microsoft already ships a native QA product inside Dynamics 365.** "Quality evaluation" (the Quality Evaluation Agent) runs in Dynamics 365 Customer Service and Contact Center. Its model is close to the case checklist:
   - sections with weights that must total 100%;
   - Yes/No and single-select questions scored 0 to 100;
   - an "Allow Not Applicable responses" option, which excludes a question from the score;
   - "Mark as critical question", which fails the whole evaluation without changing the score;
   - versioned criteria and simulation runs on 25 recent records.

   The Freedom Broker judge may know this product. The team should show its own checklist in the same terms. Freedom Broker's operators are in RU/KZ, and Microsoft's own product does not document an agent-side appeal flow. Both are gaps our prototype fills. https://learn.microsoft.com/en-us/dynamics365/contact-center/use/evaluation-criteria
2. **"HTML component" has an exact Microsoft meaning: an HTML web resource.** It is a static HTML/JS/CSS file stored in Dataverse. It can run on a form, as a Copilot Service workspace app tab (`Microsoft.Apm.createTab`), or in an app side pane (`Xrm.App.sidePanes.createPane`, pageType `webresource`). A web resource needs no auth code to call the Dataverse Web API, because the app has already signed the user in. It also accepts only fixed query parameters (`id`, `typename`, `data`, and a few others). https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/webpage-html-web-resources, https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/authenticate-web-api
3. **The team's React 19 cannot use the PCF "React platform library" path.** That path supplies React 16.14.0 at build time and loads 17.0.2 at runtime in model-driven apps. A standard (non-virtual) PCF control can bundle its own React, but has to ship everything in one bundle. https://learn.microsoft.com/en-us/power-apps/developer/component-framework/react-controls-platform-libraries, https://learn.microsoft.com/en-us/power-apps/developer/component-framework/limitations
4. **Recommendation:** target an HTML web resource opened as a Copilot Service workspace app tab or side pane, bound to the Conversation record (`msdyn_ocliveworkitem`) by `id`. Treat a standard PCF control as the later step for the per-criterion result card. The minimal code changes to make the claim honest:
   - one `CqaDataSource` interface, with the Hono client and a Dataverse/Xrm stub behind it;
   - hash history in TanStack Router;
   - a static build with relative asset paths;
   - pure presentational components that take props;
   - no dependence on the HTTP-only workspace cookie inside the embed.

   Section B.6 has the details.
5. **Part A: five UI behaviours a judge notices in 5 minutes.**
   - Clicking a criterion's evidence jumps to and highlights the exact turn.
   - N/A is shown as excluded from the denominator, with the redistributed weight visible.
   - The serious-violation flag is visually separate from the score.
   - The appeal shows original, decision, and final side by side, with the reason.
   - A visible "live run" trace shows the model, latency, tokens, and raw JSON.

   Every vendor I checked shows the first four in some form. Amazon Connect documents the jump from a transcript reference to the point in the conversation. https://docs.aws.amazon.com/connect/latest/adminguide/generative-ai-performance-evaluations.html

## Part A. How QA tools present results

### A.1 Comparison table

The cells come from fetched help pages unless marked. "n/f" means the item was not found in public documentation I could read.

| Product | Evidence in transcript | Jump to turn / audio sync | N/A display and math | Auto-fail display | Section scores | Confidence / needs review | Calibration view | Dispute / appeal |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Amazon Connect (Contact Lens) | AI answer "along with context and justification (reference points from the transcript)" | "choose the time associated with a transcript reference to be directed to the point in the conversation" | Optional question can be marked N/A; AI picks N/A when unsure, question excluded, weights redistributed | Automatic fail per option, scope section/subsection/form, sets that scope's score to 0 | Yes, section and question weights, "Weight by section/question", total 100% | n/f as a number; form "Save and validate" warns on weak Gen AI questions | Calibration sessions: several managers score one contact, optional expert, due date; "Automation is disabled on calibration sessions"; after Finalize, a .csv report with per-question weighted scores and "absolute deviation from expert" per participant and per question | Acknowledge with note (2025); appeal workflow with reasoning, email to designated managers, status tracking (posted 2026-02-03) |
| Dynamics 365 Contact Center / Customer Service (Quality evaluation) | Evaluation side pane with Evaluation Summary, Suggested actions, Scoring overview; knowledge-grounded answers cite the article | n/f (no transcript jump documented) | "Allow Not Applicable responses"; N/A questions excluded; score from applicable questions only | "Mark as critical question": failing answer fails the whole evaluation, "Scoring doesn't change", grid column marks critical failures | Sections with weight %, total must be 100; optional question-level weights | AI agent status (Pending/In-progress/Completed/Error); evaluator status | Simulation: run criteria on 25 most recent matching records, results don't affect metrics | No agent dispute documented; Quality Admin/Manager or privilege `prvOverrideSubmittedEval` can Edit a submitted evaluation and resubmit |
| Zendesk QA | AutoQA "highlights"; Deep evaluation and validation (EAP, 2026-05-14) shows step-by-step logic and "the specific conversation evidence" | n/f in fetched pages | AutoQA returns N/A when there is not enough information; reasoning explains why N/A (EAP) | n/f | n/f | n/f | n/f | Reviewee or reviewer starts dispute, "Select new fair scores" optional per category, comment required, send to original reviewer or escalate; no limit on disputes per review |
| Genesys Cloud | Answers tied to "documented transcript evidence" | n/f | N/A via help text (example: interaction ended early) | n/f in fetched pages | n/f | "Low confidence on question"; agreement score human vs AI overall and per question; target 80% on 20 interactions | Agreement scores serve as calibration | Agent "Sign off" or "Dispute" with comment → status "In Review" → evaluator rescores or "Decline dispute"; 45-day window |
| NICE CXone | Interaction plays alongside completed form; each question shows actual score and points possible | Interaction opens with form (playback detail not described) | n/f | "Failed" means at least one critical question failed | n/f | n/f | Calibrations page compares scores between evaluators; high deviation → refine form | Acknowledge → Completed; Appeal with justification → "Challenged", routed to original evaluator or a named user; after second return, cannot be disputed again; auto-acknowledge at 60 days |
| Level AI | "supporting evidence and reasoning"; "relevant timestamps and conversation quotes" (self-reported marketing) | Labeled timestamps (marketing) | Conditional logic marks questions N/A by call type or earlier answers | n/f | n/f | Overrides "recalibrate future scoring" (marketing) | Sandbox test of rubrics on real conversations | "dispute handling" listed, no detail |
| Observe.AI | "traceable evidence" (marketing, no screenshot of how) | "surface key moments" | n/f | n/f | n/f | n/f | Stages: auto-suggest, auto-fill, auto-submit | Acknowledge and dispute options (marketing, no workflow) |
| EvaluAgent | Mock-up: live transcript beside "Auto QA Scorecard" | n/f | n/f | Auto-fail logic; mock-up shows "0 auto-fails" and a FAIL status at 65% | Per-criterion scores in mock-up | High-risk and auto-fail items route to human evaluators | Calibration sessions align human and AI; Testing Console replays past conversations | Agents challenge scores; disputes "feed the loop" |
| MaestroQA | Pages unreachable (HTTP 401) | n/f | n/f | n/f | n/f | n/f | n/f | n/f |
| Scorebuddy | Pages unreachable (socket closed) | n/f | n/f | n/f | n/f | n/f | n/f | n/f |
| Playvox (NICE) | Not found | n/f | n/f | n/f | n/f | n/f | n/f | Only third-party reviews mention disputes and calibration |

Sources for the table: Amazon https://docs.aws.amazon.com/connect/latest/adminguide/generative-ai-performance-evaluations.html, https://docs.aws.amazon.com/connect/latest/adminguide/calibrations-performance-evaluations.html, https://docs.aws.amazon.com/connect/latest/adminguide/create-evaluation-forms.html, https://aws.amazon.com/about-aws/whats-new/2026/01/amazon-connect-appeals-workflow-agent-performance-evaluations ; Microsoft https://learn.microsoft.com/en-us/dynamics365/contact-center/use/evaluation-criteria, https://learn.microsoft.com/en-us/dynamics365/contact-center/use/use-evaluations, https://learn.microsoft.com/en-us/dynamics365/contact-center/use/evaluation-plan ; Zendesk https://support.zendesk.com/hc/en-us/articles/7043760048922-Disputing-a-review, https://support.zendesk.com/hc/en-us/articles/10727979177498 ; Genesys https://help.genesys.cloud/articles/manage-disputed-evaluations/, https://help.genesys.cloud/399798 ; NICE https://help.nicecxone.com/Content/myzone/viewingyourevaluations.htm, https://help.nicecxone.com/Content/qmanalytics/calibration/calibrateformsandevaluations.htm ; Level AI https://thelevel.ai/product/quality-assurance-contact-center ; Observe.AI https://observe.ai/platform/auto-qa ; EvaluAgent https://www.evaluagent.com/auto-quality-assurance/.

**Unverified, from search snippets (not fetched, not used as evidence elsewhere):**

- Amazon Connect: a re:Post answer claims the calibration report compares evaluators "including AI". The fetched admin guide contradicts this ("Automation is disabled on calibration sessions"), so treat the claim as wrong.
- Genesys Cloud: community posts say N/A question groups are excluded from scoring. An official page mentions a "critical score" for critical Yes/No questions.
- NICE: older inContact (Uptivity) form-editor docs say an auto-fail response can fail the section or the whole form, and must carry 0 possible points.
- MaestroQA: an "N/A" option nullifies a criterion's maximum points. An auto-fail section forces a 0% QA score. Appeals have approve/deny reasons, deadlines, and multi-approval Grader QA appeals.
- Scorebuddy: an N/A tag with multiplier 0 removes the question's Max Score from the total.
- Playvox: only third-party reviews (G2, Capterra) mention disputes and calibration.

### A.2 Per-product notes

**Amazon Connect (Contact Lens performance evaluations).** The brief covered generative evaluations. These details are new or updated:
- A Gen AI model version selector (Latest / Preview / Specific version). Version `AGENT_EVALUATION_2026-05-05` (Preview) "adjusts how strictly the model scores answers… where earlier versions were too harsh".
- A two-stage "Save and validate". The second stage checks Gen AI questions against 11 phrasing rules, such as "Positive action framing" and "Specify when the answer is Not Applicable".
- A documented fallback: if AI cannot pick an option, it "selects Not Applicable, even if the question is not optional". The question is then excluded and the weights redistributed.
- An appeals workflow posted 2026-02-03.

The validation rules map well onto writing criterion prompts. The N/A fallback is a failure mode to avoid: our evaluator must never use N/A as an "unsure" bucket.
- https://docs.aws.amazon.com/connect/latest/adminguide/create-evaluation-forms.html
- https://docs.aws.amazon.com/connect/latest/adminguide/generative-ai-performance-evaluations.html
- https://aws.amazon.com/about-aws/whats-new/2026/01/amazon-connect-appeals-workflow-agent-performance-evaluations

Closeness: High. The scoring model (weights, optional/N/A with redistribution, automatic fail, evidence with transcript jump, appeals) is almost our case. Borrow in 24 h: on each criterion card, show the answer, a one-line justification, and clickable turn references, as Amazon's "Ask AI" button does (it returns the answer with "context and justification (reference points from the transcript)"). Add a "Validate criterion" lint when a user edits a criterion: it warns if the text has no N/A condition, or if it uses negative framing.

**Dynamics 365 Quality evaluation (Quality Evaluation Agent).** Pages updated 2026-10-22 and 2026-10-23. This is the native product a Freedom Broker judge is most likely to know.
- **Structure:** Criteria > Sections (weights total 100%) > Questions. Answer types are Yes/No, Single-select (each option scored 0 to 100, as in "Excellent = 100 Good = 75"), Multi-select, and Descriptive.
- **Scoring:** "Section score = Average of all question scores × Section weight percentage" by default, with optional question-level weights. "Overall score = Sum of all section scores, out of 100", and N/A questions are excluded.
- **Critical questions:** these fail the evaluation, but "Scoring doesn't change". This is the same design as our separate serious-violation flag.
- **Instructions and limits:** instructions exist at three levels (criteria, question, answer), each up to 2,000 characters. There are at most 50 questions.
- **Versions:** each publish increments the version, and "Restore/Publish" brings an old one back.
- **Simulation** runs on the 25 most recent matching records.
- **Evaluation methods:** AI agent (no manual editing), AI assisted, and Manual.
- **"Participant evaluated":** Entire record, Current owner, or IVR/Bot. This matters for our bot "AIM" turns.
- **Evaluation states** are listed in A.1.
- **Disputes:** I found no documented agent appeal. Correction happens when a Quality Manager edits a submitted evaluation and resubmits it.

Sources:
- https://learn.microsoft.com/en-us/dynamics365/contact-center/use/evaluation-criteria
- https://learn.microsoft.com/en-us/dynamics365/contact-center/use/evaluation-plan
- https://learn.microsoft.com/en-us/dynamics365/contact-center/use/use-evaluations
- The agent template page says "This agent template isn't available yet" (2026-08-24): https://learn.microsoft.com/en-us/dynamics365/guidance/agent-templates/service-quality-evaluation-agent

Closeness: High. It is the same problem inside the organizer's platform, and it has no agent-side appeal. Borrow in 24 h:
- Use Microsoft's vocabulary in the UI and the pitch: "criteria version", "critical question", "Participant evaluated: Current owner", "simulation".
- Show that our checklist exports to that shape: sections, weights, N/A allowed, critical flag.
- Name appeal + reviewer decision + original/final retention as the thing D365 does not document.

**Zendesk QA.**
- A dispute is either "Review dispute" or "Wrong reviewee dispute". The disputer picks the recipient, may "Select new fair scores" per category, and must add a comment. There is no limit on disputes per review. https://support.zendesk.com/hc/en-us/articles/7043760048922-Disputing-a-review
- The "Deep evaluation and validation" EAP was announced 2026-05-14. It adds step-by-step AI logic, the evidence used, and the reason for an N/A, shown when the user clicks a category score. Voice is not yet eligible. https://support.zendesk.com/hc/en-us/articles/10727979177498

Closeness: Medium. Chat-first and per-category, like ours. Borrow in 24 h: in the appeal form, let the user propose a new value per criterion (not just free text). Show "why N/A" as a sentence under every N/A criterion.

**Genesys Cloud.**
- The dispute flow is "Sign off" or "Dispute" with a comment. Status becomes "In Review", and the evaluator then revises or clicks "Decline dispute". The window is 45 days, and comments may be up to 5,000 characters. https://help.genesys.cloud/articles/manage-disputed-evaluations/ (no date on page)
- The AI scoring guide recommends testing a form on at least 20 interactions and aiming for an agreement score of 80% or higher, overall and per question. It also says "Questions with low agreement scores may not be answered automatically". https://help.genesys.cloud/399798

Closeness: Medium. Borrow in 24 h: present our DEV calibration exactly as Genesys does, with agreement % per criterion on the labeled set and a target line at 80%. Visually mark criteria below the line as "needs review".

**NICE CXone.**
- The agent view shows each question's actual score and points possible. A "Failed" score means at least one critical question failed. Edited evaluations carry an "Updated" label.
- "Appeal" with a justification moves the evaluation to "Challenged". After the evaluator's second return it "can't be disputed again". Auto-acknowledgement happens at 60 days. https://help.nicecxone.com/Content/myzone/viewingyourevaluations.htm
- Calibration compares scores between evaluators and advises refining the form when deviation is high. https://help.nicecxone.com/Content/qmanalytics/calibration/calibrateformsandevaluations.htm

Closeness: Medium. Borrow in 24 h: an "Updated" badge on any evaluation changed by a reviewer decision, and a one-round appeal rule (one appeal per criterion, reviewer decision is final). That keeps the state machine small.

**Level AI.** The product page was dated 2026-11-05. It claims "supporting evidence and reasoning", "relevant timestamps and conversation quotes", conditional N/A logic, hybrid AI plus human scorecards, and a sandbox for testing rubrics. The numbers are self-reported: "over 90%" of standards automated and "near-100% accuracy" on subjective questions. The brief already covered QA-GPT, and this adds nothing it lacked except the hybrid-scorecard and sandbox framing. https://thelevel.ai/product/quality-assurance-contact-center

Closeness: Medium. Borrow in 24 h: label which criteria are "AI-scored" and which are "AI-suggested, human-confirmed" (for example, c05 empathy).

**Observe.AI.** Marketing only. It claims "traceable evidence", auto-suggest / auto-fill / auto-submit stages, and acknowledgement and dispute. The page gives no workflow detail. Its numbers (23% AHT reduction and others) are self-reported, with no method given. https://observe.ai/platform/auto-qa

Closeness: Low (no inspectable UI). Borrow in 24 h: nothing beyond the auto-suggest / auto-submit vocabulary.

**EvaluAgent.** The page mock-up shows a live transcript beside an "Auto QA Scorecard": Greeting 10/10, Verification 15/15, Empathy 3/15, Resolution 7/15, a total of 65%, and a FAIL badge. It also says high-risk and auto-fail items route to humans, and a "Testing Console" replays changes against past conversations. https://www.evaluagent.com/auto-quality-assurance/ (© 2026, no content date)

Closeness: Medium. The mock-up is close to the layout our dialog card needs. Borrow in 24 h: show per-criterion "earned/weight" fractions (10/10, 0/20, N/A) next to the transcript, not just percentages.

**MaestroQA, Scorebuddy, Playvox.**
- MaestroQA's help center returned HTTP 401 to the fetcher, and Scorebuddy's Intercom help pages closed the socket twice. What I know about them comes from search-result snippets only. MaestroQA: "N/A" nullifies a criterion's max points, an auto-fail section forces 0%, and there are appeals with approve/deny reasons and deadlines. Scorebuddy: an N/A tag removes Max Score from the total. I do not cite these as verified.
- Playvox: I found no help-center page at all. One search hit pointed to help.voxjar.com, but Voxjar is a different company, not Playvox, so I discarded it.

Closeness: Low, unverified: help pages were unreachable or absent, so I could not compare their UI with our case. Borrow in 24 h: nothing.

### A.3 Patterns common to all inspected tools

| Pattern | Seen in | What it implies for our UI |
| --- | --- | --- |
| N/A removes the item from the denominator, and weights are redistributed | Amazon, Microsoft, MaestroQA (snippet), Scorebuddy (snippet) | Show both the nominal weight and the effective weight after redistribution, so the judge can check 100 × earned / applicable |
| Critical / auto-fail is separate from points | Microsoft ("Scoring doesn't change"), NICE ("Failed"), EvaluAgent (FAIL badge); Amazon instead zeroes the scope | Our c08 flag matches Microsoft's behaviour. Display it as a red badge next to the total, never folded into it |
| Dispute = comment + optional proposed value, routed to a reviewer, single decision | Zendesk, Genesys, NICE, Amazon | Appeal form: criterion, proposed answer, reason. Reviewer: confirm / change + reason. Store original, decision, final |
| Evidence is a reference into the transcript, not free text | Amazon (time link), Zendesk (evidence used), Level AI (quotes + timestamps) | Evidence chips with turn numbers that scroll to and highlight the turn; render the original turn text, not the model's quote (the brief already recommends this) |
| Agreement with humans is shown per question | Genesys (agreement score, 80% target, 20 interactions), NICE (deviation), Amazon (calibration .csv with "average absolute deviation from expert" per question) | A calibration page with per-criterion agreement on the labeled DEV subset |
| Criteria are versioned; evaluations record the version | Microsoft (version increments), Amazon (form versions, model version pinned per form version) | Show "checklist v3, model X" on each evaluation; after a criterion change, the re-run shows v4 |

### A.4 The five UI behaviours a judge will notice most in a 5-minute demo

The ranking reasons from the demo script in CASE_CONTEXT (evidence, jump, N/A, total, appeal, decision, recompute, criterion change) and from the vendor patterns above.

| # | Behaviour | Why a judge notices it | Vendor precedent |
| --- | --- | --- | --- |
| 1 | Click an evidence chip on a criterion → transcript scrolls to the turn and highlights it, with the speaker label | The demo script asks for exactly this. It proves the verdict is grounded, takes 2 seconds, and is visual | Amazon "directed to the point in the conversation"; Level AI quotes + timestamps |
| 2 | N/A criterion shown greyed, with the condition sentence and the effective weights of the other criteria updated | N/A redistribution is the one scoring rule judges can check by mental arithmetic; showing it removes doubt | Amazon "weights are redistributed"; Microsoft "score is calculated based only on applicable questions" |
| 3 | Serious-violation flag as a separate red banner above the total, total unchanged | Organizer rule; also matches the Microsoft "critical question" design | Microsoft critical question, NICE "Failed", EvaluAgent FAIL badge |
| 4 | Appeal → reviewer decision → the card shows Original / Decision + reason / Final, and the total recomputes live with a before→after number | It is the longest part of the script. A visible diff makes it legible in 20 seconds | Zendesk proposed "fair scores"; NICE "Updated" label; Genesys "In Review" |
| 5 | A "Run details" drawer: model id, provider (local or cloud), checklist version, latency, tokens in/out, cost, and raw JSON | It answers the validity criterion ("live model run, not replayed") without the team having to say so | Amazon pins and shows the Gen AI model version per form version |

Audio sync is not in the top five. Only 5 DEV dialogs are calls, the control set may contain none, and the only player-to-transcript sync I could verify in vendor documentation is Amazon's link from a transcript reference to a time. If the team shows a call, use one control: clicking a turn's timestamp seeks the player. Do nothing more.

## Part B. What "adaptable as a Dynamics 365 HTML component" means

### B.1 Hosting options inside Dynamics 365 Customer Service / Contact Center

Note on names: Microsoft's docs now say "Copilot Service workspace" for what was the Customer Service workspace. https://learn.microsoft.com/en-us/dynamics365/customer-service/use/csw-productivity-pane

| Option | What it is | Where it can appear | Data access | Key constraints | Source |
| --- | --- | --- | --- | --- | --- |
| HTML web resource | Static HTML/JS/CSS "virtual files" stored in Dataverse | Form control; site map; app tab via `Microsoft.Apm.createTab` with a web resource template; app side pane via `pane.navigate({pageType:"webresource"})`; `Xrm.Navigation.openWebResource` window | Same-origin Dataverse Web API; "you don't need to include any code for authentication" | No server code; fixed query params (`typename`, `type`, `id`, `orgname`, `userlcid`, `orglcid`, `data`, `formid`, `entrypoint`); the form runtime may destroy and reload the control on tab navigation; default upload limit 5 MB per file (Organization.MaxUploadFileSize); use relative paths, not `/WebResources/...`; cannot use globals from form scripts (only `parent.Xrm`) | webpage-html-web-resources, web-resources, authenticate-web-api, create-app-side-panes, createtab |
| PCF code component, standard | TypeScript control with a manifest, renders into a `div` | Bound to a form field or dataset; inside custom pages; app tab template (createSession example with `controlName`) | `context.webAPI` (createRecord, retrieveRecord, retrieveMultipleRecords, updateRecord, deleteRecord), available for "Model-driven apps & portals" | Must "bundle all the code including external library content into the primary code bundle"; must not use localStorage/sessionStorage; not supported on-premises; components that call external services directly are premium (Power Apps license); `external-service-usage` manifest element is documented "for Canvas apps" | overview, limitations, reference/webapi, external-service-usage |
| PCF code component, virtual (React platform library) | `control-type="virtual"`, `updateView` returns a ReactElement; React and Fluent are shared, not bundled | Model-driven apps (including custom pages) and canvas apps; not Power Pages | Same as PCF | React allowed version 16.14.0; loaded 17.0.2 in model-driven, 16.14.0 in canvas; Fluent 9 allowed 9.4.0 to 9.46.2, loaded 9.68.0; cannot convert an existing standard control | react-controls-platform-libraries (updated 2026-10-31) |
| Custom page | Canvas-based single-screen page inside a model-driven app | Full page, centered dialog, side dialog, app side pane; opened by `navigateTo` | Dataverse and Power Apps connectors | Low-code (Power Fx); code components in custom pages are GA; keep under 25 custom pages per app | model-app-page-overview (2026-03-13) |
| IFRAME / external website control | Form control that loads a URL; PCF IFRAME sample builds the URL from bound fields | Form | None from the host; your app calls its own API | "Web resources and Power Apps component framework don't support IFRAMEing content that's behind an authentication boundary"; Microsoft recommends PCF and custom pages instead | web-resources, sample-controls/iframe-control |
| Power Apps code app | React/Vite app hosted by Power Platform with Entra auth and connectors | Standalone app (I found no documentation of embedding inside Copilot Service workspace) | Power Platform connectors, Dataverse | End users need Power Apps Premium (or pay-as-you-go/App Pass); admin must enable code apps; no Power Platform Git integration | code-apps/overview (2026-09-23) |
| Copilot Studio agent | Conversational agent; hands off to a live representative | Chat channel in front of the representative (Bot-as-an-Agent: engagement hub in front, Copilot Studio behind via Direct Line) | Copilot Studio topics, connectors | "Handoff requires Dynamics 365 Omnichannel or another engagement hub solution"; in Bot-as-an-Agent there is "No control over user experience of responses (messages, Adaptive Cards)"; Adaptive Card support depends on client and channel. I found no documented way for an agent to host a custom HTML/React UI inside the representative's workspace | microsoft-copilot-studio/guidance/channels (2026-02-16) |
| External SPA calling Dataverse | Our app on its own domain | Outside D365, or iframed in | Dataverse Web API via CORS + MSAL.js; Entra app registration | Needs tenant registration; not "inside" D365 | oauth-cross-origin-resource-sharing-connect-single-page-application |

URLs for the table:
- https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/webpage-html-web-resources (2026-08-10)
- https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/web-resources (2026-10-30)
- https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/authenticate-web-api (2026-10-26)
- https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/clientapi/create-app-side-panes (2026-10-30)
- https://learn.microsoft.com/en-us/dynamics365/customer-service/develop/reference/methods/createtab (2025-06-17)
- https://learn.microsoft.com/en-us/power-apps/developer/component-framework/overview (2026-10-30)
- https://learn.microsoft.com/en-us/power-apps/developer/component-framework/limitations (2025-07-01)
- https://learn.microsoft.com/en-us/power-apps/developer/component-framework/reference/webapi (2022-05-27; older than 2024)
- https://learn.microsoft.com/en-us/power-apps/developer/component-framework/manifest-schema-reference/external-service-usage (2023-02-22; older than 2024)
- https://learn.microsoft.com/en-us/power-apps/developer/component-framework/react-controls-platform-libraries (2026-10-30)
- https://learn.microsoft.com/en-us/power-apps/maker/model-driven-apps/model-app-page-overview (2026-03-13)
- https://learn.microsoft.com/en-us/power-apps/developer/component-framework/sample-controls/iframe-control (2026-08-26)
- https://learn.microsoft.com/en-us/power-apps/developer/code-apps/overview (2026-09-23)
- https://learn.microsoft.com/en-us/power-apps/developer/data-platform/oauth-cross-origin-resource-sharing-connect-single-page-application (2025-03-22)
- https://learn.microsoft.com/en-us/microsoft-copilot-studio/guidance/channels (2026-02-16)

Copilot Studio is not a UI host for our component. It is the wrong target for "HTML component". The only realistic tie-in is to call our evaluator API from a Copilot Studio agent or flow as a connector, after the conversation closes. I did not research that path further.

### B.2 Constraints that matter for this team's stack

| Constraint | Fact (with source) | Effect on the React 19 + TanStack + Hono + D1 prototype |
| --- | --- | --- |
| React version | Platform library: React 16.14.0 allowed, 17.0.2 loaded in model-driven apps (react-controls-platform-libraries) | The repo pins `react: ^19.2.8` (pnpm-workspace.yaml). The virtual-PCF path is out without a downgrade. Web resource or standard PCF must bundle React 19 itself |
| Bundling | PCF must bundle all code into the primary bundle or use platform libraries (limitations) | Vite already produces a bundle; keep it to one JS and one CSS file for both web resource and PCF |
| Browser storage | PCF "should not use… window.localStorage and window.sessionStorage" (limitations) | Keep per-viewer state in memory or in the API; do not persist workspace selection in localStorage inside the component |
| Routing | A web resource lives at a URL like `<org>/WebResources/new_/test/test.htm`, and Microsoft says use relative paths (web-resources) | TanStack browser history will not match that path. Use `createHashHistory` (for servers that cannot rewrite to index.html) or `createMemoryHistory` (embedded; component should not touch the URL) https://tanstack.com/router/latest/docs/framework/react/guide/history-types |
| Parameters | Only `id`, `typename`, `data` and a few other params are accepted; invalid characters fail the request (webpage-html-web-resources) | Read the Conversation GUID from `id` and pass everything else JSON-encoded in `data` |
| Reload | "The form runtime might reload HTML web resources… destroy and reinitialize the control during tab navigation" (webpage-html-web-resources); side panes unload web resource state unless `alwaysRender` (create-app-side-panes) | All state must be refetchable from the API by conversation id; no in-memory-only drafts of appeals |
| CSP | Default model-driven CSP: `script-src * 'unsafe-inline' 'unsafe-eval' blob:`; Strict CSP: `script-src 'self' blob: <platform>`, `connect-src 'self' blob: data: wss: <platform>`; settings are per environment (content-security-policy, 2026-02-10) | Under the default, a web resource can load scripts and call our Worker. Under Strict CSP, an external evaluator API needs admin allow-listing in `connect-src`. Ship scripts as web resources, not from a CDN |
| Auth to Dataverse | No auth code is needed inside web resources, form scripts, and ribbon commands (authenticate-web-api); `Xrm.WebApi` offers create/retrieve/update/delete/execute (xrm-webapi, 2026-10-29); PCF has `context.webAPI` | Dataverse reads and writes need no MSAL inside D365. Calls to our own Hono API still need their own auth, which the prototype does not have ("No login") |
| Auth to our API from inside D365 | Not in Microsoft docs. The Worker reads the workspace from an HTTP-only cookie (repo AGENTS.md). Inside a web resource the Worker is cross-site; a cross-site cookie must be `Secure`, and CHIPS `Partitioned` cookies are Baseline 2025 https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Privacy_sandbox/Partitioned_cookies | The cookie-based workspace will likely fail in the embed. Pass the workspace or tenant as an explicit header from the adapter, or derive it from the Dataverse org |
| Conversation table customizations | You can add custom controls, web resources, and external website controls to the Conversation form, but Microsoft recommends "you don't use custom controls to update a conversation because Dynamics 365 Contact Center overwrites the updates when the conversation ends"; many `msdyn_*` columns cannot be updated (supported-customizations, 2026-02-19) | Store evaluations in our own table (or a custom Dataverse table) linked by `msdyn_ocliveworkitemid`, never in Conversation columns |
| Size | 5 MB default per uploaded file (web-resources) | Check `vite build` output size; React 19 + shadcn bundle is far below that (not measured today) |
| Licensing | Code components in model-driven apps with Dataverse need Power Apps licenses; code calling external services directly is premium (overview) | Not a blocker for a Dynamics 365 shop, but a judge may ask |

https://learn.microsoft.com/en-us/power-platform/admin/content-security-policy, https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/clientapi/reference/xrm-webapi, https://learn.microsoft.com/en-us/dynamics365/customer-service/administer/supported-customizations

### B.3 How a conversation or case record is linked

- **Contact Center chat or voice conversation:** table `msdyn_ocliveworkitem`. The Conversation form can host web resources and custom controls. You can create views, charts, and columns, but not new forms. Linking to other activity-enabled tables goes through the Regarding column. https://learn.microsoft.com/en-us/dynamics365/customer-service/administer/supported-customizations
- **Opening the component in context:**
  - A web resource on the Conversation form receives `id` (record GUID) and `typename` automatically. https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/webpage-html-web-resources
  - From a ribbon button or session script, call `Microsoft.Apm.createTab({templateName:"<custom web resource template>", appContext:new Map().set("webresourceName","new_/cqa/index.html").set("data", JSON.stringify({conversationId}))})`. https://learn.microsoft.com/en-us/dynamics365/customer-service/develop/reference/methods/createtab
  - A side pane uses `Xrm.App.sidePanes.createPane({...}).then(p => p.navigate({pageType:"webresource", webresourceName:"new_/cqa/index.html"}))`. Pages must fit "the minimum width of 300 pixels". https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/clientapi/create-app-side-panes
- **Transcript source (resolved, page dated 2026-07-31):** "Dynamics 365 Contact Center transcripts are stored in base64 encoded format in the annotations table". Each conversation gets one transcript record plus one record per attachment. Textual transcripts come from `GET [Organization URI]/api/data/v9.1/annotations?$filter=objecttypecode eq 'msdyn_transcript'`, and the `documentBody` attribute holds the base64 JSON. https://learn.microsoft.com/en-us/dynamics365/customer-service/develop/download-transcripts-bulk
  - Each message in the JSON has `content`, `createdDateTime`, `from.user.displayName` (or `from.application` for the bot/system), and `tags`.
  - Control messages carry `isControlMessage: true`. System messages are tagged `system`.
  - Messages tagged `private` pass between two representatives and are not visible to the customer.
  - This maps directly onto our `{timestamp, speaker, text}` turn format. The adapter needs a mapper:
    - drop control messages;
    - turn `system` messages into the system speaker;
    - mark `private` operator turns, the same problem as the staff consultations in our call data;
    - label bot versus operator by `from.application` versus `from.user`.
  - Gap: the page shows how to list transcripts, not how to join a transcript to one specific `msdyn_ocliveworkitem` GUID. The join key (the regarding/object id of the annotation, or a `msdyn_transcript` record linked to the conversation) is not stated there, and I did not verify it. The page also says "At least one message sent by a customer is required to generate a transcript." Voice transcripts are not covered.
- **Native QA records:** Microsoft's own evaluations use an `msdyn_evaluation` table, named in the privilege text ("Evaluation (msdyn_evaluation)"). https://learn.microsoft.com/en-us/dynamics365/contact-center/use/use-evaluations. I did not verify its columns, so do not claim we write into it.

### B.4 Option fit for a 24-hour React prototype

| Option | Effort to make real later | Honest "adaptable" claim today | Risk if a judge probes |
| --- | --- | --- | --- |
| HTML web resource (app tab or side pane) | Low: static build, hash router, adapter, upload | Yes, if the build profile exists and runs with a mock `Xrm`/`id` param | Low |
| Standard PCF wrapping the result card | Medium: manifest, `init`/`updateView`, `createRoot` into the container `div`, bundle React 19 | Yes for presentational components if they take props and do no fetching | Medium (no PCF built) |
| Virtual PCF (platform React) | High: React 16/17 compatibility | No (React 19 code) | High |
| Custom page | Medium-high: Power Fx rewrite around a PCF | Partially | Medium |
| Iframe of the Worker URL | Lowest | Weak: Microsoft discourages it, and it fails behind auth | Judge may call it "not a component" |
| Code app | Medium | Standalone only, Premium licence | Medium |

**Recommendation:** describe the target as "an HTML web resource that opens as a Copilot Service workspace app tab or side pane on a Conversation record, with presentational components ready to wrap as a standard PCF control". Do not claim PCF or Dataverse storage works today.

### B.5 What Microsoft's native Quality evaluation means for positioning

| Case requirement | D365 Quality evaluation (documented) | Our prototype |
| --- | --- | --- |
| Weighted criteria | Section weights total 100%, optional question weights | 7 scored criteria, weights total 100 |
| Scale answers (0/5/10/15/20, 0/4/7/10) | Single-select with per-option scores 0 to 100 | Native scale with weight × value / max |
| N/A redistribution | N/A questions excluded; score from applicable questions | Same rule, 2 decimals |
| Serious violations separate | Critical question fails the evaluation; "Scoring doesn't change" | c08 flag, total unchanged |
| Evidence | Evaluation Summary; knowledge-article citations for cases | Turn-level evidence with jump |
| Agent appeal + reviewer decision + original/final | Not documented; managers can edit submitted evaluations | Implemented |
| Change a criterion and re-run | Edit, publish new version, simulation on 25 records | Checklist revisions + re-run |
| Languages | Language set per criteria, not changeable after save; results in that language | RU/KZ/EN dialogs |
| Bot turns | "Participant evaluated": Entire record / Current owner / IVR/Bot | Must exclude bot AIM turns from operator criteria |

Source: https://learn.microsoft.com/en-us/dynamics365/contact-center/use/evaluation-criteria, https://learn.microsoft.com/en-us/dynamics365/contact-center/use/evaluation-plan, https://learn.microsoft.com/en-us/dynamics365/contact-center/use/use-evaluations. Closeness: High. Borrow in 24 h:
- Name the bot-turn rule in the UI as "Participant evaluated: operator only".
- Add a "Simulate on N dialogs" action to the checklist editor before saving a new revision. It reuses the existing evaluation loop on a sample and does not write results.

I did not find which languages the Microsoft criteria support, so I do not know whether Kazakh is among them. Do not claim it is unsupported.

### B.6 Minimal concrete changes that make "adaptable" true

These are suggestions for the team. I did not change any code.

1. **One data-access interface.** Define `CqaDataSource` in `packages/contracts` (or `apps/web/src/lib`): `getConversation(id)`, `getChecklist(version?)`, `evaluate(conversationId, checklistVersion)`, `listEvaluations(conversationId)`, `createAppeal(...)`, `decideAppeal(...)`. Ship `HonoDataSource` (wraps the current `hc<AppType>` client in `apps/web/src/lib/api.ts`) and a `DataverseDataSource` stub. The stub's comments show where `Xrm.WebApi.retrieveRecord("msdyn_ocliveworkitem", id)` and the transcript loader would go. Components get the data source from a React context, never from `api` directly.
2. **Host context.** Add a `HostContext` with `{ conversationId, userLcid, theme, mode: "standalone" | "d365-webresource" }`. Fill it from the URL params `id`/`data`/`userlcid` when embedded, and from the router otherwise.
3. **Router.** Choose history at boot: browser history standalone, `createHashHistory()` (or memory history) when `mode === "d365-webresource"`.
4. **Presentational split.** `EvaluationResult`, `CriterionCard`, `TranscriptView` (with `highlightTurn`), `AppealPanel`, `ScoreSummary`. Each takes data and callbacks as props and does no fetching or routing. Containers do the TanStack Query work. These leaf components are what a standard PCF `updateView` would render.
5. **No cookie dependency inside the embed.** Send workspace/tenant as an explicit header from the data source. Today the API reads an HTTP-only cookie, which is cross-site in D365.
6. **Static build profile.** `vite build --base ./` (relative assets), one JS and one CSS file with stable names, and no CDN fonts or scripts. Document the web resource names: `new_/cqa/index.html`, `new_/cqa/app.js`, `new_/cqa/app.css`.
7. **Layout.** The evaluation card must work at 300 px (side pane minimum) and in a full app tab. Transcript and criteria stack vertically below roughly 640 px.
8. **Demo proof (optional, about 1 h).** A `/embed.html?id=<conversation>` page that boots in `d365-webresource` mode with a fake `parent.Xrm` object and hash routing. Show it in a 300 px-wide frame for 10 seconds.

### B.7 Questions a Freedom Broker (Dynamics 365) judge is likely to ask

| Question | Short honest answer (from the findings above) |
| --- | --- |
| Is this a PCF control or a web resource? | The target is an HTML web resource for app tab or side pane; leaf components are PCF-ready. Not packaged yet |
| Which React version, and does it conflict with the platform? | React 19, bundled; we do not use the platform library (16.14/17.0.2) |
| Where are evaluations stored when inside D365? | Today D1. In D365, a custom Dataverse table linked to `msdyn_ocliveworkitem`, never Conversation columns (Microsoft warns updates are overwritten) |
| How does it authenticate? | Inside D365, Dataverse calls need no auth code; our evaluator API would need Entra auth or a server-side connector. Not built |
| Will it pass our CSP? | Default CSP allows it; Strict CSP needs our API host in `connect-src` |
| Why not just use Microsoft's Quality evaluation? | Same scoring model; we add agent appeal with original/decision/final, turn-level evidence, RU/KZ checks, and a choice of local or cloud model |
| How do you pick up the conversation id? | The `id` query parameter the platform passes, or `data` via `Microsoft.Apm.createTab` |
| What does one evaluation cost and how long does it take? | Show it in the run drawer (Part C) |

## Part C. Demo tactics

Sources are thin and mostly generic. I found no write-up from a winning team in an enterprise AI evaluation hackathon (see Negative results).

| Tactic | Evidence | Applied to this case |
| --- | --- | --- |
| Name the model and how you evaluated it, because a bare "we used an LLM" cannot be scored (paraphrase of tip 4) | AngelHack, last updated 2026-08-25 https://angelhack.com/blog/10-tips-to-help-you-rock-your-next-hackathon-demo/ | Run drawer shows model id and provider; one slide or tab with per-criterion agreement on labeled DEV |
| Prepare for "what's real versus mocked" | Same page, tip 9 | Live-run proof: paste or select an unseen dialog, press Evaluate, show latency counter, tokens, raw JSON response, and the checklist version hash in the prompt |
| Keep a recorded backup demo | Same page, tip 10 | Record the full 5-minute flow once; switch only if the API fails |
| One standout moment | Same page, tip 7 | The appeal → decision → total recomputes from X to Y |
| Jury may include non-developers; open with the customer's benefit | Habr, 2022-02-16 (older than 2024) https://habr.com/ru/post/651695 | First 20 seconds: "every chat scored in N seconds with the exact turn as proof" |

How to show calibration without losing time: one static table, prepared in advance. The rows are the 8 criteria. The columns are agreement % on the 6 held-out DEV dialogs, with N/A agreement and flag agreement as separate rows, plus a line at the 80% target Genesys uses. https://help.genesys.cloud/399798. Spend 15 seconds on it. Do not run calibration live.

How to show the model really evaluated a new input:
1. Edit one word in a transcript turn, or use the organizer's criterion-change task.
2. Re-run and show the changed verdict, with the new evidence turn highlighted.
3. Show the run id, timestamp, and token count, which differ from the previous run.

This is my reasoning, not a sourced practice. It directly addresses the organizers' "validity" rule in CASE_CONTEXT.

Closeness of Part C sources: Low, because the sources are generic hackathon advice, not about enterprise AI evaluation. Borrow in 24 h: the run drawer and the recorded backup.

## Relation to RESEARCH_BRIEF.md

- **Extends:** the Amazon Connect entry, with the appeals workflow (2026-02-03), model version pinning, two-stage validation, and the "AI selects Not Applicable when unsure" behaviour. The behaviour is a risk to design against, not a feature to copy.
- **New:** Microsoft's native Quality evaluation and its scoring formulas. The brief did not mention any Microsoft product.
- **Agrees, with a source:** the brief's "needs review" queue and calibration page. Genesys documents per-question agreement scores, a 20-interaction test, and an 80% target.
- **Corrects:** nothing in the brief contradicts these findings. The brief's UI advice assumed a standalone app; Part B adds the embedding constraints.

## Negative results

| Searched for | Result |
| --- | --- |
| MaestroQA help pages (appeals, rubric structure) | HTTP 401 to fetcher; snippets only |
| Scorebuddy help pages (N/A, AI score log, appeals) | Socket closed twice; no appeals article found in search |
| Playvox help center (disputes, calibration) | No official pages found; only G2/Capterra reviews; help.voxjar.com is a different vendor |
| EvaluAgent help center on disputes | None found; product page only |
| Observe.AI documentation (not marketing) on evidence/disputes | None found |
| Level AI help center on auto-fail | None found |
| Microsoft doc on an agent-side dispute of a Quality evaluation | None found; only manager edit of submitted evaluations |
| Microsoft doc on embedding a Power Apps code app inside Copilot Service workspace | Not found |
| Microsoft doc for reading a Contact Center transcript from Dataverse | Found (annotations, `objecttypecode eq 'msdyn_transcript'`); the per-conversation join key and voice transcripts were not found |
| Copilot Studio hosting a custom HTML/React UI inside the representative workspace | Not found; only channel and handoff patterns |
| Supported languages of Microsoft Quality evaluation criteria (Kazakh?) | Not found |
| Customer Service session/tab overview page (`develop/session-tab-management-apis`) | 404; used the `createTab` reference instead |
| Client scripting best-practices page | 404 at the URL tried |
| Winning-team write-ups from enterprise AI evaluation hackathons (EN, RU) | None found; only generic tips |
| JetBrains "How to win a hackathon: notes from the judging table" (2026-06) | HTTP 403 |
| Audio player / transcript sync in vendor docs other than Amazon | Not found in fetched pages |

## Sources

- https://learn.microsoft.com/en-us/power-apps/developer/component-framework/react-controls-platform-libraries
- https://learn.microsoft.com/en-us/power-apps/developer/component-framework/limitations
- https://learn.microsoft.com/en-us/power-apps/developer/component-framework/overview
- https://learn.microsoft.com/en-us/power-apps/developer/component-framework/reference/webapi
- https://learn.microsoft.com/en-us/power-apps/developer/component-framework/manifest-schema-reference/external-service-usage
- https://learn.microsoft.com/en-us/power-apps/developer/component-framework/sample-controls/iframe-control
- https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/webpage-html-web-resources
- https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/web-resources
- https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/clientapi/create-app-side-panes
- https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/clientapi/reference/xrm-webapi
- https://learn.microsoft.com/en-us/power-apps/maker/model-driven-apps/model-app-page-overview
- https://learn.microsoft.com/en-us/power-apps/developer/code-apps/overview
- https://learn.microsoft.com/en-us/power-apps/developer/data-platform/oauth-cross-origin-resource-sharing-connect-single-page-application
- https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/authenticate-web-api
- https://learn.microsoft.com/en-us/power-platform/admin/content-security-policy
- https://learn.microsoft.com/en-us/dynamics365/customer-service/develop/reference/methods/createtab
- https://learn.microsoft.com/en-us/dynamics365/customer-service/administer/supported-customizations
- https://learn.microsoft.com/en-us/dynamics365/customer-service/use/csw-productivity-pane
- https://learn.microsoft.com/en-us/dynamics365/customer-service/develop/download-transcripts-bulk
- https://learn.microsoft.com/en-us/microsoft-copilot-studio/guidance/channels
- https://learn.microsoft.com/en-us/dynamics365/contact-center/use/evaluation-criteria
- https://learn.microsoft.com/en-us/dynamics365/contact-center/use/evaluation-plan
- https://learn.microsoft.com/en-us/dynamics365/contact-center/use/use-evaluations
- https://learn.microsoft.com/en-us/dynamics365/guidance/agent-templates/service-quality-evaluation-agent
- https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Privacy_sandbox/Partitioned_cookies
- https://tanstack.com/router/latest/docs/framework/react/guide/history-types
- https://docs.aws.amazon.com/connect/latest/adminguide/create-evaluation-forms.html
- https://docs.aws.amazon.com/connect/latest/adminguide/generative-ai-performance-evaluations.html
- https://docs.aws.amazon.com/connect/latest/adminguide/calibrations-performance-evaluations.html
- https://aws.amazon.com/about-aws/whats-new/2026/01/amazon-connect-appeals-workflow-agent-performance-evaluations
- https://support.zendesk.com/hc/en-us/articles/7043760048922-Disputing-a-review
- https://support.zendesk.com/hc/en-us/articles/10727979177498
- https://help.genesys.cloud/articles/manage-disputed-evaluations/
- https://help.genesys.cloud/399798
- https://help.nicecxone.com/Content/myzone/viewingyourevaluations.htm
- https://help.nicecxone.com/Content/qmanalytics/calibration/calibrateformsandevaluations.htm
- https://thelevel.ai/product/quality-assurance-contact-center
- https://observe.ai/platform/auto-qa
- https://www.evaluagent.com/auto-quality-assurance/
- https://angelhack.com/blog/10-tips-to-help-you-rock-your-next-hackathon-demo/
- https://habr.com/ru/post/651695

## Confidence

**Part B is reliable.** Every Microsoft claim comes from a Learn page fetched today, most updated between August and October 2026. The React platform-library versions, CSP defaults, web resource parameters, and Quality evaluation scoring formulas are quoted from those pages. Two Learn pages are older than 2024: the PCF WebAPI reference (2022) and external-service-usage (2023). Weaker points:
- The cookie problem inside the embed is my inference from the repo's AGENTS.md and the MDN page, not tested.
- The transcript storage is documented: annotations with `objecttypecode 'msdyn_transcript'`, base64 JSON in `documentBody`. **The Part B recommendation still depends on one unresolved data path:** how to fetch the transcript for a single conversation GUID, and how voice transcripts are stored. Until that is verified, describe the Dataverse adapter as "designed", not "working".
- I did not verify which languages Microsoft's Quality evaluation supports.

**Part A is reliable for Amazon, Microsoft, Zendesk, Genesys, and NICE,** whose official help pages I fetched (Genesys and NICE pages carry no date). Level AI, Observe.AI, and EvaluAgent are vendor marketing; their numbers are self-reported and nothing there shows the UI in screenshots I could inspect. MaestroQA, Scorebuddy, and Playvox are effectively unverified. The fetcher was blocked, so their table cells rest on search snippets or are empty.

**Part C is weak.** The sources are generic and the newest is a blog post. The five-behaviour ranking in A.4 is my judgement from the case's demo script and vendor patterns, not a measured result.
