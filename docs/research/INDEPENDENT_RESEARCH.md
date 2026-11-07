# Independent research: how to solve the CQA case

Date: 2026-11-07, about hour 10 of 24. Synthesis of six findings files (T1 to T6 in docs/research/findings/), checked against the case context, the team's research brief, docs/CQA_ARCHITECTURE.md and docs/ML_B_PLAN.md. Citations are written (Tn, URL). Counts from the DEV set are cited as (T5, DEV count): Task 5 counted them in data/raw/dev.json and they have no URL. Vendor and competitor numbers are self-reported unless marked. "[inference]" marks a judgement made in this report or in a findings file, not a sourced fact.

## 1. Executive summary

1. Every serious solution, commercial or competitor, writes each criterion as a natural-language question with per-option instructions and an N/A condition, lets the LLM answer with a justification and transcript references, and leaves answer validation, scoring and disputes to code and humans (T1, https://docs.aws.amazon.com/connect/latest/adminguide/generative-ai-performance-evaluations.html; T2, https://github.com/Azalytical/freedom-cqa).
2. The platform the case names already ships this model natively: the Dynamics 365 Quality Evaluation Agent has weighted sections, N/A excluded, and critical questions that fail an evaluation without changing its score, but no documented agent appeal (T1, https://learn.microsoft.com/en-us/dynamics365/contact-center/use/evaluation-criteria; T6, https://learn.microsoft.com/en-us/dynamics365/contact-center/use/use-evaluations).
3. Our differentiators against it are turn-level evidence, an appeal record that keeps original, decision and final, RU/KZ handling and a local-or-cloud model choice, not the scoring itself.
4. The most plausible organizer metric [inference] is exact match per cell over the 80 cells (8 criteria x 10 dialogs) with N/A as its own answer, possibly next to total-score differences (T5, https://support.zendesk.com/hc/en-us/articles/9046364914842-Improving-AutoQA-accuracy; T5, https://arxiv.org/html/2606.00093v1).
5. Under that metric most cells are easy: always giving the DEV majority answer would match about 399 of 480 DEV cells (83%) under Task 5's provisional labels [inference, computed from T5 C.4], so points are won or lost on planted defects and N/A decisions.
6. The best public competitor reports 94.4% per-criterion agreement, weakest on criteria 04 (88%) and 06 (85%), but on its own labels with guidance tuned on the same dialogs, so it is an untrusted self-report (T2, https://github.com/Azalytical/freedom-cqa).
7. Change 1: settle the c07 closing rule before labeling, because the team guide's literal reading ("a goodbye alone is No") makes c07 = No in 41 of 60 DEV chats, which Task 5 reads as unintended; ask the organizers and default to "farewell after resolution = Yes" (T5, DEV count; T5, https://arxiv.org/html/2512.23707).
8. Change 2: compute structural facts in code (first operator turn, verification event, last system event, c08 keyword hits) and pass them to the prompt as proposals, the separate lesson of the OK/NotOK judge write-up, while Russian industry write-ups found instruction quality moved agreement more than model choice (T2, https://habr.com/ru/articles/1071782/; T2, https://habr.com/ru/companies/mts_ai/articles/1087852/).
9. Change 3: rewrite each criterion as "Yes when / No when / N/A only when" with "never answer N/A because you are unsure" and a top-of-scale default for c04 and c06, since AWS documents that its own judge picks N/A when uncertain (T1, https://docs.aws.amazon.com/connect/latest/adminguide/generative-ai-performance-evaluations.html; T5, https://arxiv.org/abs/2605.16386).
10. Recommended architecture: code-derived facts and rules for structural criteria, Qwen3.8-27B on Cerebras for judgement (3 samples, vote share as confidence, blind gpt-oss tie-break), and the same weights on one local 24 GB GPU for the local track (T4, https://huggingface.co/Qwen/Qwen3.8-27B; T4, https://computingforgeeks.com/run-qwen3-8-27b-locally/).

## 2. Landscape map

Closeness ratings are the findings files' own ratings. Where two files rate the same item differently, both are shown. Rows marked "(rating: this report)" had no explicit rating in the findings.

### 2.1 Commercial products

| Item | Closeness | One-line reason | Source |
|---|---|---|---|
| Microsoft Dynamics 365 Quality Evaluation Agent | High | Same object model (weights, N/A excluded, critical flag that leaves the score alone, versions), inside the organizer's platform; no agent appeal, per-question evidence not described | T1/T6, https://learn.microsoft.com/en-us/dynamics365/contact-center/use/evaluation-criteria |
| Amazon Connect Contact Lens gen-AI evaluations | High | Exact N/A redistribution formula, transcript references that jump to the moment, appeals that keep the original; no RU/KZ forms; auto-fail zeroes the score | T1, https://docs.aws.amazon.com/connect/latest/adminguide/about-scoring-and-weights.html |
| Genesys Cloud AI Scoring | High (T1) / Medium (T6) | T1 for the evaluator; T6 for UI. Best documented human-vs-AI agreement tracking (bands, 20-interaction test, 80% target, low-confidence suppression) | T1, https://help.genesys.cloud/faqs/category/ai-scoring/ |
| Google CX Insights Quality AI | High | N/A removed from score, Russian supported, Kazakh not; calibration needs 100 examples per question | T1, https://docs.cloud.google.com/contact-center/insights/docs/qai-best-practices |
| Zendesk QA AutoQA | Medium | Reasoning, evidence and N/A reason per category (EAP May 2026); shipped agreement definition with distance credit | T1, https://support.zendesk.com/hc/en-us/articles/10727979177498-Announcing-the-AutoQA-Deep-evaluation-and-validation-EAP |
| Calabrio Auto QM | Medium | Weighted N/A-aware form; deterministic checks next to AI | T1, https://help.calabrio.com/doc/Content/user-guides/evaluations/ai-evaluation-guidelines.htm |
| Webex AI QM | Medium | Separate "N/A context" field; "Test Question" on sample interactions | T1, https://help.webex.com/en-us/article/nxvdoq2/Use-Evaluation-and-Speech-Analytics-in-Webex-AI-Quality-Management |
| Kore.ai Quality AI | Medium | N/A treatment configurable (exclude or award full weight); versions | T1, https://docs.kore.ai/ai-for-service/quality-ai/configure/evaluation-forms |
| Level AI QA-GPT | Medium | Quotes and timestamps per answer; no accuracy method | T1/T6, https://thelevel.ai/product/quality-assurance-contact-center |
| Balto QA Copilot | Medium | Drill-in to the failing moment; overturn rate tracked | T1, https://www.balto.ai/balto-qa-copilot/ |
| Talkdesk QM Assist | Medium (unverified) | Pages returned 403; search summary only | T1, https://support.talkdesk.com/hc/en-us/articles/50371682083739-Talkdesk-QM-Using-Per-Question-Evaluation-Modes-and-AI-Rewrite |
| NICE CXone | Low (T1) / Medium (T6) | T1: no public LLM auto-scoring docs. T6: useful UI patterns ("Failed", "Updated" badge, one-round appeal). Both stand: Low for the evaluator, Medium for UI | T6, https://help.nicecxone.com/Content/myzone/viewingyourevaluations.htm |
| EvaluAgent AutoQM | Low (T1) / Medium (T6) | Marketing only, but the mock-up layout (earned/weight per criterion beside transcript) fits our card | T6, https://www.evaluagent.com/auto-quality-assurance/ |
| Low, summarized | 11 entries | Verint, Observe.AI, Cresta, Rippit (MaestroQA), Five9, Sprinklr, Convin, Scorebuddy, Salesforce (T1); MaestroQA and Playvox UI unverified (T6) | T1, T6 |

### 2.2 Regional products

| Item | Closeness | One-line reason | Source |
|---|---|---|---|
| Yandex SpeechSense (AI assistants, Kazakh analysis) | Medium (T1 and T2) | Only product documenting Kazakh dialog analysis (transcribed into Russian); configurable LLM questions; no N/A, evidence or appeal in docs | T1, https://aistudio.yandex.ru/docs/en/speechsense/release-notes/; T2, https://yandex.cloud/ru/blog/speechsense-ai-assistants |
| Telfin "Контакт-центр" | Medium | Weighted checklists with mandatory items, AI or human score per call | T2, https://www.comnews.ru/content/243338/2026-01-20/ |
| Low, summarized | 6 entries | SpeechSense platform, Sber SaluteSpeech, OTP Bank on Naumen, BSS, 3iTech, Kaspi AI (claim only) | T2 |

No public description was found of Kaspi, Halyk or Freedom using LLM scoring of operators. Freedom Broker's support director describes manual checklist compliance control (T2, https://digitalbusiness.kz/2025-05-15/mi-na-pervoy-linii-v-rabote-s-klientami-poetomu-vsegda-dolzhni-bit-nagotove-intervyu-sdirektorom-departamenta-podderzhki-irazvitiya-klientov-freedom-broker-irinoy-suglobovoy/).

### 2.3 Precedents

| Item | Closeness | One-line reason | Source |
|---|---|---|---|
| 24 public competitor repos for this hackathon | High | Same task and data; ideas only, no code; README numbers self-reported and changing | T2, https://github.com/Azalytical/freedom-cqa (and 23 others in section 11) |
| Yandex Crowd, operator-error detection with LLM (Habr 2025-10-02) | High | Checklist judge on Russian support dialogs; one all-in-one prompt gave too many false positives; hybrid rules plus LLM; prompt regression tests | T2, https://habr.com/ru/companies/yandex/articles/951568/ |
| Ingle et al., EMNLP 2024 Industry | High (T3) / Medium (T2) | Yes/No QA items with evidence over support calls; evaluation plans +5.08 F1. T3 rates High for task shape; T2 Medium for English-only private data. This report uses High | T3, https://aclanthology.org/2024.emnlp-industry.60.pdf |
| "ОК или НеОК" LLM judge (Habr) | Medium | Facts from system state in code; kappa 0.584 holistic, 0.684 to 0.75 after reworking | T2, https://habr.com/ru/articles/1071782/ |
| MTS AI session scoring (Habr) | Medium | Rewriting the annotation instructions was the largest single gain (human alpha 0.33 to 0.65) | T2, https://habr.com/ru/companies/mts_ai/articles/1087852/ |
| YooMoney CSI prediction (Habr) | Medium | 60% exact, 90% within one point; explanations made disagreements reviewable | T2, https://habr.com/ru/companies/yoomoney/articles/933954/ |
| Low, summarized | 5 OSS repos plus 3 earlier Freedom competitions | No labels-based evaluation; earlier Freedom cases were not QA | T2 |

### 2.4 Papers and methods

| Item | Closeness | One-line reason | Source |
|---|---|---|---|
| STREAQ (EMNLP 2025 Industry) | High | Rare-answer QA; passing the small model's reasoning to the large judge lowered performance | T3, https://aclanthology.org/2025.emnlp-industry.121.pdf |
| Counterfactual fairness of contact-center QA (2026) | High | Priming with coaching notes flips 16.44% of verdicts; keep the prompt clean | T3, https://arxiv.org/pdf/2602.14970 |
| Why Synthetic Isn't Real Yet (2025/2026) | High | Prompts tuned on synthetic calls lose about 11% Macro F1 on real calls | T3, https://arxiv.org/html/2508.18210v2 |
| CompliBench (2026) | High | Planted guideline violations; base Qwen3-8B below 2% conversation-level accuracy | T3, https://arxiv.org/abs/2604.12312 |
| BEA 2025 shared task | High | Organizer-written dialogue rubric; human Fleiss kappa 0.64 to 0.65; exact and lenient scoring | T5, https://arxiv.org/html/2507.10579v1 |
| Rao and Callison-Burch, agreement reporting (2026) | High | Name the N/A handling mode; three-class N/A changes accuracy from 0.714 to 0.600 in a worked example | T5, https://arxiv.org/html/2606.00093v1 |
| Omind AI QA calibration guide | High | Compare per criterion, not totals; four-way mismatch taxonomy | T5, https://www.omind.ai/?p=10965 |
| Criteria drift (2024) | High | Rubric authors refine criteria while grading outputs | T5, https://arxiv.org/abs/2404.12272 |
| Roussel, Calibrate-Validate-Freeze (NeurIPS 2026, abstract) | Medium | Disagreement-driven rule fixes: kappa 0.47 to 0.57 dev, 0.58 held-out | T3, https://neurips.cc/virtual/2026/161262 |
| Trust or Escalate (ICLR 2025) | Medium (High for the signal) | Verbalized confidence AUROC 0.548 to 0.550; varied in-context samples 0.723 to 0.755 | T3, https://arxiv.org/html/2407.18370v1 |
| HealthBench and its disagreement decomposition | Medium | Non-reasoning GPT-4.1 grader 0.709 F1 beat o3 0.681; disagreement peaks on borderline cases | T3, https://arxiv.org/html/2505.08775v1; https://arxiv.org/pdf/2602.22758 |
| SLMJury (2026, abstract) | Medium | Debate hurt in every configuration | T3, https://arxiv.org/abs/2606.07810 |
| FBI (EMNLP 2024) | Medium | Judges missed planted quality drops in over 50% of cases | T3, https://arxiv.org/abs/2406.13439 |
| Rubrics as an Attack Surface (2026) | Medium | Rubric edits can hurt a slice by up to 27.9% while passing aggregate checks | T3, https://arxiv.org/abs/2602.13576 |
| MM-Eval; Zubiaga et al.; Galyukshev and Alimova | Medium | Low-resource judges drift mid-scale; English or high-resource instructions beat translation; Kazakh Cyrillic +7.6 pp over Latin | T3, https://arxiv.org/html/2410.17578v2; https://arxiv.org/html/2605.28710; https://aclanthology.org/2026.acl-srw.94.pdf |
| Qorǵau (ACL Findings 2025) | Medium (rating: this report) | GPT-4o judge kappa 0.595 Kazakh vs 0.522 Russian, accuracy 90.4% vs 90.9%; safety task, not service quality | T2, https://aclanthology.org/2025.findings-acl.507.pdf |
| LLM-Rubric (ACL 2024) | Medium | Calibrated rubric questions cut RMSE 0.901 to 0.422, but training used about 593 ratings per fold | T3, https://arxiv.org/html/2501.00274v1 |
| TICK (2024) | Medium | LLM-generated Yes/No checklists; useful for a new criterion with no rubric | T3, https://arxiv.org/abs/2410.03608 |
| MemAlign (vendor, 2026) | Medium | 50 examples per dataset; large seen/unseen gap shows memorization (self-reported) | T3, https://mlflow.org/blog/memalign/ |
| Overconfidence in LLM-as-a-Judge (2025, abstract) | Medium | Judge confidence overstates correctness; do not use verbalized confidence | T3, https://arxiv.org/abs/2508.06225 |
| JEV-as-a-Judge (2026, preprint) | Medium | Accept-or-escalate by label probability; AUROC near chance on reference-free prose; weak evidence | T3, https://www.alphaxiv.org/abs/2609.26550.md |
| MT-Bench few-shot appendix (2023, older than 2024) | Medium | Few-shot raised GPT-4 consistency 65.0% to 77.5%, human agreement unchanged | T3, https://arxiv.org/pdf/2306.05685 |
| Zendesk AutoQA agreement definition | High | Shipped per-category exact match for binary items, distance credit (25 points per step) for scales | T5, https://support.zendesk.com/hc/en-us/articles/9046364914842-Improving-AutoQA-accuracy |
| SQM 5-point calibration target | Medium | Same 100-point weighted form shape; target is about humans, not AI | T5, https://stealthagents.com/research/bpo-quality-assurance-scorecard-benchmarks-2026 |
| MLflow judge calibration guide (2026) | Medium | Measure human-human first; revise rubric when kappa is below about 0.61; oversample rare classes | T5, https://mlflow.org/articles/llm-judge-calibration/ |
| EDM 2023 QWK critique (older than 2024) | Medium | QWK depends on prevalence; 99.8% raw agreement coexisted with QWK 0.488 | T5, https://educationaldatamining.org/EDM2023/proceedings/2023.EDM-long-papers.9/index.html |
| LeWiDi 2025 (abstract) | Medium | Model the individual rater with in-context examples of that rater's labels | T5, https://arxiv.org/abs/2509.09524 |
| Scale and leniency papers (2601.03444, 2605.16386, 2512.23707) | Low to Medium | Mid-scale compression; humans grade partial fulfilment leniently | T5 |
| Low, summarized | 12 entries | GEPA, Rubrics as Rewards, RocketEval, J1, LRM bias, HITL patch rubric, Judge's Verdict, M-Prometheus, COPC and QATC survey figures, Scorebuddy claim, 2606.07541; 2606.19544 withdrawn | T3, T5 |

### 2.5 Models and infrastructure

| Item | Closeness | One-line reason | Source |
|---|---|---|---|
| Qwen/Qwen3.8-27B via HF router `:cerebras` | High | Live, $0.99/$1.49 per M, 65,536 context on the router (131,072 paid direct), about 944 tok/s measured | T4, https://huggingface.co/Qwen/Qwen3.8-27B; https://inference-docs.cerebras.ai/models/qwen-3.8-27b |
| Qwen3.8-27B UD-Q4_K_XL GGUF or Ollama `qwen3.8:27b` on a 24 GB GPU | High | 17.56 GB file; 95.5 to 109 tok/s with MTP on an RTX 4090; same weights as the cloud judge | T4, https://computingforgeeks.com/run-qwen3-8-27b-locally/ |
| GigaAM-Multilingual (Sber, MIT, July 2026) | High (for STT only) | Kazakh WER 4.4 FLEURS, 15.8 in-the-wild vs Whisper large-v3 32.4 and 65.2 (self-reported) | T4, https://huggingface.co/ai-sage/GigaAM-Multilingual |
| openai/gpt-oss-120b `:cerebras` | Medium | Second family, $0.35/$0.75; reasoning cannot be disabled; router SO flag false | T4, https://inference-docs.cerebras.ai/capabilities/reasoning |
| Workers AI `@cf/qwen/qwen3.8-27b` | Medium | Same family inside the Worker, $0.45/$3.20; JSON schema not documented | T4, https://developers.cloudflare.com/workers-ai/models/qwen3.8-27b/ |
| Workers AI `@cf/cloudflare/clef` and `clef-omni` | Medium | Up to 64 typed questions, probability per option, input-only billing; no explanations | T4, https://developers.cloudflare.com/workers-ai/models/clef/ |
| GLM-5.3-Flash, DeepSeek-V4.1-Flash, gpt-6-luna, claude-haiku-5-5 | Medium | Cheap third-family voters with enforced schemas; no RU/KZ judge evidence | T4, https://developers.openai.com/api/docs/models/gpt-6-luna |
| ISSAI Qwen3.5-35B-A3B-Kazakh and Qwen3.5-9B-Kazakh (Apache-2.0, Aug 2026) | Medium | First current-generation Kazakh numbers; unmodified Qwen3.5-35B-A3B already scores 82.6 on Kazakh KazMMLU | T2, https://huggingface.co/issai/Qwen3.5-35B-A3B-Kazakh; https://huggingface.co/issai/Qwen3.5-9B-Kazakh |
| T-one; Qolda-AVL; Gemini audio as an unscored tone panel | Medium | Best Russian call-center WER (T-one 8.63); KK/RU audio LLM; cheap audio API | T4, https://huggingface.co/t-tech/T-one; https://huggingface.co/issai/Qolda-AVL-34B; https://aistudio.google.com/docs/audio |
| Claude Fable 5.1 | Low as main judge; ceiling check only | $10/$50 per M, $0.225 per chat reasoning call, 25x Qwen; no RU/KZ judge evidence | T4, https://platform.claude.com/docs/en/about-claude/pricing |
| Low, summarized | 9 entries | Opus 5.5, Gemini 4 Argon and GPT-6 Astra as main judge; YandexGPT; GigaChat; AlemLLM; Qwen3-Omni; Voxtral; OpenAI gpt-audio | T2, T4 |

## 3. How the best solutions work

### 3.1 The common architecture, as a pipeline

The diagram is a left-to-right pipeline with a review loop on the right:

**Criterion definition → ingest and scope → judge → validate → score → flag → confidence routing → human review → calibration → back to criterion definition.**

1. **Criterion definition.** A full-sentence question, instructions per answer option, an N/A condition, and few answer options (T1, https://help.calabrio.com/doc/Content/user-guides/evaluations/ai-evaluation-guidelines.htm). Academic systems add an "evaluation plan" of observable checks (T3, https://aclanthology.org/2024.emnlp-industry.60.pdf).
2. **Ingest and scope.** Only some turns are judged. Microsoft's "Participant evaluated" lets the bot be excluded (T1, https://learn.microsoft.com/en-us/dynamics365/contact-center/use/evaluation-criteria). Facts available in system state are computed in code (T2, https://habr.com/ru/articles/1071782/).
3. **Judge.** The LLM produces evidence first, then a verdict (T3, https://aclanthology.org/2025.emnlp-industry.121.pdf).
4. **Validate.** The answer must exactly match an allowed option (T1, https://help.genesys.cloud/faqs/category/ai-scoring/). Quotes are checked against the transcript (T2, competitor READMEs).
5. **Score.** N/A is excluded and its weight redistributed (T1, https://docs.aws.amazon.com/connect/latest/adminguide/about-scoring-and-weights.html).
6. **Flag.** A critical or auto-fail flag is raised alongside the score.
7. **Confidence routing.** Genesys hides AI answers below 75% rolling accuracy. Trust or Escalate routes on varied-sample agreement (T1, https://help.genesys.cloud/faqs/category/ai-scoring/; T3, https://arxiv.org/html/2407.18370v1).
8. **Human review.** A dispute needs a mandatory reason, the reviewer rescores or declines, and the original stays visible (T1, https://docs.aws.amazon.com/connect/latest/adminguide/evaluation-review-requests.html).
9. **Calibration.** Agreement is tracked per question (T1, https://help.genesys.cloud/faqs/category/ai-scoring/). Rules are fixed from the disagreements and then frozen (T3, https://neurips.cc/virtual/2026/161262).

| Stage | Commercial practice | Best academic method | Case requirement | Source |
|---|---|---|---|---|
| Criterion text | Instructions per option; "Specify when the answer is N/A"; say whether "all or any" behaviours are required | Evaluation plan of 3 to 6 observable checks; +5.08 Macro F1 for a small model | Organizer rules, verbatim | T1, https://docs.aws.amazon.com/connect/latest/adminguide/generative-ai-performance-evaluations.html; T3, https://aclanthology.org/2024.emnlp-industry.60.pdf |
| Facts from structure | Calabrio deterministic metadata questions; Microsoft bot scope | Facts in code, LLM for semantics (kappa 0.684 to 0.75 vs 0.584 holistic) | System events decide c03, c04 N/A, c07 | T1, https://help.calabrio.com/Content/user-guides/application-management/auto-qm-evaluation-form-manager.htm; T2, https://habr.com/ru/articles/1071782/ |
| Evidence | AWS transcript references with jump; Zendesk EAP evidence plus N/A reason | Evidence then verdict; removing evidence from training cost only 0.28 F1 | Turn citation for every answer, missed action and N/A | T1, https://support.zendesk.com/hc/en-us/articles/10727979177498-Announcing-the-AutoQA-Deep-evaluation-and-validation-EAP; T3, https://aclanthology.org/2024.emnlp-industry.60.pdf |
| Answer validation | Genesys requires exact text match; AWS falls back to N/A when unsure | n/a | N/A only where allowed | T1, https://help.genesys.cloud/faqs/category/ai-scoring/ |
| Confidence | Genesys: below 70% confidence uses the default answer | Vote share over samples with varied in-context examples | Not required | T3, https://arxiv.org/html/2407.18370v1 |
| Disputes | Mandatory reason; original read-only beside the review (AWS); proposed per-category scores (Zendesk) | Blind re-evaluation: extra context flips 9 to 16% of verdicts | Appeal, reviewer decision with reason, original and final kept | T1, https://docs.aws.amazon.com/connect/latest/adminguide/evaluation-review-requests.html; T3, https://arxiv.org/pdf/2602.14970 |
| Calibration | Per-question agreement, red/yellow/green below 60 / 60 to 79 / 80+; Google needs 100 examples per question | Disagreement-driven rules, freeze, single held-out run | Not required; demo value | T1, https://help.genesys.cloud/faqs/category/ai-scoring/; T3, https://neurips.cc/virtual/2026/161262 |
| Versioning | Criteria version increments; simulation on the 25 most recent records (Microsoft); Test Question (Webex) | Prompt hash drift guard | Replace a criterion through the UI and re-run | T1, https://learn.microsoft.com/en-us/dynamics365/contact-center/use/evaluation-criteria |

### 3.2 What the case asks that the market does not do

The task brief named N/A redistribution as a gap. The findings contradict that: AWS documents the case's exact proportional formula, and Microsoft, Google, Calabrio and Webex all exclude N/A (T1, https://docs.aws.amazon.com/connect/latest/adminguide/about-scoring-and-weights.html). The real gaps are:

| Case requirement | Market state | Source |
|---|---|---|
| Evidence for every answer, including missed actions and N/A, citing a turn and saying what it shows | Only Zendesk EAP (May 2026) documents an N/A reason with evidence; Microsoft documents a summary, not per-question evidence | T1, https://support.zendesk.com/hc/en-us/articles/10727979177498-Announcing-the-AutoQA-Deep-evaluation-and-validation-EAP |
| Serious violation as a flag that leaves the total unchanged | Only Microsoft; AWS, Calabrio and Kore.ai set the score to zero | T1, https://learn.microsoft.com/en-us/dynamics365/contact-center/use/evaluation-criteria |
| Per-criterion appeal keeping original, decision, reason and final | No vendor documents all four; Microsoft has manager edit only | T6, https://learn.microsoft.com/en-us/dynamics365/contact-center/use/use-evaluations |
| Kazakh | Only Yandex, by transcribing Kazakh into Russian; AWS, Google, Genesys no; Microsoft language list not found | T1, https://aistudio.yandex.ru/docs/en/speechsense/release-notes/; https://docs.cloud.google.com/gemini-enterprise-cx/insights/languages?hl=en |
| Replaced criterion at test time with frozen code, scored at once | Vendors calibrate a new question with examples (Google: 100 per question) or test it on a sample before saving (Microsoft 25 records, Webex). None publishes agreement for an uncalibrated new criterion | T1, https://docs.cloud.google.com/contact-center/insights/docs/qai-best-practices; https://help.webex.com/en-us/article/nxvdoq2/Use-Evaluation-and-Speech-Analytics-in-Webex-AI-Quality-Management |
| Bot turns before the operator excluded | Only Microsoft's "Participant evaluated" | T1, https://learn.microsoft.com/en-us/dynamics365/contact-center/use/evaluation-criteria |
| Published accuracy method | None: vendor accuracy figures are bare claims (Convin 94%, Level AI over 90%) | T1, https://convin.ai/frequently-asked-questions/ai-qa-accuracy |

## 4. Solution options for this case

| | A. Single strong cloud judge with verification | B. Sampled open-model jury with local mode | C. Hybrid: code facts and rules for structural criteria, sampled LLM for judgement |
|---|---|---|---|
| Components | One Qwen3.8-27B reasoning call per dialog (or one Fable 5.1 call); Zod validation; quote check; one repair retry | 3 Qwen samples, vote share, blind gpt-oss tie-break on splits, dedicated c08 call; same weights locally via llama.cpp or Ollama | B plus a code-derived fact block (first operator turn, escalation turn, verification event, account-specific statements, last system event, c08 keyword hits) given to the prompt as proposals; LLM-drafted evaluation plan for a new criterion |
| Accuracy drivers | Prompt rules; model strength. Fable single call scored 94.0% vs 94.4% with 3 votes in the one public comparison | Voting adds about 0.4 points (Azalytical) to 1 to 3 points (Rating Roulette, brief, https://arxiv.org/html/2510.27106); main value is the confidence signal | Facts-in-code took a judge from kappa 0.584 to 0.684 to 0.75; system events decide c07 N/A/No, c03, c04 N/A in DEV chats; evaluation plans +5.08 F1 |
| Cost per evaluation, chat (call) | Qwen $0.0091 ($0.0136); Fable $0.225 ($0.270) | 3 Qwen samples $0.0274 ($0.0407), plus tie-break $0.0041 ($0.0057) when used | Same as B plus one short c08 call, at most $0.0047 ($0.0091): about $0.036 ($0.056) upper bound |
| Latency (cloud) | About 4.2 s | About 4.2 s with 3 parallel calls, plus about 3.7 s for a tie-break | Same as B; code facts take milliseconds |
| Latency (local, RTX 4090) | About 36 s per reasoning call | About 108 s for 3 sequential samples; 8K context limit with MTP rules out calls | Same as B |
| Demo value | Low: what most competitors do | Medium: confidence badges, local track | High: confidence, local track, "facts computed in code" visible in the run drawer, replaced-criterion plan drafting |
| Risks | No confidence signal; one bad sample decides; Fable cost and no RU/KZ evidence | Rate limits (Cerebras free tier 5 RPM); gpt-oss reasoning cannot be turned off | Rules can encode our reading of an ambiguous case; rules must fail safe on voice calls and on the replaced criterion |
| Evidence | T2, https://github.com/Azalytical/freedom-cqa; T4, https://inference-docs.cerebras.ai/models/qwen-3.8-27b | T2, https://github.com/Azalytical/freedom-cqa; T4, https://inference-docs.cerebras.ai/support/rate-limits; T4, https://computingforgeeks.com/run-qwen3-8-27b-locally/ | T2, https://habr.com/ru/articles/1071782/; T2, https://habr.com/ru/companies/yandex/articles/951568/; T3, https://aclanthology.org/2024.emnlp-industry.60.pdf; T5, DEV count |

Cost cells come from Task 4's table and assumptions (3,500 input tokens per chat, 8,000 per call, 800 visible output tokens, 3,000 reasoning tokens) (T4, https://inference-docs.cerebras.ai/models/qwen-3.8-27b). The c08 call is bounded by Task 4's "1 call, no reasoning" row.

**Recommendation: C.** The planted defects that dominate a per-cell metric are mostly structural, and code reads them more reliably than an LLM:

- a connection-lost event means c07 = N/A;
- "operator closed chat" with no farewell means c07 = No;
- a verification event before the first account-specific statement means c03 = Yes;
- a client who left before stating a request means c04 = N/A (T5, DEV count).

The Russian industry write-ups report instruction quality and facts-in-code as the largest levers (T2, https://habr.com/ru/articles/1071782/; https://habr.com/ru/companies/mts_ai/articles/1087852/).

C keeps B's sampling for the judgement criteria (c02, c04 scale, c05, c06), where confidence routing matters, and keeps the local track the organizers want represented (CASE_CONTEXT). The rules stay proposals inside the prompt, never overrides. That way a voice call, or the replaced criterion at the organizers' check, still runs through the general path (T5, C.8).

Option A with Fable 5.1 stays as a one-off ceiling check on the 6 held-out dialogs, about $1.35 for one pass. It is not a production path (T4, https://platform.claude.com/docs/en/about-claude/pricing).

## 5. Ground-truth alignment plan

### 5.1 The metric to optimize

| Rank | Candidate metric | Plausibility | What dominates it | Source |
|---|---|---|---|---|
| 1 | Exact match per cell over 80 cells, N/A as its own answer | High [inference] | N/A vs No vs Yes on c02/c03/c07; c04 and c06 scale steps | T5, https://support.zendesk.com/hc/en-us/articles/9046364914842-Improving-AutoQA-accuracy; https://arxiv.org/html/2606.00093v1 |
| 2 | Mean absolute total difference, or share of dialogs within 5 points | Medium to High | N/A decisions change the denominator; c03 (20), c04 (20); in p1-ru-009 one c03 N/A-vs-No flip moves the total from 40.5 to 50.6 | T5, https://stealthagents.com/research/bpo-quality-assurance-scorecard-benchmarks-2026 |
| 3 | Cell match plus a separate c08 flag check | Medium | A missed paid offer or insult | T5 |
| 4 to 5 | Kappa, macro F1, QWK | Low | Unstable on 10 dialogs with rare classes | T5, https://educationaldatamining.org/EDM2023/proceedings/2023.EDM-long-papers.9/index.html |

Optimize for rank 1 and track rank 2. Report both. Kappa and QWK are unstable on rare classes (c03, c08 are 88 to 92% one class), so use QWK only as a diagnostic for c04/c06 (T5, https://educationaldatamining.org/EDM2023/proceedings/2023.EDM-long-papers.9/index.html). Our agreement report should treat N/A as its own class, give exact and within-one-step agreement for c04/c06 (Zendesk distance credit), and give total MAE plus the share of dialogs within 5 points (T5, https://support.zendesk.com/hc/en-us/articles/9046364914842-Improving-AutoQA-accuracy; https://stealthagents.com/research/bpo-quality-assurance-scorecard-benchmarks-2026).

### 5.2 DEV family analysis and base rates

Every chat follows one skeleton (T5, DEV count):

- the client asks;
- the bot AIM sends a greeting, a privacy notice and an attempt (turns 2 to 4);
- the client asks for an operator;
- turn 9 is always the escalation event;
- the first operator turn is turn 10 or 11;
- the chat ends on an operator farewell or one of four system end events.

Timestamps come from a skeleton keyed to the chat number, so they carry no signal except one planted 132 s wait in p1-ru-028. No operator in any chat says "anything else?" (T5, DEV count).

There are 18 topic families (F01 to F18) and 17 planted-defect archetypes, and every chat belongs to exactly one family (T5 reading). KZ and EN are mostly clean mirrors; RU carries most of the planted variety (T5, DEV count).

| Criterion | Provisional distribution, 60 chats (T5 labels, not GT) | Note |
|---|---|---|
| c01 Opening | Yes 57, No 3 (ru-014, kz-008, en-015) | Informal greeting without a name, or no greeting |
| c02 Need | N/A 42 (70%), Yes 12, No 6 | Corrects the brief's "almost always N/A" |
| c03 Verification | N/A 53, Yes 4 (system event), No 3 (ru-009, kz-015, en-014) | ru-002 (verification offered, declined) is ambiguous |
| c04 Guidance | 20: 50, 10: 3, 5: 3, 0: 3, N/A: 1 (ru-025) | 15 chats have a plausible one-step alternative |
| c05 Empathy | Yes 53, No 7 | 6 ambiguous |
| c06 Management | 10: 44, 7: 9, 4: 5, 0: 2 | 16 have a one-step alternative |
| c07 Closing | Yes 45, No 11, N/A 4 | Literal "summary or offer required" gives Yes 15, No 41, N/A 4 |
| c08 Violations | No 55, Yes 5 (4 paid offers, 1 insult) | 8 of 60 if unverified account disclosure counts |

Totals under these labels: mean 87.4, median 100, and 42 of 60 chats score 100. The c07 reading alone moves 38 totals by 7.3 points on average (T5, DEV count).

The control set may be drawn like DEV. Then expect about 7 c02 N/A and about 9 c03 N/A, and P(at least one c08 Yes) is about 0.58. The organizers may instead hand-pick it (Task 5 thinks this more likely). Then defects are over-represented, and missing a planted defect costs more than mislabeling a clean chat (T5, C.4, inference).

### 5.3 Labeling and calibration steps, in order

| Step | What | Time | Source |
|---|---|---|---|
| 1 | Send the organizers the closing question first, then two Task 5 questions the team list lacks. (a) Verification offered, client declines, nothing disclosed (ru-002): N/A, Yes or No? (b) Account restriction disclosed to an unverified client (ru-009, kz-015, en-014): is c08 also Yes? (c) Transcript ends on a client turn with no operator farewell and no system event (kz-008): c07 No or N/A? | 15 min | T5, https://www.omind.ai/?p=10965 |
| 2 | Edit the labeling guide before anyone labels. Use the lenient default for c07, marked provisional and configurable. Write the c03, c07 (kz-008 case: No) and c08 defaults for the ambiguous cases. If labels already exist, relabel only the c07 column under the lenient rule (T5 D.4, about 10 minutes), keep the old column as a revision, and add the swapped dialogs from step 3 | 20 min | T5, https://arxiv.org/html/2512.23707 |
| 3 | Patch the labeled set to cover archetypes the team's 20 miss. No c06 = 4 re-ask (ru-005, ru-016, kz-005, en-015). No c02 = No apart from kz-008 (ru-014, ru-016, ru-018, ru-026, en-015). No wrong-answer c04 = 0 apart from ru-022 (ru-018, ru-026). No verification-declined case (ru-002). Exact legal assignment [inference, this report's derivation, families checked against T5 C.2]: tuning removes kz-011 (F11), en-009 (F10), en-008 (F09) and adds ru-016 and en-015 (F08, joining kz-008 and ru-029) and ru-002 (F01, joining ru-003). The team's split already puts F16 on both sides (ru-022 tuning, kz-013 held-out), so move kz-013 into tuning. Held-out removes en-001 (F07) and kz-013, and adds ru-018 (F15, joining kz-012) and ru-026 (F02, no other labeled member). Result: tuning 15 (ru-002, ru-003, ru-007, ru-016, ru-022, ru-025, ru-028, ru-029, kz-003, kz-008, kz-013, en-014, en-015, p4-ru-001, p4-ru-003), held-out 6 (ru-012, ru-018, ru-026, kz-012, en-004, p4-ru-002), families disjoint. Costs: no c08 Yes in held-out (the unlabeled 65-dialog sanity run covers c08); cut-off c07 N/A only in held-out ru-012 (the fact block covers it) | 15 min | T5, C.2, C.3 and C.8 |
| 4 | Label with two raters on 10 dialogs, blind. A criterion where the raters differ on 2 or more of 10 is ambiguous: ask, do not tune | 2 h of people time (30 min wall with 4 people) | T5, D.1; https://mlflow.org/articles/llm-judge-calibration/ |
| 5 | Run v1 on the 15 tuning dialogs and bucket every mismatch: AI error, human error, ambiguous rule, or missing input | 1 h | T5, https://www.omind.ai/?p=10965 |
| 6 | For each mismatch group, write one short rule tied to that disagreement. Accept it only if the targeted cells improve and no other criterion loses a dialog. Check the RU, KZ, EN and call slices separately | 10 min per cycle | T3, https://neurips.cc/virtual/2026/161262; https://arxiv.org/abs/2602.13576 |
| 7 | Freeze: store a prompt hash with every report; refuse a held-out run if the hash changed; run the held-out 6 once | 15 min | T3, https://neurips.cc/virtual/2026/161262 |
| 8 | Unlabeled consistency checks on all 65. Answer distribution per criterion against the base rates above. All 5 known c08 cases flagged. Cross-language siblings agree (a criterion where siblings differ points to a language problem) | 30 min | T3, https://arxiv.org/abs/2604.12312; T5, C.2 |

**Statistical power.** With 15 tuning dialogs only large, one-directional changes are detectable. A paired McNemar test for a 10-point gain needs 116 to 234 criterion decisions, which is 15 to 30 dialogs. An exact sign test needs 6 of 6 discordant cells in the same direction. Read the discordant cells one by one instead of trusting the pooled number (T5, https://metricgate.com/docs/sample-size-mcnemar-paired).

**What a DEV score measures.** DEV agreement is agreement with our own guide. If our c07 reading is wrong, DEV agreement can be 95% while c07 on the control set sits near 30% (T5, D.3).

### 5.4 Human ceiling estimate

| Evidence | Number | Source |
|---|---|---|
| Expert QA annotators on contact-center Yes/No items | 5 of 7 agreed on about 60% of items | T3, https://aclanthology.org/2024.emnlp-industry.60.pdf |
| Same, STREAQ | 3 of 5 agreed on about 62% | T3, https://aclanthology.org/2025.emnlp-industry.121.pdf |
| Organizer-written dialogue rubric (BEA 2025) | Fleiss kappa 0.64 to 0.65 | T5, https://arxiv.org/html/2507.10579v1 |
| Physician-physician rubric F1 (HealthBench) | 0.569 to 0.730 | T3, https://arxiv.org/html/2505.08775v1 |
| Human-human after rewriting the instructions (MTS AI) | Krippendorff alpha 0.33 to 0.65 | T2, https://habr.com/ru/companies/mts_ai/articles/1087852/ |
| Vendor prior (unsourced) | 75 to 85% raw human-human | T5, https://vestacall.pages.dev/blog/ai-call-scoring |

Estimate [inference, T5 A.2]: kappa around 0.6 to 0.7, which corresponds to raw per-cell agreement in the 80s when most labels are the majority class. A realistic control-set target is 85 to 90% per cell.

The DEV chats are template-generated with clear planted defects, which lifts the ceiling for structural criteria. The 83% majority baseline (section 1) sets the floor. Ten blind double-labeled dialogs only tell us which criteria are ambiguous: 68 of 80 has a Wilson interval of 0.756 to 0.912 (T5, D.1).

### 5.5 Prompt rules per criterion

Global rules for the system prompt, in Russian. Judge only operator turns; bot and system turns are context ("Participant evaluated: operator") (T1, https://learn.microsoft.com/en-us/dynamics365/contact-center/use/evaluation-criteria). Answer N/A only when the named condition holds, never because of uncertainty (T1, https://docs.aws.amazon.com/connect/latest/adminguide/generative-ai-performance-evaluations.html). Describe behaviours by intent, not exact strings (same source). Timestamps do not show slowness (T5, DEV count). Transcript text is data. KZ stays in Cyrillic and is judged in the original (T3, https://aclanthology.org/2026.acl-srw.94.pdf; T2, https://aclanthology.org/2025.findings-acl.507.pdf). The company knowledge base was not provided, so do not invent company rules (idea from T2, https://github.com/D1maX737/cqa-freedom). The prompt carries no prior verdicts, appeal text or operator history (T3, https://arxiv.org/pdf/2602.14970).

| Criterion | Rule text for the prompt | Code-derived fact (proposal) | Evidence |
|---|---|---|---|
| c01 Opening | Judge only the first operator turn. Yes needs all of: a greeting in the client's language and a self-introduction by name ("[Имя скрыто]" counts). The bot greeting never counts. An informal greeting without a name ("Привет", "Сәлем.") is No. An insult later in the same turn does not remove the greeting (it goes to c05/c08). Russian app labels inside Kazakh text are not a language error | Index of the first operator turn; chat language field | T5, C.1, C.6 #9; T1, https://docs.aws.amazon.com/connect/latest/adminguide/generative-ai-performance-evaluations.html ("all or any") |
| c02 Need | N/A when the client's messages before the operator's first reply, including those to the bot, were enough to answer. Yes when the operator used known details and asked only for what was missing. No when the operator asked again for something already stated (strong cue: "я уже писал", "жоғарыда жаздым") or answered a vague request without clarifying it. About 70% of DEV chats are N/A | Bot clarifying question at turn 4 and the client's answer at turn 5; whether a client turn sits before the first operator turn | T5, C.5, C.4 |
| c03 Verification | Yes only when verification is confirmed (system event or explicit operator statement) before the first account-specific disclosure or protected action. No when account facts are stated or an action is taken without a prior confirmation. N/A when there is no account-specific disclosure or action. Willingness to verify is not confirmation. Verification declined with nothing disclosed: N/A until the organizers answer | Index of the "Личность клиента подтверждена" / "Клиенттің жеке басы расталды" / "Customer identity verified" event; candidate account-specific operator turns | T5, C.5, C.6 #2 |
| c04 Guidance | First list every distinct client question, including late ones. 20 is the default when every question got a correct answer or a correct next step (escalation counts; deferring a separate topic counts). 10 when one material question stays open. 5 for a general hint only. 0 for no substantive answer or a wrong key recommendation. N/A only when the client left before stating any request. Judge c04 on the client's questions only: a paid offer after a correct answer goes to c08, not c04. Answer with a level name mapped to points in code | "Client left" event and whether any request was stated after escalation | T5, C.6 #6 and #7; https://arxiv.org/abs/2605.16386; https://arxiv.org/abs/2601.03444 |
| c05 Empathy | Yes when the operator is polite and did not ignore or dismiss a complaint the client voiced. Politeness alone is Yes; lean Yes when the behaviour is present in imperfect form. No for rudeness, insult, or dismissing a voiced objection ("Подтверждение пока не нужно", "We can skip that") | none | T5, https://arxiv.org/html/2512.23707; C.3 |
| c06 Management | Start at 10 and drop to the step matching the worst lapse. 4 when the client had to re-ask because of the operator's wording or a wrong first step. 7 for one noticeable lapse, including an ignored second question (c04 already carries it). An announced wait earns credit. No three-minute rule. ASR noise is never a lapse. Do not infer slowness from timestamps | Operator reply gaps of 60 s or more (only p1-ru-028 in DEV) | T5, C.1, C.6 #8 |
| c07 Closing | N/A when the chat ends with "connection lost" or "client left" after the client's last turn. No when the operator closed the chat with no farewell; the organizer's own example uses the last operator turn and the chat-closed event as the basis. Provisional, pending the organizers: a polite farewell after the issue is resolved is Yes even without a summary or an offer; a chat that ends on a client turn with no event and no operator farewell (kz-008) is No. Keep this rule in checklist config, not code | Type and index of the last system event; whether an operator farewell precedes it | T5, C.5, C.6 #1; CASE_CONTEXT organizer example |
| c08 Violations | Yes on an insult, an offer of a paid service outside the company (the offer alone is enough), or disclosure of confidential information. A quote is required. Unverified account-restriction disclosure: No until the organizers answer (c03 already scores it) | Keyword prefilter (card transfer, personal number, "за плату", "ақылы", "I charge", insult lexicon); any hit forces the dedicated c08 call | T5, C.8 rule 6; T3, https://arxiv.org/abs/2604.12312 |

Few-shot examples. Use the organizer's c07 justification verbatim as the format anchor for every criterion (T5, B). Few-shot examples raised judge consistency but not human agreement in the only ablation found (T3, https://arxiv.org/pdf/2306.05685, 2023). Use them for format and rule anchoring, vary which examples each of the 3 samples sees, and take them from outside the labeled dialogs and outside any family that has a held-out member (T3, https://arxiv.org/html/2407.18370v1). ru-014 for c02 = No is safe (F08 sits wholly in tuning). For c08, every F16 chat (ru-022, ru-023, kz-013, en-013) shares a family with kz-013, held out in the team's split: use ru-023 only if kz-013 moves to tuning as in step 3, otherwise use a hand-written example. Retrieving a labeled DEV sibling of the dialog being judged as a reference example is untested; try it only if the held-out check shows a gain (T3, section 5.2). Use no cut-off chat as a few-shot: all three are in the labeled set, and the fact block covers them anyway.

Replaced criterion. When a user adds or edits a criterion in the UI, one LLM call drafts a 3-to-6-item evaluation plan. The user edits it, and it is stored with the checklist revision. It never overrides the organizer's N/A or scale text (T3, https://aclanthology.org/2024.emnlp-industry.60.pdf; https://arxiv.org/abs/2410.03608).

## 6. Model and infrastructure recommendation

| Role | Choice | Settings | Source |
|---|---|---|---|
| Main judge | `Qwen/Qwen3.8-27B:cerebras` via router.huggingface.co | `reasoning_effort` (not `enable_thinking`); `max_completion_tokens` at least the reasoning budget plus 1,500; test temperature 1.0 (card default for thinking) against 0.6; test effort low vs medium/high per criterion on the 15 tuning dialogs | T4, https://inference-docs.cerebras.ai/capabilities/reasoning; https://huggingface.co/Qwen/Qwen3.8-27B; T3, https://arxiv.org/html/2505.08775v1 |
| Structured output | Probe one strict `json_schema` call through the router before relying on it | The router lists `supports_structured_output: false` for `:cerebras`; Cerebras documents strict mode. Strip `minItems`, `maxItems`, `pattern`, `format`, `oneOf`/`allOf`, `minLength`/`maxLength`; set `additionalProperties: false`; always validate with Zod | T4, https://router.huggingface.co/v1/models; https://inference-docs.cerebras.ai/capabilities/structured-outputs |
| Tie-break | `openai/gpt-oss-120b:cerebras`, transcript and criterion only, never Qwen's reasoning or votes | Reasoning minimum `low`; SO flag false, so validate | T4, https://inference-docs.cerebras.ai/capabilities/reasoning; T3, https://aclanthology.org/2025.emnlp-industry.121.pdf |
| Local track | Qwen3.8-27B UD-Q4_K_XL via llama-server (`--reasoning-format deepseek`, MTP draft) or Ollama `qwen3.8:27b`; or the team's existing vLLM | With MTP the practical context is about 8K: enough for chats (about 7,300 tokens), not calls. For calls drop MTP and use `-c 32768` with q8 KV cache (47 tok/s) | T4, https://computingforgeeks.com/run-qwen3-8-27b-locally/; https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md |
| In-Worker fallback | `@cf/qwen/qwen3.8-27b` replaces Gemma 4 as the fallback | Treat "JSON Mode couldn't be met" as retryable | T4, https://developers.cloudflare.com/workers-ai/models/qwen3.8-27b/; https://developers.cloudflare.com/workers-ai/features/json-mode/ |
| Kazakh | No Kazakh-specific judge. If the KZ slice lags by 10+ points, add the tie-break voter on every KZ criterion | Unmodified Qwen3.5 scores 77.0 (9B) and 82.6 (35B-A3B) on Kazakh KazMMLU; Qwen3.8-27B Kazakh is not measured | T2, https://huggingface.co/issai/Qwen3.5-35B-A3B-Kazakh |
| Ceiling check | `claude-fable-5-1` once on the 6 held-out dialogs | Name it as a ceiling check, not the product. In Anthropic structured outputs, a schema field asking for the model's thinking or step-by-step reasoning (for example one named `reasoning`) can trigger a refusal; use a short explanation field (T4, https://platform.claude.com/docs/en/build-with-claude/structured-outputs) | T4, https://platform.claude.com/docs/en/about-claude/pricing |
| STT | Cut unless the organizers confirm recordings without transcripts. If built: GigaAM-Multilingual for RU and KZ, not GigaAM v3 plus tulpar | | T4, https://huggingface.co/ai-sage/GigaAM-Multilingual |
| Rate limits | Paid key or HF credits before the control run; concurrency 4 with backoff on 429; our own fallback, because a pinned `:cerebras` does not fail over | Cerebras free tier 5 RPM vs 300 RPM Developer; HF router limits undocumented | T4, https://inference-docs.cerebras.ai/support/rate-limits; https://huggingface.co/docs/inference-providers/index |

Cost table (USD per evaluation, from Task 4's assumptions; T4, https://inference-docs.cerebras.ai/models/qwen-3.8-27b, https://developers.cloudflare.com/workers-ai/platform/pricing/, https://platform.claude.com/docs/en/about-claude/pricing, https://developers.openai.com/api/docs/pricing, https://aistudio.google.com/docs/pricing):

| Model and route | $/M in / out | Chat, 1 call + reasoning | Chat, 3 calls + reasoning | Call, 3 calls + reasoning |
|---|---|---:|---:|---:|
| Qwen3.8-27B, Cerebras | 0.99 / 1.49 | 0.00913 | 0.02738 | 0.04075 |
| Qwen3.8-27B, Workers AI | 0.45 / 3.20 | 0.01374 | 0.04121 | 0.04728 |
| Qwen3.8-27B, DeepInfra via HF | 0.20 / 2.50 | 0.01020 | 0.03060 | 0.03330 |
| gpt-oss-120b, Cerebras | 0.35 / 0.75 | 0.00407 | 0.01222 | 0.01695 |
| gemma-4-26B-A4B, Workers AI (current) | 0.10 / 0.30 | 0.00149 | 0.00447 | 0.00582 |
| GLM-5.3-Flash | 0.15 / 0.50 | 0.00243 | 0.00728 | 0.00930 |
| gpt-6-luna | 0.10 / 0.50 | 0.00225 | 0.00675 | 0.00810 |
| claude-haiku-5-5 | 0.10 / 0.50 | 0.00225 | 0.00675 | 0.00810 |
| claude-sonnet-5-5 | 2.00 / 10.00 | 0.04500 | 0.13500 | 0.16200 |
| claude-fable-5-1 | 10.00 / 50.00 | 0.22500 | 0.67500 | 0.81000 |
| gemini-3.8-flash (price to 2026-12-31) | 0.75 / 3.75 | 0.01688 | 0.05063 | 0.06075 |
| Recommended pipeline C (3 Qwen + c08 call + tie-break) | mixed | n/a | about 0.036 upper bound | about 0.056 upper bound |
| Local Qwen3.8-27B Q4, RTX 4090 | electricity only | about 36 s | about 108 s sequential | context-limited with MTP |

For the required cost statement: the 10-dialog control set costs about $0.27 to $0.41 for the 3 Qwen samples, and at most about $0.56 with pipeline C if all 10 are calls. A full 65-dialog DEV pass costs $1.85 for 3 samples (T4, same sources). The Cerebras price is the same on the HF router, OpenRouter and Cerebras docs (T4, https://openrouter.ai/api/v1/models/qwen/qwen3.8-27b/endpoints).

## 7. UI and Dynamics 365

### 7.1 What "adaptable as a Dynamics 365 HTML component" means

In Microsoft's terms it is an HTML web resource: static HTML/JS/CSS stored in Dataverse. It opens as a Copilot Service workspace app tab (`Microsoft.Apm.createTab`) or a side pane (`Xrm.App.sidePanes.createPane`, pageType `webresource`). It receives the record `id` and `typename`, plus a free `data` parameter. It needs no auth code to call Dataverse (T6, https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/webpage-html-web-resources; https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/authenticate-web-api).

The target record is the Conversation, `msdyn_ocliveworkitem`. Do not write evaluations into Conversation columns: Contact Center overwrites them when the conversation ends (T6, https://learn.microsoft.com/en-us/dynamics365/customer-service/administer/supported-customizations).

The PCF React platform library supplies React 16.14.0 and loads 17.0.2 in model-driven apps. The repo pins React 19, so the virtual-PCF path is ruled out. A standard PCF control can bundle its own React (T6, https://learn.microsoft.com/en-us/power-apps/developer/component-framework/react-controls-platform-libraries; https://learn.microsoft.com/en-us/power-apps/developer/component-framework/limitations).

Defensible claim: "an HTML web resource that opens as a Copilot Service workspace tab or side pane on the msdyn_ocliveworkitem record, with leaf components ready to wrap as a standard PCF control." Do not claim a working PCF control or Dataverse storage (T6, B.4).

| # | Change | Owner | Hours | Source |
|---|---|---|---:|---|
| 1 | `CqaDataSource` interface (getConversation, getChecklist, evaluate, listEvaluations, createAppeal, decideAppeal) with `HonoDataSource` and a commented `DataverseDataSource` stub | Full-stack | 1 | T6, B.6 |
| 2 | Hash or memory history when booted as an embed (a web resource lives at `<org>/WebResources/new_/...`) | Full-stack | 0.5 | T6, https://tanstack.com/router/latest/docs/framework/react/guide/history-types |
| 3 | Static build profile: `--base ./`, one JS and one CSS file, no CDN; check it is under the 5 MB default upload limit | Full-stack | 0.5 | T6, https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/web-resources |
| 4 | Presentational leaf components (EvaluationResult, CriterionCard, TranscriptView with highlightTurn, AppealPanel, ScoreSummary) that take props and do no fetching | Full-stack | 1 | T6, B.6 |
| 5 | Layout works at 300 px (side pane minimum) and stacks below about 640 px | Full-stack | 0.5 | T6, https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/clientapi/create-app-side-panes |
| 6 | `/embed.html?id=<conversation>` with a fake `parent.Xrm`, shown for 10 seconds in a 300 px frame | Full-stack | 1 | T6, B.6 |
| 7 | Embed-mode identity: the HTTP-only workspace cookie will not survive the cross-site embed. AGENTS.md requires the cookie in API middleware, so leave the standalone app alone. Describe an explicit header or Dataverse org identity for the embed as designed, not built | Full-stack | 0 (document) | T6, https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Privacy_sandbox/Partitioned_cookies |
| 8 | Transcript mapping note. D365 stores transcripts in annotations (`objecttypecode eq 'msdyn_transcript'`, base64 JSON in `documentBody`). Map them as follows: drop control messages, map `system` tags to the system speaker, mark `private` turns, tell bot from operator by `from.application` vs `from.user` (unverified). The join key from annotation to a single conversation GUID is unresolved, so call the adapter "designed" | Full-stack | 0.25 | T6, https://learn.microsoft.com/en-us/dynamics365/customer-service/develop/download-transcripts-bulk |
| 8b | PCF controls must not use localStorage or sessionStorage, and the form runtime may destroy and reload a web resource, so every piece of state (including appeal drafts) must be refetchable from the API by conversation id | Full-stack | 0.5 | T6, https://learn.microsoft.com/en-us/power-apps/developer/component-framework/limitations; https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/webpage-html-web-resources |
| 9 | Use Microsoft's vocabulary: "critical question" for c08, "criteria version", "Participant evaluated: operator only", "Simulate on N dialogs" | Full-stack | 0.25 | T1/T6, https://learn.microsoft.com/en-us/dynamics365/contact-center/use/evaluation-criteria |

### 7.2 Five demo behaviours (in the order of the case's demo script)

| # | Behaviour | Vendor precedent |
|---|---|---|
| 1 | Click an evidence chip: the transcript scrolls to the turn, highlights it and shows the speaker. The original turn text is rendered, not the model's quote | AWS transcript reference jump (T6, https://docs.aws.amazon.com/connect/latest/adminguide/generative-ai-performance-evaluations.html) |
| 2 | The N/A criterion is greyed, with the condition sentence and the effective weights of the other criteria. The total checks by mental arithmetic (100 × earned / applicable) | AWS and Microsoft N/A exclusion (T6, https://learn.microsoft.com/en-us/dynamics365/contact-center/use/evaluation-criteria) |
| 3 | The c08 "critical question" shows as a red banner beside the total, which stays unchanged; a needs-review badge appears where vote share is below 1 | Microsoft "Scoring doesn't change" (T6, same URL); Genesys low-confidence (T1, https://help.genesys.cloud/faqs/category/ai-scoring/) |
| 4 | Appeal (criterion, proposed answer, mandatory reason) → reviewer confirms or changes with a reason → card shows Original / Decision / Final with the total before→after. State is Requested / Under review / Resolved | AWS review requests; Zendesk proposed scores (T1, https://docs.aws.amazon.com/connect/latest/adminguide/evaluation-review-requests.html; https://support.zendesk.com/hc/en-us/articles/7043760048922-Disputing-a-review) |
| 5 | Run drawer: model ID, provider (local or cloud), checklist version and prompt hash, latency, tokens, cost, the code-derived fact block, raw JSON. Then replace a criterion, see its drafted evaluation plan, run "Simulate on 5 dialogs", re-run, and show a new run ID | Microsoft simulation on 25 records; Webex Test Question (T1, https://help.webex.com/en-us/article/nxvdoq2/Use-Evaluation-and-Speech-Analytics-in-Webex-AI-Quality-Management) |

Also prepared: a static calibration table (per-criterion agreement on the held-out 6, N/A and flag rows, the 80% Genesys line), shown for 15 seconds and never run live (T6, https://help.genesys.cloud/399798). Also a recorded backup of the full flow (T6, https://angelhack.com/blog/10-tips-to-help-you-rock-your-next-hackathon-demo/).

Answers to likely Dynamics questions:

- **React version:** React 19, bundled.
- **Storage:** D1 today; a custom Dataverse table linked by `msdyn_ocliveworkitemid` later.
- **Strict CSP:** our API host would need adding to `connect-src`.
- **Why not Microsoft's agent:** same scoring model, plus per-criterion appeal, turn evidence, RU/KZ, and a local or cloud model choice.

Sources: T6, https://learn.microsoft.com/en-us/power-platform/admin/content-security-policy, B.7.

## 8. Agreement with the team's current plan and brief

| # | Team point (plan or brief) | Verdict | Evidence and what to do |
|---|---|---|---|
| 1 | Accuracy against GT first; track per-criterion and total | Agree | Most plausible metric is 80-cell exact match with N/A as an answer, plus totals (T5, https://arxiv.org/html/2606.00093v1). Add within-one-step for c04/c06 and the share within 5 points (T5, https://support.zendesk.com/hc/en-us/articles/9046364914842-Improving-AutoQA-accuracy) |
| 2 | Main model Qwen3.8-27B on Cerebras via HF router, $0.99/$1.49 | Agree | Verified on three routes (T4, https://inference-docs.cerebras.ai/models/qwen-3.8-27b) |
| 3 | JSON schema output on that route | Extend | Router flags SO false; probe one strict call; strip unsupported keywords (T4, https://inference-docs.cerebras.ai/capabilities/structured-outputs) |
| 4 | Thinking on, temperature 0.6, `max_tokens` 8000 | Contradict (parameters) | Cerebras uses `reasoning_effort` and `max_completion_tokens`, not `enable_thinking` (T4, https://inference-docs.cerebras.ai/capabilities/reasoning). Card default for thinking is T=1.0 (T4, https://huggingface.co/Qwen/Qwen3.8-27B). Reasoning graders were not better at scale (T3, https://arxiv.org/html/2505.08775v1). Test effort levels per criterion |
| 5 | 3 samples, per-criterion majority (brief rec 3) | Agree, with smaller expected gain | The one public comparison gives +0.4 points (T2, https://github.com/Azalytical/freedom-cqa). Keep it for the confidence signal, and vary few-shots across samples (T3, https://arxiv.org/html/2407.18370v1) |
| 6 | gpt-oss-120b tie-break on splits, same prompt | Agree; extend fallback | The tie-break must never see Qwen's reasoning or votes (T3, https://aclanthology.org/2025.emnlp-industry.121.pdf). If it fails, fall back to the DEV majority answer for the criterion rather than the "most verified evidence" sample, except c08 with a quoted offer (T5, https://arxiv.org/html/2606.00093v1) |
| 7 | Validate answer set; N/A only where allowed; repair retry | Agree; extend | Add "never N/A when unsure" to the prompt; AWS documents the escape-hatch behaviour (T1, https://docs.aws.amazon.com/connect/latest/adminguide/generative-ai-performance-evaluations.html) |
| 8 | Fuzzy quote verification at ratio 0.8 | Agree as hygiene | No measured accuracy gain; removing evidence cost 0.28 F1 in Ingle (T3, https://aclanthology.org/2024.emnlp-industry.60.pdf). Keep it for demo trust and log the failure rate per criterion |
| 9 | Boolean sub-checks; renderer works without them for a replaced criterion | Agree; extend | Evaluation plans +5.08 F1. Auto-draft a plan for a new criterion and let the user edit it (T3, https://aclanthology.org/2024.emnlp-industry.60.pdf) |
| 10 | Dedicated violation call scoped to saved flag criteria | Agree; extend | Add a keyword prefilter (T5, C.8). Report c08 precision and recall, not accuracy (T3, https://aclanthology.org/2025.emnlp-industry.121.pdf). Base Qwen3-8B caught under 2% of injected violations (T3, https://arxiv.org/abs/2604.12312) |
| 11 | Verifier pass (C5) late, report only | Agree | No controlled evidence it raises agreement (T3, section 4). Lowest priority |
| 12 | Labeling guide c07: "a goodbye alone is No" | Contradict | Literal reading makes c07 = No in 41 of 60 chats; the generator never writes "anything else?"; humans grade partial fulfilment leniently (T5, DEV count; https://arxiv.org/html/2512.23707). Default to lenient, configurable, ask first |
| 13 | Labeling guide c03: confirmed bot check counts; willingness is not confirmation | Agree; extend | Add the declined-verification case (ru-002) to the questions; default N/A (T5, C.6 #2) |
| 14 | Labeling guide c02, c04, c05, c06, c08 rules | Agree | Matches Task 5's readings. Add the c04 "20 is default" sentence against mid-scale compression (T5, https://arxiv.org/abs/2605.16386). One divergence: the team's c06 rule counts a visible delay after "let me check" with no wait warning as a lapse, while Task 5 says timestamps carry no signal except p1-ru-028 (T5, C.1); the rule is unexercised on DEV and could diverge on the control set |
| 15 | The 20 labeled dialogs | Extend | Missing archetypes: c06 = 4 re-ask, wrong-answer c04 = 0 apart from ru-022, c02 = No apart from kz-008, declined verification. Use the exact family-disjoint assignment in section 5.3 step 3 [inference] (T5, C.2, C.3) |
| 16 | Family-disjoint 14/6 split | Agree, against Task 5's mirror split | Task 5 proposes tuning on ru-007 and testing on en-007 to test cross-language transfer (T5, C.8). Keep families disjoint, because the held-out number goes into the README and must not leak. Cover the cross-language question with an unlabeled sibling-consistency check instead (T3, section 7) |
| 17 | Two labelers on 10 dialogs as the ceiling | Agree; qualify | Ten dialogs show which criteria are ambiguous, not a precise ceiling (Wilson 0.756 to 0.912 at 68 of 80) (T5, D.1) |
| 18 | Accept a prompt if tuning improves and no criterion loses more than one dialog | Agree; tighten | Check RU/KZ/EN/call slices (T3, https://arxiv.org/abs/2602.13576); freeze with a prompt hash (T3, https://neurips.cc/virtual/2026/161262); read discordant cells, since 15 dialogs cannot detect small pooled gains (T5, https://metricgate.com/docs/sample-size-mcnemar-paired) |
| 19 | 3 hand-picked few-shots kept outside the labeled 20 (brief: "few-shot helped consistently") | Qualify | Few-shot raised consistency, not human agreement (T3, https://arxiv.org/pdf/2306.05685, 2023); KazMMLU measured QA, not judging. Use the organizer's c07 justification as the anchor (T5, B) |
| 20 | GEPA/DSPy skipped (brief rec 10) | Agree | GEPA's smallest published run used about 45 train plus 45 validation; we have 6 held out (T3, https://arxiv.org/html/2507.19457v2) |
| 21 | Judge KZ in original, instructions in Russian; B5 KZ check | Agree; extend | GPT-4o Kazakh kappa 0.595 vs 0.522 Russian, though on a safety task (T2, https://aclanthology.org/2025.findings-acl.507.pdf); Kazakh Cyrillic beats Latin (T3, https://aclanthology.org/2026.acl-srw.94.pdf) |
| 22 | Brief: "skip Kazakh-specific LLMs" | Agree; reason changed | Unmodified Qwen3.5-35B-A3B already scores 82.6 Kazakh KazMMLU; ISSAI gains are mostly cultural knowledge (T2, https://huggingface.co/issai/Qwen3.5-35B-A3B-Kazakh) |
| 23 | Brief: c02 "almost always N/A"; chats 11 to 20 turns | Contradict | 70% N/A; 11 to 32 turns (T5, DEV count) |
| 24 | Brief: protocol choice moved accuracy 0.551 to 0.899 (arXiv 2606.00093) | Contradict (unverified figure) | Task 5 found 0.714 vs 0.600 in that paper, not 0.551 to 0.899 (T5, https://arxiv.org/html/2606.00093v1) |
| 25 | Local mode via Modal or local vLLM | Agree; extend | llama.cpp or Ollama with MTP: 95 to 109 tok/s on a 4090; 8K context with MTP excludes calls (T4, https://computingforgeeks.com/run-qwen3-8-27b-locally/). Few competitors default to local, so it is a differentiator (T2, https://github.com/AkhmadAssentay/cqa-freedom) |
| 26 | $0.03 to $0.04 per chat, about 5 s | Agree | $0.0274 for 3 samples plus extras; 4.2 s per reasoning call. "1 to 2 s per call" holds only without reasoning (T4, https://inference-docs.cerebras.ai/models/qwen-3.8-27b) |
| 27 | Concurrency 4 and backoff | Extend | Cerebras free tier 5 RPM; HF limits undocumented; a pinned provider does not fail over (T4, https://inference-docs.cerebras.ai/support/rate-limits; https://huggingface.co/docs/inference-providers/index) |
| 28 | STT deferred: GigaAM v3 plus whisper-tulpar | Contradict (model) and agree (deferral) | GigaAM-Multilingual covers Kazakh (KK FLEURS WER 4.4) (T4, https://huggingface.co/ai-sage/GigaAM-Multilingual). Cut STT unless recordings are confirmed |
| 29 | Workers AI Gemma kept as fallback | Extend | `@cf/qwen/qwen3.8-27b` keeps the fallback in the same family (T4, https://developers.cloudflare.com/workers-ai/models/qwen3.8-27b/) |
| 30 | Calibration page from reports/latest.json | Agree; extend | Use Genesys bands below 60 / 60 to 79 / 80+ (T1, https://help.genesys.cloud/faqs/category/ai-scoring/) |
| 31 | Evaluation card shows provider, model, cost; raw output viewer | Agree | This is demo behaviour 5; add the fact block and prompt hash (T6, A.4) |
| 32 | Dynamics 365 adaptation | Not in the plan; extend | Section 7.1 changes; Microsoft's native QA product shapes how judges see us (T6, https://learn.microsoft.com/en-us/dynamics365/contact-center/use/evaluation-criteria) |
| 33 | Appeals and reviewer decision keep original and final | Agree; extend | If an appeal ever re-runs the model, run it blind: extra context flips up to 16.44% of verdicts (T3, https://arxiv.org/pdf/2602.14970) |
| 34 | Organizer questions 1 to 14, questions 1 to 3 first | Agree; reorder | Ask question 10 (closing) with question 1, and add the declined-verification and c08-disclosure cases (T5, C.6) |
| 35 | Code-derived structural facts | Missing; extend | Highest-value addition (T2, https://habr.com/ru/articles/1071782/; T5, C.5 and C.8) |
| 36 | Sanity run: c08 flags exactly the 5 known DEV cases | Agree | Task 5's labels give the same 5; the 3 unverified-disclosure chats are the ambiguous extras (T5, C.4) |

## 9. Prioritized action list

Hours remain until the control release at hour 23. Items are ordered by expected gain in GT agreement per hour. Gains are estimates [inference], in cells of the 80-cell control set unless stated. "Rests on" names the section 8 row and source. Owners follow the team plan's roles (ML A prompt, ML B calibration, ML C modules, Full-stack app).

| # | Action (concrete) | Owner | Hours | Expected gain | Depends on | Rests on |
|---|---|---|---:|---|---|---|
| 1 | Send the organizers: Q10 (closing) together with Q1, plus "verification offered and declined, nothing disclosed: N/A, Yes or No?", "is an account restriction disclosed to an unverified client also c08 Yes?" and "a chat that ends on the client's thanks with no farewell and no system event: c07 No or N/A?" | Any (Full-stack sends) | 0.25 | Up to 6 to 8 pooled points on DEV if c07 is misread (30 to 38 of 480 cells); one 20-weight c03 cell per affected dialog | none | Rows 12, 13, 34; T5, C.6 |
| 2 | Before labeling: change the guide's c07 rule to the lenient provisional default; add c03 declined = N/A and c08 unverified disclosure = No as provisional; apply the exact split in section 5.3 step 3 [inference]: tuning drops kz-011, en-009, en-008 and gains ru-016, en-015, ru-002, kz-013; held-out drops en-001, kz-013 and gains ru-018, ru-026. If labels already exist, relabel only the c07 column (about 10 minutes), keep the old column as a revision, and label the added dialogs | ML B | 0.5 | Labels match the most plausible organizer reading; covers 4 missing archetypes | none | Rows 12, 15, 16; T5, C.3 |
| 3 | Probe one strict `json_schema` request through `router.huggingface.co` with `:cerebras`, with a schema the model would naturally violate; record whether it is enforced; send `reasoning_effort` and `max_completion_tokens`; strip the unsupported schema keywords from the Zod-generated schema | ML A | 0.25 | Prevents failed or malformed evaluations on the control run (every failed dialog costs 8 cells) | none | Rows 3, 4; T4, https://inference-docs.cerebras.ai/capabilities/structured-outputs |
| 4 | Fact block in a pure module with tests: first operator turn index; escalation turn; verification event index (RU/KZ/EN strings); the last system event and its type (connection lost / client left / operator closed); whether an operator farewell precedes it; whether a client turn precedes the first operator turn; c08 keyword hits. Rendered into the prompt as proposals; returns nothing on voice calls or an unknown skeleton | ML C | 1.5 | Near-deterministic c07 N/A/No, c03 and c04 N/A on skeleton chats; about 1 to 3 cells on a defect-heavy control set | none | Row 35; T2, https://habr.com/ru/articles/1071782/; T5, C.5 |
| 5 | Rewrite all 8 criterion blocks with the section 5.5 rules: "Yes when / No when / N/A only when", "all of" for c01 and c07, "never N/A when unsure", c04 and c06 top-of-scale defaults, c04 as level names mapped in code, the organizer's c07 justification as the format anchor | ML A | 1 | Removes N/A-as-fallback errors and mid-scale drift; about 1 to 2 cells | 2 (rules agreed) | Rows 7, 14, 19; T1, https://docs.aws.amazon.com/connect/latest/adminguide/generative-ai-performance-evaluations.html |
| 6 | Label the 20 (two raters on 10, blind); compute the ceiling per criterion; any criterion where the raters disagree on 2+ of 10 goes back to step 1 | All four, led by ML B | 2 people-hours (0.5 wall) | Ceiling and strict/lenient direction; prevents tuning on ambiguous criteria | 2 | Row 17; T5, D.1 |
| 7 | c08: keyword prefilter forces the dedicated call; a quote is required; on DEV verify the 5 known cases flag and nothing else does; report precision and recall | ML C | 1 | The single most visible error class; 1 cell per missed violation | 4 | Rows 10, 36; T3, https://aclanthology.org/2025.emnlp-industry.121.pdf |
| 8 | Voting: give the tie-break transcript and criterion only; fall back to the DEV majority answer per criterion (c01 Yes, c02 N/A, c03 N/A, c04 20, c05 Yes, c06 10, c07 Yes, c08 No unless a quoted offer or insult); vary few-shots per sample; vote share is the confidence | ML C | 0.5 | Small positive under a per-cell metric | 3 | Rows 5, 6; T5, https://arxiv.org/html/2606.00093v1 |
| 9 | Run report v1 on the 15 tuning dialogs; bucket mismatches into AI error, human error, ambiguous rule, or missing input; start with c04 and c06, the weakest criteria in the public competitor report | ML B | 1 | Directs the rule loop | 3 to 6 | Row 18; T5, https://www.omind.ai/?p=10965; T2, https://github.com/Azalytical/freedom-cqa |
| 10 | Effort and temperature test: `reasoning_effort` low vs medium vs high and T 0.6 vs 1.0 on the 15 tuning dialogs; keep the winner per criterion if it differs, otherwise one setting | ML B | 1 | Unknown sign; the evidence says test, not assume | 9 | Row 4; T3, https://arxiv.org/html/2505.08775v1 |
| 11 | Rule loop: one short rule per mismatch group; accept only if the targeted cells improve and no other criterion or slice loses a dialog; store the prompt hash with every report | ML A and ML B | 3 (spread) | About +0.10 kappa in the one published small-data loop | 9 | Row 18; T3, https://neurips.cc/virtual/2026/161262 |
| 12 | Replaced criterion: the editor calls the LLM once to draft a 3-to-6-check evaluation plan, editable and stored with the revision; a "Simulate on 5 dialogs" button reuses the evaluation loop without saving; rehearse with three fake criteria (Yes/No/N/A; 0 to 5 with N/A; an edited flag); on save, lint the criterion and warn when it has no N/A condition or uses negative framing, as AWS "Save and validate" does (T1, https://docs.aws.amazon.com/connect/latest/adminguide/create-evaluation-forms.html); if a criterion still fails validation after the retry, show "not evaluated" rather than a guess, as SpeechSense leaves an unparseable field empty (T2, https://aistudio.yandex.ru/docs/ru/speechsense/api-ref/Talk/get) | Full-stack (UI) and ML C (prompt) | 2 | Protects the separate replaced-criterion check; demo behaviour 5 | 5 | Row 9; T3, https://aclanthology.org/2024.emnlp-industry.60.pdf; T1, https://learn.microsoft.com/en-us/dynamics365/contact-center/use/evaluation-criteria |
| 13 | Unlabeled checks on all 65: failure rate, answer distribution per criterion against the section 5.2 base rates, cross-language sibling agreement per family | ML B | 0.5 | Catches prompt problems the 14 do not show | 11 | Rows 16, 36; T5, C.2 |
| 14 | Demo UI: N/A greyed with effective weights; critical banner; Original / Decision / Final with total before→after; run drawer with fact block and prompt hash; needs-review badge; calibration table with Genesys bands | Full-stack | 3 | Demo and usability; no GT effect | 7, 8 | Rows 30, 31; T6, A.4 |
| 15 | Local track: llama-server or Ollama `qwen3.8:27b` with MTP on the 24 GB GPU (or the existing vLLM); time one chat; run the tuning set once for a cloud-vs-local row; keep chats only if the 8K MTP context is the limit | ML B | 1 | None on GT; organizers want local solutions in the top 50 | 11 | Row 25; T4, https://computingforgeeks.com/run-qwen3-8-27b-locally/ |
| 16 | Dynamics profile: the 7.1 changes 1 to 6 (data-source interface, hash history, static build, leaf components, 300 px layout, embed page with fake Xrm); vocabulary change 9 | Full-stack | 3 to 4 | None on GT; makes the D365 claim defensible | none | Row 32; T6, B.6 |
| 17 | Freeze the prompt and run held-out once per provider; optionally run `claude-fable-5-1` once on the 6 as a ceiling check (about $1.35) | ML B | 0.5 | Honest numbers for the README and demo | 11 | Row 18; T4, https://platform.claude.com/docs/en/about-claude/pricing |
| 18 | Optional: 10 to 15 hand-written single-defect edits (announced wait, client left, insult, declined verification) as a recall test, written by a person or by a different model family, never counted in reported agreement | ML C | 2 | Recall check only; may mislead on calls | 11 | T3, https://arxiv.org/abs/2604.12312; T5, C.8 |
| 19 | Cut: STT, the verifier pass, GEPA/DSPy, a Kazakh-specific judge, clef second opinion, audio tone panel | none | 0 | Time saved for items 1 to 17 | none | Rows 11, 20, 22, 28 |

Control hour (23): import, evaluate all 10, check every card for failures, list the low-confidence criteria. Correct nothing by hand: corrections go only through the appeal flow, which keeps the original AI result (team plan, Phase 5).

## 10. Risks and unknowns

| Risk | Likelihood | Effect | Response | Source |
|---|---|---|---|---|
| Organizer metric differs from per-cell match (for example totals only) | Medium | N/A decisions dominate; c07 matters less, c03/c04 more | Track both; prioritize c03, c04, c02 N/A rules | T5, A.4 |
| The c07 rule goes the other way after we label | Medium | Up to 30 to 38 of 60 DEV c07 cells flip | Rule in config; relabel the c07 column (10 min); re-run (under a minute) | T5, D.4 |
| Strict schema not enforced on the HF router `:cerebras` route | Medium | Malformed outputs | Zod validation plus retry; switch the tie-break to a provider whose SO flag is true | T4, https://router.huggingface.co/v1/models |
| Rate limiting during the control run or demo | Low to Medium | Failed cards | Paid credits; concurrency 4; own provider fallback | T4, https://inference-docs.cerebras.ai/support/rate-limits |
| Qwen3.8-27B Kazakh judging is unmeasured | Medium | KZ slice lags | B5 check; tie-break on all KZ criteria if 10+ points lower | T2, https://huggingface.co/Qwen/Qwen3.8-27B |
| Control set is hand-picked and defect-heavy | Medium to High | Clean-chat accuracy matters less; recall on planted defects matters more | Prioritize archetype coverage in labels and the fact block | T5, C.4 |
| Control set contains voice calls | Unknown | Skeleton rules do not apply; long context; local MTP context too small | Rules fail safe; 2 to 3 calls in the labeled set; report the call slice separately | T3, https://arxiv.org/html/2508.18210v2 |
| Replaced criterion has an unusual scale or N/A rule | Medium | Validation or rendering failure | Rehearse with three fake criteria; renderer works without sub-checks | team plan C4; T3, https://arxiv.org/abs/2410.03608 |
| Overfitting to our own labels | High | DEV agreement overstates control agreement | Report it as "agreement with our guide"; family-disjoint held-out; freeze | T5, D.3; T3, https://arxiv.org/abs/2602.13576 |
| Competitor numbers anchor expectations | Low | Wrong targets | 94.4% is self-labeled and tuned on the same 65 dialogs; untrusted | T2, https://github.com/Azalytical/freedom-cqa |
| Reasoning truncation produces empty content | Medium | Dropped samples | Budget `max_completion_tokens`; on empty content retry once with lower effort; strip `<think>` before parsing | T4, https://inference-docs.cerebras.ai/capabilities/reasoning |
| A D365 judge probes the embed | Medium | Credibility | Claim only "designed"; show the embed page; name the cookie and transcript-join gaps honestly | T6, B.7 and https://learn.microsoft.com/en-us/dynamics365/customer-service/develop/download-transcripts-bulk |
| Unknowns that no source settled | n/a | n/a | Microsoft QEA language list and per-evaluation price; HF router rate limits; whether the control set includes calls or KZ; how any vendor splits calls per question or per form | T1, T4, T6 negative results |

## 11. Sources

### Team brief (RESEARCH_BRIEF.md)
- https://arxiv.org/html/2510.27106 (Rating Roulette)

### T1, task-1-commercial-autoqa.md
- https://learn.microsoft.com/en-us/dynamics365/contact-center/use/evaluation-criteria
- https://docs.aws.amazon.com/connect/latest/adminguide/generative-ai-performance-evaluations.html
- https://docs.aws.amazon.com/connect/latest/adminguide/about-scoring-and-weights.html
- https://docs.aws.amazon.com/connect/latest/adminguide/evaluation-review-requests.html
- https://docs.aws.amazon.com/connect/latest/adminguide/create-evaluation-forms.html
- https://help.genesys.cloud/faqs/category/ai-scoring/
- https://docs.cloud.google.com/contact-center/insights/docs/qai-best-practices
- https://docs.cloud.google.com/gemini-enterprise-cx/insights/languages?hl=en
- https://support.zendesk.com/hc/en-us/articles/10727979177498-Announcing-the-AutoQA-Deep-evaluation-and-validation-EAP
- https://support.zendesk.com/hc/en-us/articles/7043760048922-Disputing-a-review
- https://help.calabrio.com/doc/Content/user-guides/evaluations/ai-evaluation-guidelines.htm
- https://help.calabrio.com/Content/user-guides/application-management/auto-qm-evaluation-form-manager.htm
- https://help.webex.com/en-us/article/nxvdoq2/Use-Evaluation-and-Speech-Analytics-in-Webex-AI-Quality-Management
- https://docs.kore.ai/ai-for-service/quality-ai/configure/evaluation-forms
- https://thelevel.ai/product/quality-assurance-contact-center
- https://www.balto.ai/balto-qa-copilot/
- https://support.talkdesk.com/hc/en-us/articles/50371682083739-Talkdesk-QM-Using-Per-Question-Evaluation-Modes-and-AI-Rewrite (HTTP 403; unverified)
- https://aistudio.yandex.ru/docs/en/speechsense/release-notes/
- https://convin.ai/frequently-asked-questions/ai-qa-accuracy

### T2, task-2-cis-market-and-precedents.md
- https://github.com/Azalytical/freedom-cqa
- https://github.com/AkhmadAssentay/cqa-freedom
- https://github.com/D1maX737/cqa-freedom
- Other competitor repositories (ideas only, not cited for facts): https://github.com/nurssat/cqa-hackathon, https://github.com/qqwince/Freedom-Conversation-Quality-Analytics, https://github.com/dosmuhamedkemelbekov-ui/cqa-hackathon, https://github.com/therustam/CQA-Hackathon-RdTX, https://github.com/sNibaAdeka/60HZ-Freedom-CQA, https://github.com/RedSnapper91/cqa-hackathon
- https://yandex.cloud/ru/blog/speechsense-ai-assistants
- https://aistudio.yandex.ru/docs/ru/speechsense/api-ref/Talk/get
- https://www.comnews.ru/content/243338/2026-01-20/
- https://digitalbusiness.kz/2025-05-15/mi-na-pervoy-linii-v-rabote-s-klientami-poetomu-vsegda-dolzhni-bit-nagotove-intervyu-sdirektorom-departamenta-podderzhki-irazvitiya-klientov-freedom-broker-irinoy-suglobovoy/
- https://habr.com/ru/companies/yandex/articles/951568/
- https://habr.com/ru/articles/1071782/
- https://habr.com/ru/companies/mts_ai/articles/1087852/
- https://habr.com/ru/companies/yoomoney/articles/933954/
- https://aclanthology.org/2025.findings-acl.507.pdf
- https://huggingface.co/issai/Qwen3.5-35B-A3B-Kazakh
- https://huggingface.co/issai/Qwen3.5-9B-Kazakh

### T3, task-3-academic-sota.md
- https://aclanthology.org/2024.emnlp-industry.60.pdf
- https://aclanthology.org/2025.emnlp-industry.121.pdf
- https://arxiv.org/pdf/2602.14970
- https://arxiv.org/html/2508.18210v2
- https://arxiv.org/abs/2604.12312
- https://neurips.cc/virtual/2026/161262
- https://arxiv.org/html/2407.18370v1
- https://arxiv.org/html/2505.08775v1
- https://arxiv.org/pdf/2602.22758
- https://arxiv.org/html/2507.19457v2
- https://mlflow.org/blog/memalign/
- https://arxiv.org/html/2501.00274v1
- https://arxiv.org/abs/2410.03608
- https://arxiv.org/abs/2606.07810
- https://arxiv.org/abs/2508.06225
- https://www.alphaxiv.org/abs/2609.26550.md
- https://arxiv.org/abs/2406.13439
- https://arxiv.org/abs/2602.13576
- https://arxiv.org/html/2410.17578v2
- https://arxiv.org/html/2605.28710
- https://aclanthology.org/2026.acl-srw.94.pdf
- https://arxiv.org/pdf/2306.05685 (2023, older than 2024)

### T4, task-4-models-and-inference.md
- https://router.huggingface.co/v1/models
- https://openrouter.ai/api/v1/models/qwen/qwen3.8-27b/endpoints
- https://huggingface.co/Qwen/Qwen3.8-27B
- https://inference-docs.cerebras.ai/models/qwen-3.8-27b
- https://inference-docs.cerebras.ai/capabilities/structured-outputs
- https://inference-docs.cerebras.ai/capabilities/reasoning
- https://inference-docs.cerebras.ai/support/rate-limits
- https://huggingface.co/docs/inference-providers/index
- https://developers.cloudflare.com/workers-ai/platform/pricing/
- https://developers.cloudflare.com/workers-ai/models/qwen3.8-27b/
- https://developers.cloudflare.com/workers-ai/models/clef/
- https://developers.cloudflare.com/workers-ai/features/json-mode/
- https://developers.openai.com/api/docs/pricing
- https://developers.openai.com/api/docs/models/gpt-6-luna
- https://platform.claude.com/docs/en/about-claude/pricing
- https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- https://aistudio.google.com/docs/pricing
- https://aistudio.google.com/docs/audio
- https://computingforgeeks.com/run-qwen3-8-27b-locally/
- https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md
- https://huggingface.co/ai-sage/GigaAM-Multilingual
- https://huggingface.co/t-tech/T-one
- https://huggingface.co/issai/Qolda-AVL-34B

### T5, task-5-gt-alignment-strategy.md
- https://support.zendesk.com/hc/en-us/articles/9046364914842-Improving-AutoQA-accuracy
- https://arxiv.org/html/2606.00093v1
- https://stealthagents.com/research/bpo-quality-assurance-scorecard-benchmarks-2026
- https://www.omind.ai/?p=10965
- https://vestacall.pages.dev/blog/ai-call-scoring
- https://mlflow.org/articles/llm-judge-calibration/
- https://arxiv.org/html/2507.10579v1
- https://educationaldatamining.org/EDM2023/proceedings/2023.EDM-long-papers.9/index.html (2023, older than 2024)
- https://arxiv.org/html/2512.23707
- https://arxiv.org/abs/2404.12272
- https://arxiv.org/abs/2601.03444
- https://arxiv.org/abs/2605.16386
- https://arxiv.org/abs/2509.09524
- https://metricgate.com/docs/sample-size-mcnemar-paired
- DEV counts: data/raw/dev.json, counted by Task 5 (no URL)

### T6, task-6-ui-and-dynamics.md
- https://learn.microsoft.com/en-us/dynamics365/contact-center/use/use-evaluations
- https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/webpage-html-web-resources
- https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/web-resources
- https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/clientapi/create-app-side-panes
- https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/authenticate-web-api
- https://learn.microsoft.com/en-us/power-apps/developer/component-framework/react-controls-platform-libraries
- https://learn.microsoft.com/en-us/power-apps/developer/component-framework/limitations
- https://learn.microsoft.com/en-us/power-platform/admin/content-security-policy
- https://learn.microsoft.com/en-us/dynamics365/customer-service/administer/supported-customizations
- https://learn.microsoft.com/en-us/dynamics365/customer-service/develop/download-transcripts-bulk
- https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Privacy_sandbox/Partitioned_cookies
- https://tanstack.com/router/latest/docs/framework/react/guide/history-types
- https://help.nicecxone.com/Content/myzone/viewingyourevaluations.htm
- https://www.evaluagent.com/auto-quality-assurance/
- https://help.genesys.cloud/399798
- https://angelhack.com/blog/10-tips-to-help-you-rock-your-next-hackathon-demo/
