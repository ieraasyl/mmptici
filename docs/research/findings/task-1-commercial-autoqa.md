# Task 1: Commercial contact-center auto-QA products

Date of research: 2026-11-07. Product facts come from pages fetched during this session, except where marked "not fetched" or "search summary" (a search-engine summary that was not confirmed on the page). The fetch tool returns summaries, so quotes are as that tool returned them. Vendor numbers are self-reported. Dates are the page's `ms.date`, publication date, or footer date where one was visible; "no date" means none was shown.

## How this extends RESEARCH_BRIEF.md

| Brief said | This file | Relation |
| --- | --- | --- |
| Google Quality AI: "documentation URL moved; nothing verifiable retrieved" | Quality AI docs fetched: N/A excluded from score, calibration needs at least 100 examples per question and 40 per answer, Cohen's kappa of at least 0.2 between annotators, Russian supported, Kazakh not | Extends |
| Amazon Connect: "up to 10 AI-answered questions per contact" | Correct for auto-submit. The current page allows Ask AI on up to 30 questions per contact. It also documents proportional N/A weight redistribution, matching the case formula exactly, and a review-request (appeal) workflow launched early 2026 | Extends, minor correction |
| Amazon Connect languages not covered | Form language list: English, Spanish, Portuguese, French, German, Italian, Chinese, Japanese, Korean, Malay. Russian and Kazakh are not on it | New |
| Microsoft Dynamics 365 not covered | Dynamics 365 Contact Center has a Quality Evaluation Agent with sections, weights, N/A, critical questions that fail the evaluation without changing the score, versioned criteria, and simulations. This is the closest product to the case | New |
| Level AI: >90% agreement, quotes per score | Product page fetched: timestamps and conversation quotes per answer, hybrid AI and human scorecards, N/A through conditional logic. Still no methodology for accuracy | Extends |
| "Empathy-type questions are the acknowledged weak spot" | Confirmed. AWS, Google, and Genesys advise against subjective or tone questions in their docs (Genesys: best-practices page, see Genesys section) | Confirms |

## Product overview

| Product | Closeness | Question in natural language | N/A excluded from total | Auto-fail | Evidence per answer | Appeal workflow | Russian | Kazakh | Public price | UI for a scored conversation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Microsoft Dynamics 365 Contact Center, Quality Evaluation Agent | High | Yes, with criteria-, question-, and answer-level instructions | Yes | "Critical question": evaluation fails, score unchanged | Evaluation summary; per-question evidence not described | Edit after submit (privilege); no agent appeal documented | Language picker exists; list not found | Not found | Not found (Copilot credits) | Side pane: summary, suggested actions, total score and ratio, critical-failure markers |
| Amazon Connect Contact Lens | High | Yes, title plus "instructions to evaluators" | Yes, weight redistributed proportionally | Yes: score of the chosen scope (section, subsection, or form) set to zero | Justification plus transcript references with timestamps | Yes, review requests (early 2026) | Not in form-language list | No | $12.00 per agent evaluated per month | Ask AI per question; transcript reference timestamps jump to the moment |
| Genesys Cloud AI Scoring | High | Yes, question plus help text | N/A when no evidence; scoring treatment not stated on fetched pages | Not stated on fetched pages | "Detailed answer explanations" | Yes, disputes, rescore or decline | Not listed | Not listed | Not found (AI Experience Tokens) | Explanations per answer; low-confidence warning hides AI answer |
| Google CX Insights Quality AI | High | Yes, question plus instructions plus example conversations | Yes | Not documented | Not documented on fetched pages | Manual edit only | Yes | No | Not found | Score per scorecard on Conversations page; icon on manually edited answers |
| Zendesk QA AutoQA | Medium | Prompt-based custom categories (up to 10 active, search summary) | N/A when evidence insufficient | "Criticality" setting, not explained | Step-by-step reasoning and evidence (EAP, May 2026) | Yes, disputes with proposed per-category scores | "All" with LLM mode on | "All" with LLM mode on, not tested | Not found | Click a category score to expand reasoning and evidence |
| Calabrio Auto QM | Medium | Yes, question plus option descriptions plus examples | Yes, "Ignore" redistributes within section | "KPI failure" sets section or form to 0 | Not described | Not on fetched pages | Not listed | Not listed | Not found | Not described |
| Webex AI Quality Management | Medium | Yes, plus "N/A context" per question | Yes | Section below threshold fails; one failed section fails the evaluation | AI justification per answer | Supervisor override | Not listed | Not listed | Not found | Alert icon with threshold and actual score; Test Question pop-up with transcript and justification |
| Kore.ai Quality AI | Medium | GenAI "By Question" metrics | Configurable: exclude, or award full weight | "Fatal error" sets score to 0 | AI justification | Not on fetched page | Per-metric language list | Not checked | Not found | Not described |
| Yandex SpeechSense | Medium | Semantic tags and AI assistants by instruction | Not documented | Not documented | Not documented | Not documented | Yes | Yes, since March 2025 | Yes, per 1,000 characters (see section) | Dialog card with talk metrics and summary; like/dislike on answers |
| Level AI QA-GPT | Medium | Yes, "just type your questions" | Through conditional logic | Not stated | Timestamps and quotes | Listed, not described | Not stated | Not stated | Not found | Suggested answers with timestamps and quotes |
| Balto QA Copilot | Medium | Plain-English criteria | Supervisor can set N/A | Auto-fail flags drafted by AI | Recording, transcript, failed criterion, moment | Dispute and overturn rates tracked | Not stated | Not stated | Not found | Drill-in to the moment a criterion failed |
| Talkdesk QM Assist | Medium (unverified) | Per-question GenAI mode | Not fetched | Not fetched | Time-stamped annotations (search summary only) | Not fetched | Not fetched | Not fetched | Not fetched | Not fetched |
| NICE CXone Auto Score | Low | Not documented publicly | Not documented | "Critical questions" on scorecards | Not documented | Not documented | Not documented | Not documented | Not found (paid add-on) | Not described |
| Verint Quality Bot | Low | Evaluation questions; GenAI "refine[s]" the form | Not documented | Not documented | Not documented | Not documented | Not documented | Not documented | Not found | Not described |
| Observe.AI Auto QA | Low | Drag-and-drop rules, keywords, "advanced logic" | Not documented | Not documented | "Evidence" claimed, not described | "Dispute options" | Not documented | Not documented | Not found | Not described |
| Cresta QM | Low | "Custom-trained AI", not described | Not documented | Not documented | Not described | "Appeals" listed | Not documented | Not documented | Not found | Not described |
| Rippit (formerly MaestroQA) | Low | Existing rubric | Not documented | Not documented | Failing score links to lines | Recommended | Not documented | Not documented | Not found | Failing score links to conversation lines |
| Five9 Agentic QM | Low | GenAI prompts referencing policy documents | Not documented | Not documented | "Evidence-based", not described | Agent disputes from desktop | Not documented | Not documented | Not found | Not described |
| EvaluAgent AutoQM | Low | Policies "in plain language" | Not documented | Configurable auto-fail | "Tied to evidence", not described | Agent disputes | Not documented | Not documented | Not found | Sample scorecard with score, auto-fail count, PASS/FAIL |
| Sprinklr QM | Low | Not described | Not documented | Not documented | AI score shown beside conversation | Dispute flow for manual evaluations | Not documented | Not documented | Not found | Conversation, case info, AI scoring on one screen |
| Convin | Low | Custom parameters (search summary) | Not documented | Not documented | Not documented | Supervisor override | Not documented | Not documented | Not found | Not described |
| Scorebuddy | Low | Not fetched (help pages failed) | Not fetched | Not fetched | Not fetched | Not fetched | Not fetched | Not fetched | Credits per interaction (search summary only) | Not fetched |
| Salesforce | Low | No human-agent auto-QA scorecard docs found | Not found | Not found | Not found | Not found | Not found | Not found | Not found | Not found |

