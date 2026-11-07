# Task 3: Academic and technical state of the art for checklist-based dialogue evaluation (2024 to 2026)

Date: 2026-11-07. Scope: what the team's RESEARCH_BRIEF.md does not already cover, plus evidence that confirms, qualifies, or contradicts it. Every number was read from the page cited; where only an abstract or summary page was read, the text says so. Vendor numbers are marked self-reported. Sources older than 2024 are flagged.

Read in full (HTML or PDF text): Ingle et al. 2024, STREAQ 2025, HealthBench 2025 (meta-evaluation section), Decomposing Physician Disagreement 2026 (abstract and introduction), Trust or Escalate 2025, GEPA v2 2025/2026, LLM-Rubric 2024, Zubiaga et al. 2026, MM-Eval 2024/2025, Why Synthetic Isn't Real Yet 2025/2026, Counterfactual Fairness in contact-center QA 2026 (results section), JEV-as-a-Judge 2026 (first half), MT-Bench few-shot appendix (2023). The rest: abstract or summary page only.

## 1. Summary table

Closeness is to our case: 8 fixed criteria, short template-generated RU/KZ/EN support chats plus 5 RU calls, about 20 labels, 10 unseen test dialogs, a criterion swapped at test time.

| #   | Paper (year, venue)                                                                      | Task                                                                                    | Judge model(s)                                                                             | Data size                                                       | Key number                                                                                                                             | Closeness                                                       |
| --- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 1   | Ingle et al., Probing LMs' contact-center knowledge for QA (2024, EMNLP Industry)        | Yes/No QA questions over agent-customer calls, with evidence and reasoning              | 8 LMs, Claude-3.5-Sonnet best; Phi-3-mini as student                                       | 100 calls x 50 questions, 7 expert annotators, 3,061 pairs kept | Claude-3.5-Sonnet 75.48 Macro F1; only about 60% of pairs reached 5/7 annotator agreement; evaluation plan +5.08 F1 for Phi-3          | High                                                            |
| 2   | Sood et al., STREAQ (2025, EMNLP Industry)                                               | Same QA task, rare "Answer of Interest" detection, cost routing                         | Nova-Pro, Nova-Premier, o3-mini, GPT-4o, Claude-3.5-Haiku, Claude-4-Sonnet, in-house small | 10 questions, 1,879 pairs (3 of 5 experts agree)                | Claude-4-Sonnet AoI precision 84.6%; passing the small model's reasoning to the large model lowered AoI F1                             | High                                                            |
| 3   | Mayilvaghanan et al., Counterfactual fairness of LLM contact-center QA (2026, arXiv)     | Flip rate of QA verdicts under counterfactual edits                                     | 18 LLMs                                                                                    | 3,000 real transcripts, 13 dimensions                           | Flip rate 5.41% to 12.96%; priming with coaching notes 16.44%                                                                          | High                                                            |
| 4   | Devanathan et al., Why Synthetic Isn't Real Yet (2025, rev. 2026, arXiv)                 | Synthetic call transcripts for AutoQA prompt tuning                                     | GPT-4.1-mini generator; GPT-4.1, GPT-4o, Haiku as QA models                                | 4,184 test QA examples, 4 languages                             | Prompts tuned on real 0.664 Macro F1 vs best synthetic 0.598                                                                           | High                                                            |
| 5   | Yang et al., CompliBench (2026, arXiv)                                                   | Judges detecting guideline violations in multi-turn support dialogs with injected flaws | GPT-5, Gemini-3-pro, Claude-sonnet-4-6, Qwen3                                              | 318 dialogs: airline 85, healthcare 111, insurance 122          | Base Qwen3-8B conversation-level accuracy below 2%; fine-tuned 8B 51.47% on airline                                                    | High                                                            |
| 6   | Roussel, Calibrate, Validate, Freeze, Then Optimize (2026, NeurIPS; abstract only)       | Rubric judge for 8 English tutoring criteria refined from judge-human disagreements     | Claude Haiku 4.5                                                                           | MRBench dialogs; judge split sizes not in abstract              | Mean kappa 0.47 to 0.57 on dev after 2 clarification rounds; 0.58 held-out                                                             | Medium                                                          |
| 7   | Jung et al., Trust or Escalate (2025, ICLR oral)                                         | Selective evaluation with guaranteed human agreement                                    | Mistral-7B, GPT-3.5, GPT-4 cascade                                                         | Calibration sets of 392 to 500                                  | Verbalized confidence AUROC 0.548 to 0.550 vs Simulated Annotators 0.723 to 0.755                                                      | Medium (High for the confidence signal, Low for the guarantees) |
| 8   | Arora et al., HealthBench (2025, OpenAI)                                                 | Rubric criteria graded met/not-met per criterion                                        | GPT-4.1, o3, o4-mini, GPT-4.1 mini/nano                                                    | 60,896 physician judgments                                      | GPT-4.1 grader 0.709 Macro F1, o3 0.681, o4-mini 0.692                                                                                 | Medium                                                          |
| 9   | Borgohain and Mariathas, Decomposing Physician Disagreement in HealthBench (2026, arXiv) | Where rubric-label disagreement comes from                                              | none (analysis)                                                                            | HealthBench labels                                              | 81.8% of disagreement variance is case-level; disagreement peaks on borderline outputs (inverted-U)                                    | Medium                                                          |
| 10  | GEPA, Agrawal et al. (2025, ICLR 2026 oral)                                              | Reflective prompt evolution                                                             | Qwen3-8B, GPT-4.1 mini                                                                     | Train 45 to 150, val 45 to 300 per task                         | +7.01 aggregate over MIPROv2; 1,839 to 7,051 rollouts per task                                                                         | Low                                                             |
| 11  | MemAlign, Databricks/MLflow blog (2026, vendor)                                          | Judge alignment from expert feedback                                                    | GPT-4.1-mini                                                                               | 50 training examples per dataset                                | Self-reported: seconds and about $0.03 vs 9 to 85 min for DSPy optimizers; on unseen examples "ties closely" except answer correctness | Medium                                                          |
| 12  | Hashemi et al., LLM-Rubric (2024, ACL)                                                   | Calibrated rubric questions for dialog satisfaction                                     | gpt-3.5-turbo-16k                                                                          | 741 synthetic + 223 real dialog ratings, 24 judges              | Real dialogs: RMSE 0.901 uncalibrated vs 0.422 calibrated; Pearson 0.143 vs 0.350                                                      | Medium                                                          |
| 13  | TICK (2024, arXiv)                                                                       | LLM-generated Yes/No checklists per instruction                                         | not on abstract page                                                                       | WildBench, LiveBench                                            | LLM-human exact agreement 46.4% to 52.2%; human inter-annotator 0.194 to 0.256 with checklists                                         | Medium                                                          |
| 14  | Rubrics as Rewards (2025, arXiv)                                                         | Rubrics as RL reward                                                                    | various                                                                                    | HealthBench, GPQA                                               | Up to 31% relative over Likert judge rewards on HealthBench (abstract)                                                                 | Low                                                             |
| 15  | RocketEval (2025, ICLR)                                                                  | Checklist grading by small LLM with learned item weights                                | Gemma-2-2B                                                                                 | MT-Bench, WildBench                                             | 0.965 correlation with human preference (abstract; level not stated, likely ranking-level, unverified)                                 | Low                                                             |
| 16  | SLMJury (2026, arXiv)                                                                    | 16 small judges, reasoning vs short verdicts                                            | 0.6B to 14B                                                                                | 64,824 judgments per config                                     | 10-token verdicts match or beat reasoning on math by 2 to 7%; reasoning wins general tasks by up to 23%; debate hurt everywhere        | Medium                                                          |
| 17  | J1 (2025, arXiv)                                                                         | Test-time scaling for judges                                                            | J1-7B                                                                                      | not on abstract page                                            | Existing judges "do not inherently exhibit" test-time scaling                                                                          | Low                                                             |
| 18  | Assessing Judging Bias in LRMs (2025, arXiv)                                             | Bias in reasoning-model judges                                                          | DeepSeek-R1, o1 etc.                                                                       | not on abstract page                                            | LRMs more robust on fact-based data only; "superficial reflection bias"                                                                | Low                                                             |
| 19  | Overconfidence in LLM-as-a-Judge (2025, arXiv)                                           | Judge confidence calibration                                                            | several                                                                                    | not on abstract page                                            | Predicted confidence "significantly overstates" correctness (no numbers on abstract)                                                   | Medium                                                          |
| 20  | JEV-as-a-Judge (2026, arXiv)                                                             | Accept-or-escalate cascade by label probability                                         | JEV + a stronger judge                                                                     | 4,850 public items                                              | tau 0.9: 23% escalated, 90.2% vs 90.0% for the strong judge at 33% fee; AUROC near chance (0.498) on reference-free prose              | Medium                                                          |
| 21  | FBI, Finding Blind Spots in Evaluator LLMs (2024, EMNLP)                                 | Planted perturbations to test judges                                                    | 5 evaluator LLMs                                                                           | 2,400 perturbed answers, 22 categories                          | Judges missed quality drops in over 50% of cases; reference-based best                                                                 | Medium                                                          |
| 22  | Rubrics as an Attack Surface (2026, arXiv)                                               | Rubric edits that pass benchmark checks but shift target domain                         | several                                                                                    | not on abstract page                                            | Target-domain accuracy down up to 9.5% (helpfulness), 27.9% (harmlessness)                                                             | Medium                                                          |
| 23  | Patch evaluation with HITL rubric (2025, arXiv)                                          | LLM-generated, human-refined rubric per bug                                             | not on page                                                                                | not on page                                                     | Kappa 0.75 on unanimous subset, 0.57 on full set                                                                                       | Low                                                             |
| 24  | Judge's Verdict (2025, arXiv)                                                            | Human-likeness test for 54 judges                                                       | 54 LLMs                                                                                    | RAG/agent outputs                                               | 27 of 54 reach Tier 1; size not the sole factor                                                                                        | Low                                                             |
| 25  | M-Prometheus (2025, arXiv)                                                               | Open multilingual judges 3B to 14B                                                      | Qwen-based suite                                                                           | 20+ languages                                                   | Native multilingual feedback data beats translated (abstract, no numbers)                                                              | Low                                                             |
| 26  | MM-Eval (2024, rev. 2025)                                                                | Multilingual judge meta-evaluation                                                      | many                                                                                       | 18 languages + 122-language consistency subset                  | Average 68.9%; low-resource drop 12.8% (linguistics), 18.4% (safety); open judges below 0.6 consistency index                          | Medium                                                          |
| 27  | Zubiaga et al., Towards Reliable Multilingual LLMs-as-a-Judge (2026, arXiv)              | EN/ES/Basque judging strategies                                                         | Llama-3.1, Latxa, GPT-5.2                                                                  | RECON 500, FLASK 2,000                                          | English instructions with proficient model r 0.760 vs translated 0.717 on Basque                                                       | Medium                                                          |
| 28  | Galyukshev and Alimova, Processing Inconsistency on Turkic Languages (2026, ACL SRW)     | Label-free competence proxy, 12 Turkic varieties                                        | 11 LLMs, 1B to 70B                                                                         | TUMLU-based                                                     | Kazakh Cyrillic beats Kazakh Latin in 9 of 11 models, mean +7.6 pp                                                                     | Medium                                                          |
| 29  | MT-Bench / Chatbot Arena, Zheng et al. (2023, NeurIPS D&B; older than 2024)              | Few-shot judge appendix                                                                 | GPT-4, GPT-3.5, Claude-v1                                                                  | MT-Bench                                                        | Few-shot raised GPT-4 consistency 65.0% to 77.5%, human agreement unchanged                                                            | Medium                                                          |