Public per-evaluation or per-agent prices were found only for AWS and Yandex. UI details are recorded only where a fetched page describes them.

## Products with High closeness

### Microsoft Dynamics 365 Contact Center / Customer Service: Quality Evaluation Agent

The case's UI must later run as a Dynamics 365 HTML component, and Microsoft now ships its own AI QA inside Dynamics 365. The organizers are likely to compare our prototype against it. All pages below are Microsoft Learn, `ms.date` 2026-10-07 to 2026-10-23.

**Question definition** (evaluation-criteria page):
- Answer types: Yes/No, Multi-select, Single-select, Descriptive.
- Instructions at three levels: criteria (form), question, and answer option. Limits: "Instructions 2,000 characters", "Question text 300 characters", "Option text 100 characters", 50 questions per criteria.
- Scoring: sections carry percentage weights that must total 100%. Optional question-level weights inside a section. "Each question is scored on a scale of 0 to 100." Single-select options get scores of 0 to 100 that need not sum to 100. Multi-select options must total 100, with no penalties. Descriptive questions are not scored.
- N/A: "Allow Not Applicable responses ... the question is excluded from the evaluation score. The score is calculated based only on applicable questions."
- Critical questions: "If a critical question is answered with a fail option, the entire evaluation or simulation fails ... Scoring doesn't change when a critical question causes an evaluation to fail." The failure appears in the Evaluation Summary, in the side panel per question, and as a column in the evaluations grid. This matches the case rule that serious violations are a separate flag and do not change the total.
- Language: picked per criteria and fixed after save. "Evaluation results are returned in the same language." Recommended size limits per language: 90,000 characters for most, 60,000 for Arabic, 30,000 for "languages with higher token expansion". The list of supported languages was not found.
- Versioning: "Each edit and publish action increments the evaluation criteria version." Prior versions can be restored. Running plans keep the old version until their next run.
- Simulation: run draft or published criteria on "the 25 most recent records that match the selected conditions". The results do not affect records. Each simulation consumes Copilot credits.
- Knowledge grounding: one knowledge article per criteria, linked to at most two questions. The agent "cites the reasoning from the knowledge article sources".
- Best-practice text the team can reuse in prompts: "Put exclusion rules first", "Specify the exact data source ... Based only on [specific record type] from [specific actor]", "Require evidence from the source".

**How the AI answers:**
- Two modes. "AI agent mode: All questions must be AI-enabled. Manual editing isn't allowed." "AI assisted mode: At least one question must be AI-enabled."
- "Participant evaluated" can be Entire record, Current owner, or IVR/Bot. Bot turns can therefore be excluded from operator scoring, which our chats need: they have a bot "AIM" before the operator. The evaluation-plan page says this option "is available only for trigger-based evaluation plans". The on-demand page also lists it for closed conversations.
- Whether the agent makes one call per question or per form is not documented.

**Output and UI** (use-evaluations page): an Evaluation Summary with suggested actions, and a Scoring overview with "Total score" and "Scoring ratio". The evaluation-plan page adds a score breakdown with "question weights and their contribution to the overall score". Per-question quotes or jump-to-turn are not described.

**Disputes and edits:** a submitted evaluation can be edited by Quality Admin, Quality Manager, or the "Override Submitted evaluation" privilege. The summary is regenerated on resubmission. There is no agent-facing appeal on the fetched pages, and the pages do not say whether the original AI answer is kept after an edit.

**Pricing:** Copilot credits; no per-evaluation rate was found. The Message Center notice MC1443023 (published 2026-07-30) promises language support for quality evaluations, GA 2026-08-31, without naming languages.

**Closeness: High.** It has the same object model as the case (weighted criteria, N/A excluded, a critical flag that leaves the score alone, versions), it lives in Dynamics 365, and its multilingual output setting matches the RU/KZ/EN need. It is weaker than the case on per-criterion evidence and on an appeal record that keeps the original.
Borrow in 24 h: name the violation criterion a "critical question" and show "failed due to critical question" as a badge and grid column without touching the score. Add a "participant evaluated: operator only, ignore bot" setting. Use criteria/question/answer instruction levels in the editor. Show a score breakdown with each criterion's weight and contribution.