### Borrow in 24 h for papers covered only in tables

| Paper                                      | Borrow in 24 h                                                                                  |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| J1 (2025)                                  | nothing (needs RL-trained judge)                                                                |
| Assessing Judging Bias in LRMs (2025)      | nothing to build; operator text that imitates reasoning could sway the judge, a known risk only |
| SLMJury (2026)                             | no debate or critique rounds (see 3.3)                                                          |
| Overconfidence in LLM-as-a-Judge (2025)    | do not use a model's self-reported confidence as the needs-review signal                        |
| JEV-as-a-Judge (2026)                      | nothing beyond vote share (logprobs over labels not exposed in our JSON-mode setup; unverified) |
| Judge's Verdict (2025)                     | report our judge's agreement next to human-human agreement on the same dialogs                  |
| Rubrics as Rewards (2025)                  | nothing (RL training)                                                                           |
| RocketEval (2025)                          | nothing (learned item weights need many labels)                                                 |
| Rubrics as an Attack Surface (2026)        | per-slice (RU/KZ/EN/call) agreement after every prompt edit (see 5.1)                           |
| HITL patch evaluation (2025)               | human review of the auto-drafted plan for a new criterion (see 2.1)                             |
| M-Prometheus (2025)                        | nothing (open 3B to 14B judges, no Kazakh numbers)                                              |
| MM-Eval (2024/2025)                        | watch for middle-of-scale drift on KZ for c04/c06                                               |
| MM-JudgeBench / Lost in Translation (2026) | nothing (multimodal)                                                                            |
| Galyukshev and Alimova (2026)              | keep KZ in Cyrillic; never transliterate                                                        |
| MT-Bench few-shot appendix (2023)          | do not expect few-shot examples alone to raise agreement (see 5.2)                              |

## 2. Contact-center QA papers (item 1)