### Amazon Connect Contact Lens (generative AI performance evaluations)

**Question definition:** "Evaluations questions are answered using generative AI by interpreting the question title and evaluation criteria specified within the instructions to evaluators." Questions can be conditionally enabled. Answer types include single-select and Number. AWS advises "simple, short answer options, such as Yes, No, and Partial" and warns against "too many answer options".

**Scoring** (about-scoring-and-weights page):
- Weights by section or by question; the total must equal 100%.
- N/A: "Questions that are answered as Not Applicable do not count toward the form's final score. Their weight is redistributed proportionally among the remaining questions." Worked example: weights 40/20/20/20, Q4 marked N/A, new weights 50/25/25, score 75% instead of 60%. This is the case's formula.
- Automatic fail (create-evaluation-forms page, Step 5.1): "You can choose to apply automatic fail to the section, the subsection, or the entire form. When the evaluator selects this answer during an evaluation, the score for the affected scope is set to zero." In point-based mode (Step 5.2) auto-fail applies only to the section or the entire form; there is no subsection option. The guidelines page warns: "Give auto-fail questions the most attention, since one failing answer affects the whole form's evaluation score."

**How the AI answers:**
- Ask AI returns an answer "along with context and justification (reference points from the transcript that were used to provide answers)". "You can choose the time associated with a transcript reference to be directed to the point in the conversation."
- Limits: Ask AI on up to 30 questions per contact; auto-submit up to 10 generative questions per contact.
- Failure mode: "If AI is not able to identify which of the provided answer options is appropriate, then it selects Not Applicable, even if the question is not optional." The weight is then redistributed. Our scorer should guard against this: a model "N/A" on a criterion that has no N/A option must not silently drop weight.
- Things AWS says not to automate: questions needing data outside the transcript, quantifiable activity such as hold time (use metrics), multi-party questions, tone of voice, and "highly subjective questions, such as 'Was the agent attentive during the call?'"
- Phrasing rules: complete sentences, "agent" and "customer" used consistently, positive phrasing, "Specify when the answer is Not Applicable", explain every option, say whether all or any of several behaviours are required, avoid exact quoted scripts.
- Form linting (create-evaluation-forms page, Step 9): "Save and validate" checks each generative question against best practices. Examples: a title ending in a question mark, instructions present, short answer labels, "Positive action framing", answerable from the transcript, no audio-only cues. Limits: 3 parallel and 30 per hour.
- Forms default to the latest model version; a specific version can be pinned per form version (falls back to latest at end of life). The model-version table on the same page says the newer versions are less strict "where earlier versions were too harsh, improving agreement with human evaluators on borderline answers" (in-Region 2026-10-08).
- Languages: the form language can be set to English, Spanish, Portuguese, French, German, Italian, Chinese, Japanese, Korean, or Malay. Without it, "answer justifications are typically provided in English." Cross-language evaluation is supported, for example an English form over a Spanish transcript. Russian and Kazakh are not listed.

**Appeals** (evaluation-review-requests page; the launch announcement is dated 2026-01):
- The form option "Allow review requests" sets a time window from the original submission and lists the email recipients.
- The requester must explain why ("you cannot leave this blank").
- Statuses: "Review requested", then "Under review". "The original evaluation is listed under Under review and can be viewed", while "The in-progress review is listed under Evaluation reviews". Reviewers change answers or add notes "that justify the original evaluation", then "Resolve review".
- An audit trail for re-submitted evaluations was announced in 2024 (not fetched; see Sources).
- This is the closest documented match to the case's rule: keep the original, the decision, and the final result.

**Pricing** (Connect pricing appendix): $12.00 per agent evaluated per month for performance evaluations. Conversational analytics: $0.0015 per chat message, $0.015 per voice minute (first-tier rate for the first 5 million minutes; $0.0125 above that). No separate generative-evaluation line appears.

**Closeness: High.** Same N/A arithmetic, auto-fail levels, transcript-referenced justifications, and an appeal flow that keeps the original. It does not support Russian or Kazakh forms, and AWS auto-fail sets the chosen scope's score to zero, where the case keeps violations off the total.
Borrow in 24 h: copy the AWS phrasing rules into the criterion-editor help text and prompt template, and run them as a lint on save, as Step 9 does. Add a guard: if the model returns N/A for a criterion without N/A, retry or mark it "needs review" instead of redistributing. Use AWS's appeal states (Requested, Under review, Resolved) with the original evaluation shown read-only beside the review.

### Genesys Cloud AI Scoring (Virtual Supervisor)

**Question definition** (automated-scoring-options page, no date, footer 2026):
- Per question: No Automation, AI Scoring, or Evaluation Assistance (topic and phrase conditions).
- "You cannot save an AI scoring configuration for questions that have more than five answer options."
- Character limits: question 500, help text 6,000, answer 500.
- Minimum transcript of 300 characters. The FAQ adds a runtime limit of 80,000 characters for transcript plus form.

**How the AI answers:**
- Best-practices page: "AI Scoring evaluates interactions only from the conversation transcript and the evaluation form"; "The AI model can't infer intent. It must find direct, measurable evidence in the transcript." The same page lists subjective questions (for example, whether the agent was polite) and questions about tone, attitude, or emotion as things to avoid.
- Gives "detailed answer explanations". When it cannot answer (N/A or no evidence), "Genesys Cloud displays the context".
- The FAQ: "AI Scoring requires an exact text match between its response and the form's answer options." A mismatch yields the default answer or a low-confidence error.
- Agent Auto-Evaluation forms auto-submit as evaluator "Virtual Supervisor". Every question needs a default answer, used when the interaction is "low accuracy" or "the model confidence score is below 70%".

**Calibration (strongest documented):**
- An agreement score per question and per form. FAQ colour bands: red 0–59%, yellow 60–79%, green 80–100%. The best-practices page recommends at least 80% agreement, tested on at least 20 interactions.
- A historical accuracy filter: "rolling window of the 25 most recent submissions per question". Below 75%, "the question is flagged with a low-confidence warning" and the AI answer is hidden until accuracy recovers. History resets when the form is republished.
- Agreement is not supported for multi-select questions.
- Limits (best-practices page): 50 AI scoring requests per agent per day. The FAQ says the 50-per-day limit can be raised to 100 or 200 per customer through a support ticket.
- Charges apply whenever a form with an AI question is used.

**Disputes** (manage-disputed-evaluations page):
- Agents dispute released evaluations within 45 days; a Comment field carries the reason.
- The state moves to "In Review". The assignee rescores (needs Edit permission) or declines (needs Decline permission).
- Comment limit 5,000 characters.
- The page does not say whether the original score is kept, or whether a dispute can target a single question.

**Languages:** the reasoning text language comes from the form dialect, else the detected language, else the conversation language. No language list was found.

**Closeness: High.** It is the most complete public description of human-vs-AI agreement tracking and auto-suppressing unreliable questions. Its evidence display is less specific than AWS.
Borrow in 24 h: a per-criterion agreement table on the labelled DEV dialogs with the same red/yellow/green bands (below 60, 60–79, 80+). Enforce exact-match answer validation in code and retry on mismatch. Add a confidence or "abstain" path that routes to review instead of guessing.

### Google Cloud Customer Experience Insights: Quality AI

**Question definition** (qai-basics and qai-best-practices; no dates):
- Answer types: Yes/No ("Did..."), Number, Text. Each answer choice has a score; "A question's maximum score is set by its highest-scoring choice."
- Optional tags (business, customer, compliance) get their own scores.
- Predefined questions (conversation outcome, escalation initiator, agent helpfulness) cannot be edited.

**Scoring:** "Any question assigned an N/A response is removed from this conversation score calculation." Score = points received ÷ maximum possible points. There are no separate weights; the point values act as weights.

**Calibration and accuracy:**
- Example conversations are uploaded as CSV (ConversationId, QaScorecardId, QaQuestionId, QaAnswerLabel or Value).
- Volumes: "at least 100 example conversations per question", "at least 40 example conversations per answer choice", "at least 2,000 conversations for each business unit".
- Without examples it falls back to a "foundational model".
- Manually corrected answers become examples automatically. Editing a scorecard requires recalibration (search summary of the setup guide; not fetched).
- Inter-annotator agreement should be measured with Cohen's kappa, "no less than 0.2". No model accuracy figure is published.

**Cautions:** exclude acoustic or tone questions. The page lists subjective questions that annotators may read differently, vague rubrics, and mixed answer schemes as problems, and asks for instructions that "leave no room for interpretation".

**Languages** (languages page): Russian row "ru | Yes | | Yes | Yes | | Yes | Yes", which includes the Quality AI column. Kazakh row "kk | Yes" covers Store/Import only.

**UI:** per-conversation scores per scorecard; manually updated answers get "a visual icon". Evidence quotes are not described on the fetched pages.

**Closeness: High** on the scoring model and on Russian support. It is weaker on evidence and disputes, and its calibration volume (100 examples per question) is far beyond a 24-hour team.
Borrow in 24 h: the CSV label format (conversation_id, criterion_id, answer) for the team's 20 labelled dialogs. A visible "edited by human" icon on overridden criteria. Few-shot examples per answer option inside the criterion definition. Note Google's kappa floor of 0.2 is for annotators, not the model.

## Products with Medium closeness

### Zendesk QA (formerly Klaus): AutoQA

- Eight system categories: Greeting, Empathy, Spelling and grammar, Closing, Solution offered, Tone, Readability, Comprehension. Scales are binary, 3-point, or 5-point; Solution offered is "Binary, or N/A if not sure".
- With LLM-based AutoQA on, Greeting, Empathy, Closing, Solution offered, Tone, and Comprehension support "All" languages. Spelling and grammar covers EN/DE/FR/PL/ES/PT/NL only.
- Custom AI prompt-based categories, at most 10 active per account (search summary of the creation article; that article was not fetched).
- N/A: "AutoQA may also return 'N/A' for certain categories when there is insufficient information." Weights and root causes "apply only to manual reviews", so AutoQA scores ignore weights.
- Accuracy metric: binary agreement is 100% or 0%. On the 5-point scale each point of difference costs 25 percentage points. "AutoQA doesn't learn directly from your feedback." Autoscores cannot be changed; a reviewer submits a different rating instead.
- Deep evaluation and validation (EAP, announced 2026-05-14): shows "step-by-step evaluation logic", "the specific evidence it identified", and, for N/A, why the category was not applicable. Voice is not yet eligible.
- Disputes: "Including a comment is mandatory, but you can also propose new scores for specific categories." The dispute goes back to the original reviewer or is escalated; "There is no limit to the number of disputes for a review."

**Closeness: Medium.** Its per-category reasoning, evidence, and N/A explanation match the case's evidence rules. Weights don't apply to AutoQA, and its categories are mostly fixed.
Borrow in 24 h: an appeal form where the user proposes a new answer per criterion and must write a comment. An N/A explanation sentence stored alongside each N/A ("which condition applies"). The 25-points-per-step agreement metric for scale criteria.

### Calabrio ONE Auto QM

- Advice page: "Did the agent..." yes/no questions "typically provide the most consistent results". "Avoid creating scales with more than five points." Option descriptions must "precisely articulate what conditions must be present". Option examples are optional snippets.
- N/A scored as "Ignore" removes the question and redistributes points "to other questions in the same section".
- Form manager: up to 6 sections, 5 questions per section, 25 questions. Form description and additional AI instructions 3,000 characters each; option description 500 characters.
- "KPI failure" at Form or Section level: answers "automatically fail the section or form and will be assigned a score of zero".
- "You cannot edit a published form." At most three forms per contact.
- Intelligent Phrase Matching (AI Match up to 10 phrases, Exact Match up to 50) answers No when no phrase is present.
- Custom Metadata questions are answered without AI; a blank field gives N/A.

**Closeness: Medium.** It has the same weighted, N/A-aware form, but evidence and appeals are not documented, and auto-fail zeroes the score.
Borrow in 24 h: deterministic sub-checks next to the LLM. The case's system events ("Connection to customer lost", "Оператор закрыл чат", identity check events) can drive N/A or evidence for Closing and Verification without a model call.