The academic contact-center QA literature in 2024 to 2026 is small and dominated by one company, Observe.AI. All four of their papers use proprietary English (and one multilingual) call data, frame each QA form item as a binary question answered with evidence then synthesis then verdict, and report Macro F1 or minority-class precision rather than kappa.

### 2.1 Ingle et al. 2024, EMNLP Industry

Task: given a call transcript and one QA question ("Did the agent demonstrate active listening?"), produce reasoning that cites evidence, then Yes/No. Data: 100 English calls transcribed by ASR at 10% WER, 50 questions, 7 expert QA annotators following a written guideline (identify evidence, synthesize, conclude). Only pairs where at least 5 of 7 annotators agreed were kept: 3,061 of 5,000, which the authors read as about 60% agreement. Results (Macro F1, same prompt for all): Claude-3.5-Sonnet 75.48, Llama3-70B 74.68, GPT-4o-mini 72.97, GPT-4o 70.56, Llama3-8B 68.54, Mistral-7B 62.96, Phi-3-mini 62.91, Gemma-2B 54.17.

What made it work: an "evaluation plan", a short list of concrete behaviours that the question decomposes into, generated by Claude-3.5-Sonnet and optionally refined by a human. Feeding the plan to Phi-3-mini at inference raised Macro F1 from 62.91 to 67.99; fine-tuning on Sonnet-generated plan+evidence+synthesis reached 81.86. Removing the plan from fine-tuning cost about 3 points; removing the evidence cost only 0.28.

| Setup                                          | Macro F1 |
| ---------------------------------------------- | -------: |
| Phi-3-mini out of the box (S0)                 |    62.91 |
| + Sonnet evaluation plan at inference (S1)     |    67.99 |
| Fine-tuned with plan, evidence, synthesis (S2) |    81.86 |
| S2 without plan (S2a)                          |    78.80 |
| S2 without evidence (S2b)                      |    81.58 |

Two facts matter for us. First, even trained QA experts reached 5-of-7 agreement on only about 60% of question-conversation pairs: per-item agreement with any single Ground Truth labeler has a low ceiling on subjective items. Second, the plan is exactly what the brief calls "Boolean sub-checks", with a measured effect, and the paper shows a way to produce one automatically for a new criterion.

Closeness: High. Same task shape (binary QA items with evidence over support conversations); English only, calls not chats, proprietary data.
Borrow in 24 h: when a user adds or replaces a criterion in the UI, call the model once to draft an evaluation plan (3 to 6 observable checks), show it for editing, store it with the checklist revision, and inject it into the judge prompt. This covers the "replaced criterion" test, which today has no sub-checks.

### 2.2 STREAQ, Sood et al. 2025, EMNLP Industry

Task: the same QA formulation with a focus on the rare "Answer of Interest" (AoI), for example the rare No on "Did the agent greet the customer properly?". They argue AoI precision matters more than Macro F1 because false flags trigger needless coaching. Data: 10 questions, about 3,000 pairs sampled for label balance, 5 experts each, kept where at least 3 agreed: 1,879 pairs (about 62%). The annotators' evaluation plan was given to all large models at inference.

| Model (full inference)    |                                          AoI precision | AoI F1 | Macro F1 | Daily cost at 1.5M calls |
| ------------------------- | -----------------------------------------------------: | -----: | -------: | -----------------------: |
| In-house small fine-tuned |                                                  54.2% |  56.1% |    67.0% |                   $3,070 |
| Nova-Pro                  |                                                  79.0% |  73.9% |    82.0% |                  $34,162 |
| Claude-4-Sonnet           |                                                  84.6% |  81.7% |    87.0% |                 $204,956 |
| Claude-3.5-Haiku          | 72.4% in table, 82.4% in prose (paper is inconsistent) |  75.5% |    82.0% |                  $43,059 |
| o3-mini                   |                                                  80.5% |  72.8% |    81.4% |                  $90,097 |
| GPT-4o                    |                                                  79.9% |  80.1% |    85.8% |                 $135,779 |

Cells were read from a flattened PDF table by column order; the Nova-Pro row matches the ablation table and the Sonnet precision and costs match the prose.

Two-tier routing (a RoBERTa classifier decides whether to escalate the small model's answer) kept 88.9% of Nova-Pro AoI precision at 48% lower cost. The ablation that matters for us: when the small model's reasoning was passed into the large model's prompt, the large model did worse; the authors conclude that omitting the small model's context "improves both performance and efficiency". A reasoning model (o3-mini) was not the best judge: AoI precision 80.5% against 84.6% for Claude-4-Sonnet.

Closeness: High. Same task, same rare-violation problem as our c08 and c03.
Borrow in 24 h: (a) the tie-break call to the second model family must receive the transcript and criterion only, never Qwen's reasoning or votes; (b) report precision and recall on the minority answer per criterion (Yes for c08, No for c01/c07), not only accuracy.

### 2.3 Counterfactual fairness of contact-center QA, Mayilvaghanan et al. 2026, arXiv

Data: 3,000 real transcripts; 18 LLMs; 13 counterfactual dimensions. Flip rate of binary QA verdicts ranges 5.41% (Claude-4-Sonnet) to 12.96% (Llama-3.2-3B) against a stochastic baseline of 1.33% for Claude-4-Sonnet. The worst dimension is extrinsic context: priming with prior coaching notes flipped 16.44% of verdicts, past-performance metadata 9.00%, irrelevant customer-profile metadata ("VIP customer") 9.64%. Identity signalled through linguistic or cultural markers flipped 9.71% (ethnicity) and 9.24% (religion), versus 6.02% for name-only swaps. Style changes (formality 7.07%, politeness 6.93%) mattered least. Fairness-aware prompting gave "only modest gains".

Closeness: High. Directly measures how extra prompt context moves QA verdicts.
Borrow in 24 h: keep the judge prompt free of anything that is not the transcript and the checklist. Do not feed earlier verdicts, appeal text, reviewer comments, or operator names/history into a re-evaluation. If the appeal flow re-runs the model, run it blind and show the appeal next to it.

### 2.4 Why Synthetic Isn't Real Yet, Devanathan et al. 2025 (rev. Feb 2026), arXiv

Observe.AI generated synthetic call transcripts from call attributes (intent, topic flow, QA form, length, language) with GPT-4.1-mini in three ways (direct, chunked, characteristic-aware), then tuned AutoQA prompts with DSPy MIPROv2 on synthetic versus real calls. AutoQA test set: 4,184 examples from 756 calls in English, Spanish, French, French-Canadian; human-LLM kappa on 972 validation annotations was 0.6 to 0.8. Prompts tuned on real calls: 0.664 Macro F1; best synthetic: 0.598 (11% gap, larger outside English).

| Property                             | Real turns | Synthetic turns |
| ------------------------------------ | ---------- | --------------- |
| Interactional disfluency             | 15 to 30%  | 1 to 6%         |
| Positive sentiment                   | 5 to 6%    | 15 to 25%       |
| Understated agent proactivity        | 20 to 30%  | 4 to 15%        |
| Formal language                      | 15 to 20%  | 40 to 50%       |
| Excellent coherence (per transcript) | 50 to 60%  | about 90%       |

Closeness: High. It is the only paper found that measures what tuning on synthetic support dialogs does to QA accuracy on real ones.
Borrow in 24 h: treat DEV's 60 synthetic chats and 5 real calls as two regimes. A prompt tuned only on chats can lose roughly 10% on real calls. Keep at least 2 of the 5 calls in the labeled set, and report call and chat agreement separately. If the control set is also generator-made (likely, given DEV), the gap matters less for the score.

### 2.5 Other contact-center sources

Negative results: no 2024 to 2026 paper was found that reports Cohen's kappa between an LLM and human QA on a multi-criterion scorecard with N/A handling, nor any Russian or Kazakh contact-center QA paper. Searches: "automated quality assurance customer service LLM", "conversation quality assessment contact center", "contact center LLM scorecard kappa", Russian "LLM судья оценка диалогов казахский". The KPI master's thesis (Zhuravel) found in search is from 2016 and was not used.

## 3. Rubric and checklist methods newer than the brief (item 2)

### 3.1 Checklist generation: TICK (2024), Rubrics as Rewards (2025), RocketEval (ICLR 2025), Google adaptive rubrics

TICK has an LLM write Yes/No checklist questions per instruction, then grade each. LLM-human exact agreement rose from 46.4% (direct scoring) to 52.2%; giving the same checklists to human raters raised their inter-annotator agreement on WildBench from 0.194 to 0.256. Rubrics as Rewards uses instance-specific rubrics as RL reward and reports up to 31% relative gain on HealthBench over Likert judge rewards, and says rubrics give "better alignment for smaller judges and reduce performance variance across judge scales" (abstract only). RocketEval grades instance checklists with Gemma-2-2B and learns item weights from human annotations; the 0.965 correlation in the abstract is most likely system-ranking-level and not comparable to per-item agreement (not verified in the full text). Google's Vertex AI Gen AI evaluation service now recommends adaptive (per-prompt generated) rubrics by default, with static rubrics for consistent benchmarking.

The brief cites GER-Eval: model-generated rubrics are less stable than human-written ones. These papers do not contradict that. All of them generate rubrics because none exists; we have one. Generated checklists are useful for the replaced criterion and as sub-checks under an organizer criterion, not as a substitute for its text.

Closeness: Medium. Same mechanism, different objects (instructions, not support dialogs).
Borrow in 24 h: the TICK pattern for a new criterion only (see 2.1). Never let generated checks override the organizer's N/A or scale text.

### 3.2 HealthBench rubric grading (OpenAI, May 2025) and its disagreement analysis (2026)

HealthBench grades each rubric criterion independently as met/not-met with a model grader, sums positive and negative points, divides by the maximum, and clips to [0, 1]. Grader-physician Macro F1 by theme ranged 0.572 to 0.706; physician-physician 0.569 to 0.730. Overall grader Macro F1: GPT-4.1 0.709, o4-mini 0.692, o3 0.681, GPT-4.1 mini 0.661, GPT-4.1 nano 0.580 (random 0.50). Score standard deviation across 16 runs was about 0.002.

Borgohain and Mariathas (2026) decompose the physician labels: rubric identity explains 15.8% of label variance but only 3.6 to 6.9% of disagreement variance, physician identity 2.4%, and 81.8% is case-level residual. Disagreement follows an inverted U over completion quality (AUC 0.689): raters agree on clearly good or bad outputs and split on borderline ones. "Reducible" uncertainty (missing context, ambiguous phrasing) more than doubles disagreement odds (OR 2.55).

Closeness: Medium. Per-criterion binary grading with a weighted total, as in our case, but medicine and single responses.
Borrow in 24 h: (a) expect a ceiling near human-human agreement; (b) the borderline-case finding is the argument for a "needs review" flag on split votes, which is where Ground Truth itself is least stable; (c) a reasoning grader was not better than a non-reasoning one here (see 3.3).

### 3.3 Reasoning models as judges

| Source                                         | Finding                                                                                                     | Numbers                                                     |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| HealthBench 2025                               | Non-reasoning GPT-4.1 beat o3 and o4-mini as rubric grader                                                  | 0.709 vs 0.681 / 0.692 Macro F1                             |
| STREAQ 2025                                    | o3-mini below Claude-4-Sonnet and Nova-Premier on AoI precision                                             | 80.5% vs 84.6% / 82.3%                                      |
| SLMJury 2026 (abstract)                        | Short verdicts match or beat reasoning on math judging; reasoning wins on general tasks; debate always hurt | +2 to 7% (short) on math; up to +23% (reasoning) on general |
| J1 2025 (abstract)                             | Off-the-shelf judges show no test-time scaling; scaling appears only after RL training                      | J1-7B +4.8% over prior SOTA                                 |
| Assessing Judging Bias in LRMs 2025 (abstract) | LRMs more robust only on fact-based data; still position-biased; swayed by text that imitates reasoning     | no numbers on abstract                                      |
| Brief's source, arXiv 2509.13332               | Thinking mode helps small Qwen3 (0.6B to 4B) judges by about 10 points                                      | (in brief)                                                  |

Reading: thinking helps small models on tasks that need inference, but at frontier-ish scale it is not a reliable gain for rubric grading, and nothing shows that longer reasoning helps. No paper measured reasoning length versus agreement on dialog QA. Our criteria need little inference beyond reading turns in order; c04 (were all questions closed) is the exception.

Closeness: Medium.
Borrow in 24 h: run the 14 tuning dialogs with Qwen3.8 thinking on and off (or low versus default effort) and keep whichever wins per criterion. About 1 hour. Do not add debate or self-critique rounds.

### 3.4 Confidence and selective prediction ("needs review")

Trust or Escalate (ICLR 2025): on GPT-4-turbo, confidence from predictive probability and from verbalized self-report was poorly calibrated; "Simulated Annotators" (prompt the judge N times, each with a different set of K in-context labeled examples, average the label distributions) was much better.

| Dataset    | Method                 |   ECE | AUROC |
| ---------- | ---------------------- | ----: | ----: |
| AlpacaEval | Predictive probability | 0.217 | 0.642 |
| AlpacaEval | Verbalized confidence  | 0.215 | 0.550 |
| AlpacaEval | Simulated Annotators   | 0.095 | 0.723 |
| TL;DR      | Predictive probability | 0.196 | 0.731 |
| TL;DR      | Verbalized confidence  | 0.194 | 0.548 |
| TL;DR      | Simulated Annotators   | 0.039 | 0.755 |

With thresholds set by fixed-sequence testing on a calibration set of 392 to 500 items, a cascade guaranteed over 80% human agreement on ChatArena (Table 6, target 0.8, stronger cascade: 80.2% agreement, 77.6% coverage, relative cost 0.215 of GPT-4; the introduction reports 79.1% coverage on the same ChatArena data, unreconciled with Table 6). K = N = 5 for two datasets, 3 for the third.

JEV-as-a-Judge (Oct 2026): accept when the top label probability is at least 0.9, else escalate. Pooled over 4,850 items, 23% escalated, accuracy 90.2% versus 90.0% for the strong judge alone at 33% of its fee; accepted items 94.7% correct, escalated items 67.7% for the cheap judge. On reference-free prose the confidence AUROC was 0.498, near chance. Overconfidence in LLM-as-a-Judge (Aug 2025, abstract) reports judge confidence systematically above correctness.

What this means at our size: none of these guarantees can be computed from 20 labels (the guarantees use about 400 to 500). What transfers is the ranking of signals: vote agreement across samples with varied in-context examples beats a single call's verbalized confidence, and logprobs are mid-way. The brief said verbalized confidence is uncalibrated with "no strong paper"; Trust or Escalate is that paper.

Closeness: Medium overall (as in the table): High for the confidence signal (varied in-context examples, vote share), Low for the guarantees, which need about 400 to 500 calibration labels we do not have.
Borrow in 24 h: make the 3 samples differ by which few-shot examples they see (a cheap Simulated Annotators variant), use vote share as confidence, route split criteria to "needs review" and to the second-family tie-break. Measure on the 20 labels whether split criteria are wrong more often; report that number in the calibration page.

### 3.5 Vendor grading guidance (Anthropic, OpenAI, Google)

Anthropic's eval guide: use a different model as grader than the generator, give detailed explicit rubrics, constrain output, validate parse, anchor scale endpoints, prefer more automated questions over fewer hand-graded ones. OpenAI's graders guide: detailed step-by-step grader prompts with many in-context examples including expert answers with known grades; reasoning models (o1, o3-mini, o3, o4-mini) supported, temperature fixed for them; check the grader ranks answers like experts; balance labels "so the grader can't succeed by guessing". The OpenAI page also notes graders are being deprecated in evals and fine-tuning workflows. Google: see 3.1. No page date was visible on any of the three.

Closeness: Low (generic). Borrow in 24 h: nothing new beyond the brief.

## 4. Evidence attribution and citation verification (item 3)

Negative result: no paper was found that runs a controlled comparison of judge accuracy with versus without mandatory span citations, or that measures how many judge rationales cite non-existent evidence. Searches: "LLM judge evidence citation span grounding verify quotes", "quote extraction before judgment", "hallucinated rationales judge". What exists:

- Ingle et al. 2024 (2.1): removing evidence from the fine-tuning target cost only 0.28 Macro F1. Evidence is for the reviewer, not a large accuracy lever.
- FBI (EMNLP 2024): judges missed planted quality drops in over 50% of cases; reference-based evaluation was the strongest setup. Evidence that judges skim; it supports forcing the model to locate the specific turn before a verdict.
- HealthBench and STREAQ both ask for evidence then verdict; neither ablates it.

The brief's recommendation (index in range, speaker check, fuzzy quote match, one retry) stands as engineering hygiene; it is not backed by a measured agreement gain.

Closeness: Medium. Borrow in 24 h: keep the brief's quote check; also log the rate of failed citations per criterion on DEV as a quality metric to show judges.

## 5. Small-data alignment (item 4)

### 5.1 Disagreement-driven rubric clarification

Roussel (NeurIPS 2026; only the abstract on the conference page was read): a Claude Haiku 4.5 rubric judge on 8 human-labeled criteria for English tutoring dialogs (MRBench), refined on a dev split through human-reviewed clarifications derived from judge-human disagreements, each criterion validated under a pre-registered rule, then frozen with a hash-based drift guard (per the abstract) and evaluated once on a held-out split. Mean kappa went from 0.47 to 0.57 on dev after two accepted revisions and was 0.58 on the held-out split; 7 of 8 criteria met the rule, and tutor tone was withheld from the optimization objective (presumably the one that failed; the abstract does not say so directly). The judge's dev and held-out split sizes are not in the abstract; the "60 held-out conversations" in the abstract belong to the later tutor-prompt optimization step, not to the judge's kappa. The HITL patch-evaluation paper (2025) reports kappa 0.75 on unanimous items and 0.57 on all items with a human-refined LLM rubric; no before/after numbers on the page.

"Rubrics as an Attack Surface" (2026) is the counterweight: rubric edits that pass benchmark validation still cut target-domain accuracy by up to 9.5% (helpfulness) and 27.9% (harmlessness). Edits tuned on one slice can silently hurt another.

Closeness: Medium. Same loop the team plans, with a published effect size of about +0.10 kappa, but on English tutoring dialogs and read from the abstract only.
Borrow in 24 h: the brief's 14/6 loop, plus two things from Roussel: write each clarification as a short rule tied to a specific disagreement, accept it only if the 14-dialog per-criterion score improves without lowering any other criterion, and freeze the prompt with a hash-based drift guard, as Roussel does (store the prompt hash with each report and refuse runs whose hash changed), before the held-out run. Check KZ, EN and call slices separately after each edit (the attack-surface result).

### 5.2 Few-shot examples

MT-Bench (Zheng et al., 2023, older than 2024): few-shot raised GPT-4 judge consistency from 65.0% to 77.5%, but agreement with humans "performs similarly to zero-shot", and prompts were 4x longer. OpenAI's grader guide recommends many in-context examples with known grades. Trust or Escalate uses in-context examples mainly to build a confidence signal. No 2024 to 2026 paper was found that retrieves similar labeled dialogs as in-context examples for a judge and measures agreement (negative result; searched "retrieval-augmented LLM evaluator similar human-labeled examples", "dynamic few-shot judge").

Our case has a feature none of these papers has: DEV scenarios repeat across languages (p1-ru-029 and p1-kz-008). If the control set comes from the same generator, a labeled sibling of a control dialog may exist in DEV. Retrieving the labeled sibling (by scenario similarity) as a reference example is an untested idea. It is close to "reference-based" judging, the best setup in FBI, but it can also anchor the model on the sibling's verdict when the planted defect differs. Treat it as an experiment: measure on the 6 held-out dialogs with and without it.

Closeness: Medium. Borrow in 24 h: 3 to 5 fixed short examples for the confusable criteria (c02 N/A, c03 N/A versus No, c07 cut-off N/A), varied across the 3 samples (see 3.4). Retrieval of siblings only if the held-out check shows a gain.

### 5.3 Calibration models: LLM-Rubric (ACL 2024)

gpt-3.5-turbo-16k answers 9 rubric questions as probability distributions; a small feed-forward network maps them to each human judge's overall rating. On 223 real dialogs: RMSE 0.901 and Pearson 0.143 uncalibrated, 0.422 and 0.350 calibrated. The largest single gain came from judge-specific parameters (without them RMSE 0.601). Training used about 593 ratings per fold, far above our 20 dialogs.

Closeness: Medium. Same idea as mapping sub-check outputs to criterion verdicts; data need too high for a learned network.
Borrow in 24 h: nothing learned; combine sub-checks with hand-written rules in code.

### 5.4 GEPA and other prompt optimizers

GEPA v2 (ICLR 2026 oral): reflective prompt mutation plus Pareto selection. Against MIPROv2 on Qwen3-8B, aggregate test 54.85 versus 47.84; per task gains of +2.39 to +12.00. Rollouts per task: 1,839 to 7,051 (aggregate 3,936), most of them spent on validation; 79 to 737 train rollouts to reach the optimum. Smallest data used: AIME with 90 questions split equally into train and validation (about 45/45), test 30; others 111 to 150 train and 111 to 300 validation. Minibatch 3. The paper reports a lower generalization gap than few-shot optimizers. The paper does not test splits of 10 to 20 examples.

MemAlign (Databricks/MLflow, Feb 2026, self-reported): 50 training examples per dataset, GPT-4.1-mini. MemAlign adapts in about 40 seconds for about $0.03 versus $1 to $5 and 9 to 85 minutes for MIPROv2, SIMBA, GEPA. On seen examples MemAlign often reaches 90%+ while optimizers plateau in the 70s to 80s; on unseen examples it beats DSPy optimizers only on answer correctness and "ties closely" elsewhere. Large seen versus unseen gap means memorization dominates at this size.

| Requirement                  | GEPA as published                     | Our situation                              |
| ---------------------------- | ------------------------------------- | ------------------------------------------ |
| Labeled examples             | 90 to 450 per task (train + val)      | 14 tuning + 6 held-out                     |
| Metric calls                 | 1,839 to 7,051 rollouts               | 20 dialogs x 3 samples = 60 calls per pass |
| Feedback text                | Uses rich per-example feedback        | Available (our disagreement notes)         |
| Criteria stable at test time | Yes                                   | No: one criterion is replaced at test time |
| Setup                        | DSPy program + metric + reflection LM | Prompt lives in a TypeScript Worker        |

Verdict on GEPA in this hackathon: not worth 3 hours. The validation set it needs to avoid overfitting is at least 45 examples in the published runs; we have 6. A per-criterion prompt optimized on 14 dialogs will not transfer to the replaced criterion. The prompt is built in TypeScript, so a DSPy loop means porting it to Python and back. The reflective step GEPA automates (read failures, write a rule) is what the team does by hand in the 14/6 loop, and the only published small-data number for that manual loop is +0.10 kappa (5.1). The one condition that would change this: if the team labels 60+ dialogs, GEPA on the per-criterion instruction text with 30/30 train/val becomes plausible, but still not for the swapped criterion.

## 6. Multilingual judging (item 5)

| Source                                         | Languages                                                                                                         | Finding                                                                                                                           | Numbers                                                                                                                              |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| MM-Eval (2024, rev. 2025)                      | 18 core incl. Russian; 122-language consistency subset (Belebele-based; whether Kazakh is in it was not verified) | Low-resource accuracy drops; scores drift to the middle; open judges inconsistent                                                 | Average 68.9% (random 50%); linguistics -12.8%, safety -18.4% vs English; proprietary consistency index about 0.8, open below 0.6    |
| M-Prometheus (2025)                            | 20+                                                                                                               | Training on native multilingual feedback beats translated data; backbone choice matters                                           | abstract, no numbers                                                                                                                 |
| Zubiaga et al. (May 2026)                      | EN, ES, Basque                                                                                                    | English task instructions plus a language-proficient model beat translated instructions; multilingual training helps low-resource | Basque r 0.760 vs 0.717; fine-tuned 8B 0.805 vs GPT-5.2 0.700 on Basque; without in-domain data zero-shot large models more reliable |
| Galyukshev and Alimova (ACL SRW 2026)          | 12 Turkic varieties + EN/RU                                                                                       | Kazakh Cyrillic handled better than Kazakh Latin                                                                                  | +7.6 pp mean, 9 of 11 models, p = 0.038                                                                                              |
| MM-JudgeBench / Lost in Translation (Apr 2026) | 25 languages, multimodal                                                                                          | substantial cross-lingual variance (abstract)                                                                                     | no per-language numbers on the abstract page; a search summary said Kazakh is a persistent problem, not verified                     |

Translate-then-judge versus judge-in-language: no 2025 to 2026 paper found compares them head to head for dialog QA with numbers (negative result; searched "translate-then-evaluate vs native language LLM judge"). The nearest evidence is Zubiaga: keeping instructions in English and the content in the original language beat full translation of the training data (in-domain correlation 0.73 partial versus 0.56 monolingual). This supports the brief's choice (judge in original language, instructions in Russian or English). No Kazakh judge benchmark exists as of November 2026, as far as these searches show.

Closeness: Medium. Borrow in 24 h: keep KZ in Cyrillic as given; keep instructions in one high-resource language; report KZ agreement separately; if KZ lags, add the second-family vote for all KZ criteria (brief risk 4).

## 7. Synthetic and template-generated data (item 6)

CompliBench (Apr 2026; 318 dialogs: airline 85, healthcare 111, insurance 122): builds multi-turn support dialogs in airline, healthcare and insurance from real enterprise guidelines; injects a violation by corrupting one guideline the assistant agent follows, keeps a variant only if it changes behaviour and an adversarial judge misses it. This gives ground truth for the violated guideline and the turn by construction. Base Qwen3-8B reached under 2% conversation-level accuracy; Gemini-3-pro over 90% violation detection; a Qwen3-8B fine-tuned on the generated data reached 51.47% conversation-level accuracy on airline and was competitive on unseen domains.

FBI (EMNLP 2024): 2,400 planted perturbations in 22 categories; judges missed over half.

Why Synthetic Isn't Real Yet (2.4): prompts tuned on synthetic transcripts lose about 11% Macro F1 on real calls.

Our DEV chats are this kind of data already: one scenario rendered in three languages with specific planted defects (paid-service offer, insult then correct answer, cut-off before closing, unverified protected action). Two uses follow. (a) Scenario families let the team label one member and check the judge's consistency across its RU/KZ/EN siblings: any criterion where siblings disagree is a language problem, not a rubric problem. (b) Planted-defect variants with labels known by construction can expand the 20 labels for the rare criteria (c08 Yes, c03 No, c07 N/A). Have the LLM edit one operator turn of a correctly labeled dialog to plant one defect, which flips exactly one criterion. The research shows this tests recall well (FBI, CompliBench). No paper found shows that such data improves agreement with human labels on real data, and the Observe.AI result warns it can mislead on calls.

Negative result: no paper found on detecting or exploiting template-generated evaluation sets as such (searched "template-generated evaluation set scenario families planted defects", "synthetic labeled dialogs ground truth by construction judge calibration").

Closeness: High (CompliBench, Observe.AI); Medium (FBI).
Borrow in 24 h: 20 to 30 single-defect edits of labeled DEV chats for c03, c07, c08, used as a recall test, not for tuning; and a cross-language sibling consistency check.

## 8. Ten findings most likely to raise agreement with Ground Truth for our case

| Rank | Change                                                                                                                                             | Effort (h) | Evidence                                                                                        | URL                                                                             |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------: | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1    | Evaluation plan (observable checks) per criterion in the prompt; auto-draft one with the LLM when a criterion is added or replaced, editable in UI |          2 | +5.08 Macro F1 for small model at inference; large models given plans in STREAQ                 | https://aclanthology.org/2024.emnlp-industry.60.pdf                             |
| 2    | Judge prompt contains only transcript and checklist: no prior verdicts, appeal text, operator history or names on re-run                           |        0.5 | Priming flips up to 16.44% of verdicts; past performance 9.00%                                  | https://arxiv.org/pdf/2602.14970                                                |
| 3    | Second-family tie-break sees transcript and criterion only, never the first model's reasoning                                                      |       0.25 | Passing small-model reasoning to large model lowered AoI performance                            | https://aclanthology.org/2025.emnlp-industry.121.pdf                            |
| 4    | Disagreement-driven clarifications as short rules, accept only if no other criterion drops, freeze the prompt before the 6 held-out                |          3 | kappa 0.47 to 0.57 on dev, 0.58 held-out (English tutoring, abstract only)                      | https://neurips.cc/virtual/2026/161262                                          |
| 5    | Vary few-shot examples across the 3 samples; use vote share as confidence; route splits to needs-review; never use verbalized confidence           |          1 | Simulated Annotators AUROC 0.723 to 0.755 vs verbalized 0.548 to 0.550                          | https://arxiv.org/html/2407.18370v1                                             |
| 6    | Test thinking on versus off per criterion on the 14 tuning dialogs; keep the winner; no debate rounds                                              |          1 | GPT-4.1 0.709 vs o3 0.681 as grader; debate hurt in all SLMJury configs                         | https://arxiv.org/html/2505.08775v1, https://arxiv.org/abs/2606.07810           |
| 7    | Report minority-answer precision and recall per criterion (c08 Yes, c03 No, c07 N/A), not only accuracy; tune c08 for precision                    |        0.5 | AoI precision is the business metric; rare-class errors hidden by accuracy                      | https://aclanthology.org/2025.emnlp-industry.121.pdf                            |
| 8    | Planted single-defect variants of labeled DEV chats as a recall test for c03/c07/c08                                                               |     2 to 3 | Judges miss over 50% of planted drops; base Qwen3-8B below 2% on injected violations            | https://arxiv.org/abs/2406.13439, https://arxiv.org/abs/2604.12312              |
| 9    | Include 2 real calls in the labeled set and report chat and call agreement separately                                                              |        0.5 | Synthetic-tuned prompts lose about 11% on real calls                                            | https://arxiv.org/html/2508.18210v2                                             |
| 10   | Cross-language sibling consistency check on DEV scenario families; KZ stays Cyrillic, instructions in one high-resource language                   |          1 | Cyrillic Kazakh +7.6 pp over Latin; English instructions with proficient model beat translation | https://aclanthology.org/2026.acl-srw.94.pdf, https://arxiv.org/html/2605.28710 |

Not in the list: GEPA or any DSPy optimizer (section 5.4), learned calibration networks (5.3), fine-tuning a judge (CompliBench and Ingle show gains but need hundreds of examples), conformal guarantees (need about 400 to 500 labels).

## 9. Claims in RESEARCH_BRIEF.md that this reading confirms, qualifies, or contradicts

| Brief claim                                                                                                | Verdict                                                                                                                                                                                                                                                                                         | Evidence                                                                                                  |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Rec 2: keep reasoning on; Qwen3 study shows explicit reasoning improves judging                            | Qualifies. True for 0.6B to 4B models; at larger scale a non-reasoning grader beat o3 on HealthBench and o3-mini trailed Claude-4-Sonnet in STREAQ. Test both on DEV.                                                                                                                           | https://arxiv.org/html/2505.08775v1, https://aclanthology.org/2025.emnlp-industry.121.pdf                 |
| 2.1: verbalized confidence uncalibrated, "practitioner consensus, no strong paper"                         | Confirms, and supplies the paper: verbalized AUROC 0.548 to 0.550, barely above chance                                                                                                                                                                                                          | https://arxiv.org/html/2407.18370v1                                                                       |
| Rec 8 / design step 4: tie-break with gpt-oss on split criteria, vote joins pool                           | Qualifies: the tie-break prompt must not include the first model's reasoning                                                                                                                                                                                                                    | https://aclanthology.org/2025.emnlp-industry.121.pdf                                                      |
| 2.5: hand-picked few-shot examples are the cheap alternative; "KazMMLU found few-shot helped consistently" | Qualifies: for judges, few-shot raised consistency but not human agreement in the only ablation found (2023); KazMMLU measured QA accuracy, not judging                                                                                                                                         | https://arxiv.org/pdf/2306.05685                                                                          |
| Rec 10: skip DSPy; MIPROv2 overfits at 10 to 30                                                            | Confirms and extends to GEPA: published runs use at least about 45 train + 45 val; vendor MemAlign shows seen/unseen gap at 50                                                                                                                                                                  | https://arxiv.org/html/2507.19457v2, https://mlflow.org/blog/memalign/                                    |
| Rec 1: Boolean sub-checks                                                                                  | Confirms with contact-center numbers (evaluation plans +5.08 F1) and extends: plans can be auto-drafted for a new criterion                                                                                                                                                                     | https://aclanthology.org/2024.emnlp-industry.60.pdf                                                       |
| 2.2: Level AI's "over 90% agreement" with QA managers                                                      | Qualifies: in the only peer-reviewed contact-center QA data found, experts reached 5-of-7 agreement on about 60% of items and 3-of-5 on about 62%; my inference, from a different task and data set, is that 90% per-item agreement on subjective items is unlikely to hold as a general number | https://aclanthology.org/2024.emnlp-industry.60.pdf, https://aclanthology.org/2025.emnlp-industry.121.pdf |
| 2.3: verifier pass "literature support is thin"                                                            | Confirms: no controlled study of citation requirements on judge accuracy found; removing evidence from training cost 0.28 F1 in Ingle                                                                                                                                                           | https://aclanthology.org/2024.emnlp-industry.60.pdf                                                       |
| 2.4: judge in original language, do not translate                                                          | Confirms indirectly (Zubiaga; Cyrillic finding); still no Kazakh judge benchmark                                                                                                                                                                                                                | https://arxiv.org/html/2605.28710                                                                         |
| 2.1: GER-Eval, model-generated rubrics less stable                                                         | Confirms for replacing organizer text; TICK/RaR/Google show generated checklists help where no rubric exists, which is the replaced-criterion case                                                                                                                                              | https://arxiv.org/abs/2410.03608                                                                          |
| Risk 6: overfitting the prompt to DEV                                                                      | Extends: rubric edits can keep aggregate agreement while hurting a slice (up to 27.9%); check per language and per channel                                                                                                                                                                      | https://arxiv.org/abs/2602.13576                                                                          |

## 10. Negative results (searched, not found)

- A contact-center or support-chat QA paper with per-criterion kappa against human QA on a multi-criterion scorecard with N/A, from any vendor or lab, 2024 to 2026.
- Any Russian- or Kazakh-language contact-center QA evaluation paper, or a Habr write-up with measured agreement (Russian search returned only KazMMLU and multimodal judge benchmarks).
- A Kazakh or Turkic LLM-as-a-judge benchmark (only label-free competence work and a multimodal 25-language benchmark).
- A head-to-head translate-then-judge versus judge-in-language study for dialog evaluation.
- A controlled ablation of mandatory span citations on judge accuracy or rationale hallucination rate.
- A study of retrieving similar labeled dialogs as judge in-context examples.
- Any GEPA or MIPROv2 result at 10 to 30 labeled examples.
- Work on detecting or exploiting template-generated evaluation sets as such.
- The full text of SLMJury, J1, Overconfidence in LLM-as-a-Judge, RocketEval, Rubrics as Rewards, M-Prometheus (abstracts only; their detailed numbers are not reported here).

## Sources

- https://aclanthology.org/2024.emnlp-industry.60.pdf (Ingle et al., EMNLP 2024 Industry, Nov 2024; full PDF)
- https://aclanthology.org/2025.emnlp-industry.121.pdf (STREAQ, EMNLP 2025 Industry, Nov 2025; full PDF)
- https://arxiv.org/abs/2602.14970 and https://arxiv.org/pdf/2602.14970 (Counterfactual fairness, 16 Feb 2026)
- https://arxiv.org/html/2508.18210v2 (Why Synthetic Isn't Real Yet, Aug 2025, rev. 16 Feb 2026)
- https://arxiv.org/abs/2604.12312 (CompliBench, 14 Apr 2026; dialog counts from https://arxiv.org/html/2604.12312)
- https://neurips.cc/virtual/2026/161262 (Calibrate, Validate, Freeze, Then Optimize, NeurIPS 2026)
- https://arxiv.org/html/2407.18370v1 (Trust or Escalate, ICLR 2025)
- https://iclr.cc/virtual/2025/oral/31838 (Trust or Escalate, ICLR 2025 oral page)
- https://arxiv.org/html/2505.08775v1 (HealthBench, May 2025)
- https://arxiv.org/pdf/2602.22758 (Decomposing Physician Disagreement in HealthBench, 2026)
- https://arxiv.org/html/2507.19457v2 (GEPA v2, ICLR 2026)
- https://mlflow.org/blog/memalign/ (MemAlign, 3 Feb 2026, vendor)
- https://arxiv.org/html/2501.00274v1 (LLM-Rubric, ACL 2024)
- https://arxiv.org/abs/2410.03608 (TICK, 4 Oct 2024)
- https://arxiv.org/abs/2507.17746 (Rubrics as Rewards, Jul 2025, rev. Oct 2025)
- https://arxiv.org/abs/2503.05142 (RocketEval, ICLR 2025)
- https://arxiv.org/abs/2606.07810 (SLMJury, 5 Jun 2026)
- https://arxiv.org/abs/2505.11875v1 (J1, 17 May 2025)
- https://arxiv.org/abs/2504.09946 (Assessing Judging Bias in LRMs, Apr 2025)
- https://arxiv.org/abs/2508.06225 (Overconfidence in LLM-as-a-Judge, Aug 2025)
- https://www.alphaxiv.org/abs/2609.26550.md (JEV-as-a-Judge, Oct 2026)
- https://arxiv.org/abs/2406.13439 (FBI, EMNLP 2024)
- https://arxiv.org/abs/2602.13576 (Rubrics as an Attack Surface, Feb 2026, rev. Sep 2026)
- https://arxiv.org/abs/2511.10865 (HITL patch evaluation, 14 Nov 2025)
- https://arxiv.org/abs/2510.09738v1 (Judge's Verdict, 10 Oct 2025)
- https://arxiv.org/abs/2504.04953 (M-Prometheus, Apr 2025, rev. Oct 2025)
- https://arxiv.org/html/2410.17578v2 (MM-Eval, 2024, v2)
- https://arxiv.org/html/2605.28710 (Zubiaga et al., 27 May 2026)
- https://aclanthology.org/2026.acl-srw.94.pdf (Galyukshev and Alimova, ACL SRW 2026)
- https://arxiv.org/abs/2604.19405 (Lost in Translation / MM-JudgeBench, 21 Apr 2026)
- https://arxiv.org/pdf/2306.05685 (MT-Bench and Chatbot Arena, 2023; older than 2024)
- https://platform.claude.com/docs/en/test-and-evaluate/develop-tests (Anthropic eval guide; no date visible)
- https://developers.openai.com/api/docs/guides/graders (OpenAI graders guide; no date visible)
- https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/determine-eval (Google Vertex AI eval metrics; no date visible)

## Confidence

The contact-center findings (Ingle, STREAQ, counterfactual fairness, synthetic-versus-real) come from full text and are reliable as reported, but all four are from one vendor's proprietary English-dominant data and none reports kappa on a multi-criterion scorecard; their transfer to RU/KZ chats is an inference. Some STREAQ table cells were read from a flattened PDF table; only AoI precision, the Nova-Pro row, and costs were cross-checked against the prose. The HealthBench, Trust or Escalate, GEPA, LLM-Rubric, MM-Eval and Zubiaga numbers were read from full HTML and are reliable. The reasoning-judge, confidence (except Trust or Escalate), checklist-generation, M-Prometheus and NeurIPS 2026 calibration numbers come from abstracts or conference pages only; their setups, data sizes and caveats are not verified. JEV-as-a-Judge names a "GPT-6" model and is a very recent v6 preprint; treat it as weak evidence. The MemAlign figures are self-reported by the vendor. No source gives evidence specific to Kazakh judging, to citation verification effects, or to retrieval of labeled siblings, so the recommendations on those points rest on inference, and the 24-hour effort estimates are mine.