### Webex AI Quality Management (Cisco)

Article dated 2026-07-23.
- Question types: Yes/No, Scale, Single select. An N/A option has an "N/A context", for example "Use N/A if the interaction is not about credit card", which can be generated with "Suggest N/A context". N/A answers are excluded from the total possible score.
- Score = "(earned score × 100) / total possible score".
- Section "Autofail Threshold": one failed section fails the evaluation.
- A "Test Question" pop-up shows the recording, transcript, AI-suggested answer, and justification, plus a summary across several interactions and suggested wording improvements.

**Closeness: Medium.** The N/A-context field and the test-question loop are close to the case's "replace a criterion and re-run" check.
Borrow in 24 h: a separate "N/A condition" text field per criterion that feeds the prompt. A "Test this criterion on N dialogs" button in the criterion editor that shows answers and justifications before saving.

### Kore.ai Quality AI (added; public docs)

- Metric types include "By Question (GenAI-Based)" and "By Question (Deterministic)".
- N/A treatment is a setting: the default is "Exclude from Score" (removes the weight from numerator and denominator); the alternative is "Award Full Weightage". Doc example: 3 adhered, 1 not adhered, 1 N/A out of five metrics at weight 20 gives 75% under Exclude and 80% under Award.
- Fatal error: "the system sets the final score to 0 and marks the interaction as failed".
- Each form update creates a version; evaluations keep the version active when they started.

**Closeness: Medium.**
Borrow in 24 h: store the criteria version on each evaluation (the team already has revisions). Show the two-way N/A example as a test case for the scorer.

### Yandex SpeechSense (Russian-speaking market; available in Kazakhstan)

- Release notes, March 2025: "SpeechSense can now analyze dialogs not only in Russian, but also in Kazakh, or a Russian-Kazakh combination." Kazakh speech is transcribed into Russian for analysis.
- Semantic tags (February 2025) take a criterion or general question with a probability threshold and can be tested before applying. Semantic Pro tags were added August 2025. AI assistants take instructions, a model choice, output fields, and an optional PDF knowledge base (up to 10 files of 30 MB each). A September 2025 release lets the assistant "highlight the agent's omissions" against the knowledge base.
- The January 2025 blog describes ten YandexGPT parameters (operator empathy, engagement, confidence, problem resolution; client satisfaction, irritation, misconduct) and a report named «Форма оценки» (evaluation form).
- February 2026 blog (Russian; paraphrased): in two months of testing, more than 30 companies launched about 700 assistants.
- Pricing (USD excl. VAT, first tier): text dialogs $0.0114999982 per 1,000 characters; assistant Medium model $0.0012499998 per 1,000 characters; audio analysis plus recognition $0.01642623 per minute. A 1,000-character chat therefore costs about $0.013 for analysis plus a Medium assistant.
- Not documented on fetched pages: weighted checklists, N/A, per-answer evidence, disputes.

**Closeness: Medium.** It is the only product found that documents Kazakh dialog analysis, and the only regional reference price. As far as the docs show, it is not a weighted scorecard engine.
Borrow in 24 h: treat Russian-Kazakh code-switching as normal input and say so in the demo. Quote the cost per 1,000 characters when presenting the team's own cost per evaluation.

### Level AI QA-GPT

- "just type your questions and go". Hybrid scorecards combine AI and human questions, and "Both sets of answers roll up into a single score".
- Conditional logic marks questions N/A by call type, department, or earlier answers.
- Evaluators get "suggested answers along with relevant timestamps and conversation quotes".
- Accuracy is qualitative only ("accuracy on par with your best auditors"). FAQ 9: accuracy "depends on how well the evaluation criteria and scoring logic are configured".
- A sandbox runs rubrics on real conversations before going live.

**Closeness: Medium.** Its quote and timestamp per answer matches the case, but there is no public methodology.
Borrow in 24 h: show a quote and turn number for every answer, including "No" answers (cite where the action was expected).

### Balto QA Copilot

- Criteria are written "in plain English", or Balto drafts criteria, "suggested weights, and auto-fail flags" from an existing QA form.
- Drill-in shows the recording, transcript, failed criterion, and "the moment it failed".
- Supervisors can set any criterion to Pass, Fail, or N/A, "and their answer is the one that counts". Dispute and overturn rates are tracked.
- A what-if pass-threshold simulator: example 93.6% pass (6,500 of 6,948) at a 97% threshold. No accuracy figure is published.

**Closeness: Medium.**
Borrow in 24 h: an overturn-rate counter per criterion on the dashboard (appeals accepted ÷ evaluations).

### Talkdesk QM Assist (not fetched; HTTP 403)

All three Talkdesk support pages returned 403. A search-engine summary says questions can be set per question to Manual, Keyword Match, or Generative AI. GenAI scoring is said to add time-stamped annotations, and a May 2026 "AI Rewrite" tool to reformulate questions into prompts. None of this was verified.
**Closeness: Medium (unverified).** Borrow in 24 h: nothing until verified; the "AI Rewrite" idea (an LLM tidies a criterion's wording) is possible but risky for accuracy.

## Products with Low closeness

| Product | What the fetched page documents | Why Low | Borrow in 24 h |
| --- | --- | --- | --- |
| NICE CXone (Auto Score, Evaluation Summary) | Scorecard Manager: questions scored, "critical questions that must be answered correctly", up to 20 profiles per scorecard, Final = Σ(profile score × weight) ÷ Σ weights. Evaluation Summary is a GenAI summary of submitted evaluations (preview ≤20 words, short ≤100, detailed ≤500); it does not score. Paid add-on to QM Advanced plus a Gen AI license. | No public documentation of LLM auto-scoring, evidence, or N/A | A short (≤100 word) per-dialog coaching summary generated from the criterion answers, not from the transcript |
| Verint Quality Bot | "Simply ask your evaluation questions and let Verint Quality Bot refine your evaluation form." Self-reported: 1.8M interactions scored and $4M saved (telco); compliance coverage 1% to 96% (FinTech). No accuracy figure. | Marketing only | Nothing |
| Observe.AI Auto QA | Drag-and-drop rules from "keywords, phrases, and advanced logic"; auto-suggest, auto-fill, auto-submit; "dispute options". Self-reported outcomes (23% AHT reduction and others) without method. A 2020 blog on evaluation forms is older than 2024. | No question-level documentation | Nothing |
| Cresta QM | "Behavioral scoring with custom-trained AI"; "human-in-the-loop calibration workflows"; "appeals" listed. No numbers. | Marketing only | Nothing |
| Rippit (formerly MaestroQA) | maestroqa.com/lps/autoqa redirects to rippit.com; FAQ: "MaestroQA is Rippit's former name". Guide (2026-10-02): "Every automated QA score should carry evidence"; a failing score links to the lines behind it; calibrate criterion by criterion before rollout. | Guide, not product docs | Criterion-by-criterion calibration report |
| Five9 Agentic QM | Blog 2026-05-29: policies referenced "directly inside the GenAI prompts" (for example from SharePoint); supervisors override; agents dispute from Agent Desktop; corrections feed back. No accuracy figures. | No configuration docs | Nothing |
| EvaluAgent AutoQM | Existing "categories, weightings and auto-fails carry across"; calibration sessions; agent disputes; "All AI-derived outcomes are visible, and you can override them". No accuracy figure. | Marketing only | Nothing |
| Sprinklr QM | "Case Conversation, Case Information, AI Scoring all in one screen"; Agent Dispute Flow for manual evaluations; calibration among QA managers. | No AI-scoring detail | Side-by-side transcript and scores (the team has this already) |
| Convin | "94%+ accuracy rate, validated against human reviewers" (self-reported, no methodology); "one-click supervisor override". | Unverifiable claim | Nothing |
| Scorebuddy | Help pages failed to load (socket closed). A search summary mentions per-question "tip prompts", a "Generate AI Score" preview, credits per scored interaction, and a self-reported 90%+ accuracy. | Not verified | Nothing |
| Salesforce (Agentforce, Einstein Conversation Insights) | No help.salesforce.com page on human-agent auto-QA scorecards was found. Search results covered Agentforce Optimization scoring AI-agent sessions on 1–5, which is a different problem. | Not found | Nothing |

## Synthesis

### Common design pattern

| Dimension | Pattern across products | Documented by | What the case asks |
| --- | --- | --- | --- |
| Question definition | Full-sentence question plus free-text instructions; increasingly instructions per answer option; few options (Genesys max 5, Calabrio "no more than five points", AWS "Yes, No, Partial") | AWS, Microsoft, Google, Genesys, Calabrio, Webex | Same: 8 criteria with rules per option |
| Answer types | Yes/No dominant; single-select with per-option points; numbers for metrics | All with docs | Yes/No/N/A and scales 0/5/10/15/20 and 0/4/7/10 |
| Weights | Section weights totalling 100% (Microsoft, AWS, Calabrio) or points as weights (Google, Webex) | | Per-criterion weights, sum 100 |
| N/A | Excluded; weight redistributed proportionally (AWS explicit, Calabrio within section). Kore.ai can award full weight instead. Webex adds an N/A condition text | AWS, Microsoft, Google, Calabrio, Webex, Kore.ai | Excluded, redistributed proportionally |
| Auto-fail | Zeroes the section or form (AWS, Calabrio, Kore.ai); Webex fails the section and evaluation by threshold. Microsoft alone fails the evaluation without changing the score | | Separate flag, total unchanged: Microsoft's model |
| Answer grounding | Justification plus transcript references (AWS, timestamps clickable); quotes plus timestamps (Level AI); reasoning plus evidence plus N/A reason (Zendesk EAP); "must find direct, measurable evidence" (Genesys) | | Turn-level evidence for every answer, including missed actions and N/A |
| Confidence | Genesys: model confidence below 70% gives the default answer; question hidden below 75% rolling accuracy. Others: none documented | Genesys | Not required; helps accuracy |
| Calibration | Agreement per question (Genesys, Zendesk); example-based tuning (Google: 100 per question); simulation on recent records (Microsoft: 25); test-a-question (Webex) | | Not required; demo value plus accuracy |
| Disputes | Requester must give a reason (AWS, Genesys, Zendesk); reviewer rescores or declines; AWS keeps the original visible under "Under review"; Zendesk lets the requester propose per-category scores | AWS, Genesys, Zendesk | Appeal per criterion; keep original, decision, reason, final |
| Versioning | Criteria versions; running work keeps its version (Microsoft, Kore.ai); Calabrio forbids editing published forms | | Replace a criterion via the UI and re-run |
| Language | Form language fixes output language (AWS, Microsoft, Genesys dialect). Russian: Google yes, Zendesk "All" in LLM mode, AWS no. Kazakh: Yandex only | | RU/KZ/EN dialogs |

### What the strongest products do that a 24-hour prototype can copy

1. Per-option instructions and an explicit N/A condition in every criterion (AWS guidelines, Microsoft answer-level instructions, Webex N/A context). Our checklist already has these rules; put them in the prompt verbatim, one block per criterion.
2. Guard against silent N/A. AWS documents that its model picks N/A when unsure, even for questions without N/A. Validate the answer in code against the allowed set (Genesys requires an exact match), and retry or flag on mismatch.
3. Clickable evidence. AWS's transcript reference jumps to the moment. The team already stores turn numbers; adding a quote check in code (does the cited turn contain the quoted text?) gets to Level AI and Zendesk-EAP level.
4. Critical flag separate from score (Microsoft): a badge, a grid column, and a per-criterion marker.
5. Agreement view (Genesys bands, Zendesk metric) computed on the team's labelled DEV dialogs.
6. Appeal states and original preserved (AWS): Requested, then Under review, then Resolved, with a mandatory reason and the original read-only beside the revision.
7. Test a criterion before saving (Webex Test Question, Microsoft simulation on 25 records). This directly serves the organizers' "replace one criterion and re-run" check.

### Where products are weaker than the case asks

| Case requirement | Product state |
| --- | --- |
| Per-criterion evidence that cites a specific turn and says what it shows, including for missed actions and N/A | Only Zendesk EAP (May 2026) documents an N/A reason with evidence. AWS gives references, not reasons for absence. Microsoft documents a summary, not per-question evidence. |
| Serious violations as a flag that does not change the total | AWS, Calabrio, and Kore.ai set the score to zero on auto-fail; only Microsoft documents keeping the score. |
| Appeal per criterion with original, decision, reason, and final kept | AWS keeps the original; Genesys does not say; Zendesk allows per-category proposals but its single-loop outcome storage is not documented. None documents all four fields per criterion. |
| Kazakh | Only Yandex documents Kazakh analysis, transcribed to Russian. AWS, Google, Microsoft, Genesys: no Kazakh found. |
| Bot turns before the operator | Microsoft has a "Participant evaluated" scope; others not documented. |
| One call per question vs per form | No vendor documents it. AWS's 10-per-contact and Genesys's per-form charging hint at per-question processing for AWS and per-form charging for Genesys, but this is inference. |

### Five behaviours most worth copying, ranked

| Rank | Behaviour | Why for demo / accuracy | Documented at |
| --- | --- | --- | --- |
| 1 | Answer-set validation with no silent N/A: a model N/A on a criterion without N/A is rejected and retried | Accuracy: prevents dropped weight that changes the total; AWS says its own model does this | https://docs.aws.amazon.com/connect/latest/adminguide/generative-ai-performance-evaluations.html |
| 2 | Clickable transcript reference per answer, quote verified in code | Demo (jump to the turn) and accuracy (catches invented evidence) | https://docs.aws.amazon.com/connect/latest/adminguide/generative-ai-performance-evaluations.html |
| 3 | Critical question fails the evaluation without changing the score, shown in the summary, per question, and in the grid | Matches case scoring exactly, in Dynamics 365's own vocabulary | https://learn.microsoft.com/en-us/dynamics365/contact-center/use/evaluation-criteria |
| 4 | Per-criterion human-vs-AI agreement with red/yellow/green bands (below 60 / 60–79 / 80+), at least 20 dialogs | Accuracy: shows which criteria to fix before the control set; demo: shows rigour | https://help.genesys.cloud/faqs/category/ai-scoring/ |
| 5 | Appeal with mandatory reason; original evaluation kept read-only under "Under review"; reviewer resolves with notes | Required demo flow; AWS shows the shape | https://docs.aws.amazon.com/connect/latest/adminguide/evaluation-review-requests.html |

Runner-up: Webex "Test Question" and Microsoft simulation for re-running a changed criterion on a sample before saving (https://help.webex.com/en-us/article/nxvdoq2/Use-Evaluation-and-Speech-Analytics-in-Webex-AI-Quality-Management, https://learn.microsoft.com/en-us/dynamics365/contact-center/use/evaluation-criteria).

## Negative results

- **NICE CXone:** searched for "AutoQA", "Enlighten AutoScore", "Auto Score", "Copilot for Supervisors" on help.nicecxone.com. Found the Scorecard Manager and Evaluation Summary only; no page describes LLM answering of form questions, evidence, or N/A.
- **Salesforce:** searched for Einstein Conversation Insights and Agentforce QA scorecards. No help.salesforce.com page on auto-scoring human-agent conversations against a scorecard was found.
- **Level AI help center:** thelevel.ai/auto-qa/ returned 404. No public help docs on N/A or auto-fail were found.
- **MaestroQA help center:** no help.maestroqa.com pages surfaced; the product is now Rippit.
- **Accuracy methodology:** no vendor publishes agreement methodology (sample size, metric, rater agreement) for its AI scoring. Convin's 94% and Level AI's ">90%" are bare claims; Google and Genesys publish thresholds, not results.
- **Per-call design:** no vendor documents one LLM call per question vs one per form.
- **Language lists:** none found for Microsoft QEA (MC1443023 names none), Genesys AI Scoring, Calabrio, Webex, Level AI, or Observe.AI.
- **Microsoft pricing:** no per-evaluation Copilot-credit rate found.
- **Russian-language search** ("автоматическая оценка качества работы операторов чек-лист LLM"): found Yandex SpeechSense, a Sostav blog, and an AstanaHub technical task, "Development of an operator–client dialog quality evaluation system", which returned 403 and was not read. No other Russian or Kazakh vendor with public documentation of weighted LLM checklists was found.

## Could not fetch

| URL | Result |
| --- | --- |
| https://support.talkdesk.com/hc/en-us/articles/50371682083739-Talkdesk-QM-Using-Per-Question-Evaluation-Modes-and-AI-Rewrite | 403 |
| https://support.talkdesk.com/hc/en-us/articles/4402964008987 | 403 |
| https://help.dialpad.com/v1/docs/AI-scorecards | 403 |
| https://astanahub.com/ru/tech_task/razrabotka-sistemy-otsenki-kachestva-dialogov-operator-klient (and /en/) | 403 |
| https://intercom.help/scorebuddy-b32c18522ac7/en/articles/10289952-genai-assist and .../13176902-ai-knowledge-for-autoscoring | socket closed |
| https://thelevel.ai/auto-qa/ | 404 |
| https://dotnet.territoriali.olinfo.it/... (Microsoft Learn mirror) | expired certificate; used learn.microsoft.com instead |

## Sources

Fetched and used:
- https://docs.aws.amazon.com/connect/latest/adminguide/generative-ai-performance-evaluations.html (no date shown)
- https://docs.aws.amazon.com/connect/latest/adminguide/about-scoring-and-weights.html (no date shown)
- https://docs.aws.amazon.com/connect/latest/adminguide/create-evaluation-forms.html (no date shown; changelog entries to 2026-10-08)
- https://docs.aws.amazon.com/connect/latest/adminguide/evaluation-review-requests.html (no date shown; launch announced 2026-01)
- https://aws.amazon.com/products/connect/customer/pricing/appendix/ (no date shown)
- https://aws.amazon.com/connect/pricing/ (no date shown; base channel rates only)
- https://docs.cloud.google.com/gemini-enterprise-cx/insights/qai-basics (no date)
- https://docs.cloud.google.com/contact-center/insights/docs/qai-best-practices (no date)
- https://docs.cloud.google.com/gemini-enterprise-cx/insights/languages?hl=en (no date)
- https://learn.microsoft.com/en-us/dynamics365/contact-center/use/evaluation-criteria (2026-10-23)
- https://learn.microsoft.com/en-us/dynamics365/contact-center/administer/manage-quality-evaluation-agent (2026-10-23)
- https://learn.microsoft.com/en-us/dynamics365/contact-center/use/use-evaluations (2026-10-22)
- https://learn.microsoft.com/en-us/dynamics365/contact-center/use/evaluation-plan (2026-10-23)
- https://learn.microsoft.com/en-us/dynamics365/contact-center/use/on-demand-evaluation (2026-10-07)
- https://learn.microsoft.com/en-us/dynamics365/guidance/agent-templates/service-quality-evaluation-agent (2026-08-24)
- https://mc.merill.net/message/MC1443023 (2026-07-30)
- https://help.genesys.cloud/articles/ai-scoring-best-practices/ (footer 2026)
- https://help.genesys.cloud/?p=359411 (footer 2026)
- https://help.genesys.cloud/faqs/category/ai-scoring/ (no date)
- https://help.genesys.cloud/articles/agent-auto-complete-form-type/ (no date)
- https://help.genesys.cloud/articles/manage-disputed-evaluations/ (no date; mentions 2024-02-19 change)
- https://help.nicecxone.com/content/qmanalytics/auto score/scorecard manager.htm (no date)
- https://help.nicecxone.com/content/qmanalytics/evaluate/evaluationsummary.htm (no date)
- https://verint.com/automated-quality-management (no date)
- https://observe.ai/platform/auto-qa (no date)
- https://observe.ai/blog/in-case-you-missed-it-ai-driven-evaluation-forms-now-live (2020-06-29, older than 2024)
- https://help.calabrio.com/doc/Content/user-guides/evaluations/ai-evaluation-guidelines.htm (no date)
- https://help.calabrio.com/Content/user-guides/application-management/auto-qm-evaluation-form-manager.htm (no date)
- https://help.webex.com/en-us/article/nxvdoq2/Use-Evaluation-and-Speech-Analytics-in-Webex-AI-Quality-Management (2026-07-23)
- https://docs.kore.ai/ai-for-service/quality-ai/configure/evaluation-forms (no date)
- https://support.zendesk.com/hc/en-us/articles/10727979177498-Announcing-the-AutoQA-Deep-evaluation-and-validation-EAP (2026-05-14)
- https://support.zendesk.com/hc/en-us/articles/9046364914842-Improving-AutoQA-accuracy (no date)
- https://support.zendesk.com/hc/en-us/articles/7043747123354-Understanding-autoscoring-categories (no date)
- https://support.zendesk.com/hc/en-us/articles/7043712922522-About-rating-categories-for-scorecards (no date)
- https://support.zendesk.com/hc/en-us/articles/7043760048922-Disputing-a-review (no date)
- https://www.rippit.com/guides/qa-100-percent-of-support-conversations (2026-10-02; reached via redirect from https://www.maestroqa.com/lps/autoqa)
- https://thelevel.ai/product/quality-assurance-contact-center (no date)
- https://cresta.com/cresta-qm/ (no date)
- https://www.five9.com/blog/better-calls-happier-customers-how-genai-contact-centers-transforming-quality-management (2026-05-29)
- https://www.evaluagent.com/auto-quality-assurance/ (no date)
- https://www.sprinklr.com/help/articles/quality-management/quality-management-capabilities/64d29a1ed8ffbe0c8034f040 (no date)
- https://convin.ai/frequently-asked-questions/ai-qa-accuracy (no date)
- https://www.balto.ai/balto-qa-copilot/ (no date)
- https://yandex.cloud/ru/blog/posts/2025/01/call-centers-and-speechsense (2025-01-23)
- https://yandex.cloud/ru/blog/speechsense-ai-assistants (2026-02-05)
- https://aistudio.yandex.ru/docs/en/speechsense/ (no date)
- https://aistudio.yandex.ru/docs/en/speechsense/release-notes/ (entries 2025)
- https://aistudio.yandex.ru/docs/en/speechsense/pricing (no effective date)
- https://aistudio.yandex.ru/docs/en/speechsense/concepts/assistants (no date)

Seen only in search results, not fetched (not relied on for facts above except where marked):
- https://aws.amazon.com/about-aws/whats-new/2026/01/amazon-connect-appeals-workflow-agent-performance-evaluations
- https://aws.amazon.com/about-aws/whats-new/2024/08/amazon-connect-contact-lens-audit-trail-agent-evaluation
- https://docs.cloud.google.com/contact-center/insights/docs/qai-setup-guide

## Confidence

The High-closeness sections (Microsoft, AWS, Genesys, Google) rest on official documentation fetched today, much of it dated October 2026 or with 2026 footers, so the configuration facts are reliable. The fetch tool summarises pages, so exact wording was checked only where quoted. Medium-closeness entries are reliable for what they state but thin: Zendesk, Calabrio, Webex, and Kore.ai are official help pages; Level AI and Balto are product pages; Yandex is docs, release notes, and blogs. Low-closeness entries are mostly marketing pages. Their absence of detail reflects what is public, not necessarily what the products do.

Not verified:
- Talkdesk and Scorebuddy behaviour (pages blocked).
- Whether any vendor uses one LLM call per question or per form.
- Language lists for Microsoft, Genesys, Calabrio, and Webex.
- Microsoft's per-evaluation cost.
- Any vendor accuracy figure. All are self-reported, and none has a published method. No independent benchmark of commercial auto-QA agreement was found.
- AWS auto-fail behaviour was confirmed in fix round 1 on the create-evaluation-forms page. The earlier claim, from a search summary, that a failing question also marks its parent section and form as auto-failed was not confirmed and has been dropped.
