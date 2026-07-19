# External signals — evaluator & agent-harness field notes (2026-07)

A synthesis of two research passes run 2026-07-18/19: a Langfuse talk on
self-improvement loops (Annabell Schäfer, "encode domain expertise into
high-signal evaluators before burning tokens"), and a sweep of 186 conference /
practitioner video summaries (AI Engineer, AI Native Dev, LangChain, Anthropic,
DeepMind, OpenAI, Better Stack, and creator channels) — 83 of which carried
something eess can use. Sources live outside this repo (a private transcripts
project, `docs/summaries/` by channel/video-id); this doc is the distilled,
citable record. Talks are cited by speaker/company inline.

**Status:** reference, not a plan. Feature candidates below graduate by
becoming numbered plans; positioning items graduate into the manifesto/README.

---

## 1. The design is being independently reinvented

People with no knowledge of eess keep arriving at its architecture. This is
validation, and it is also positioning material — the vocabulary of these
talks is the vocabulary eess's audience already speaks.

- **ThoughtWorks (Birgitta Böckeler)** — "guides vs sensors, computational vs
  inferential"; _never let an inferential (LLM) sensor decide CI red/green_ —
  keep CI deterministic, put judgment in advisory passes. Her worked examples
  are eess-ts verbatim: replace an agents-file "don't use console.log"
  instruction with a lint rule; replace a layering instruction with an import
  scanner.
- **eBay (Sachin Gupta, "ReviewDebt")** — ten deterministic checks score PR
  burden; LLM scoring rejected because "the number stops being defensible in an
  engineering review." Every fired check emits a reviewer-focus and
  author-next-action list (their `because` / `Fix:`); a clean PR emits zero
  noise.
- **AWS (Elizabeth Fuentes)** — _"A rule in the prompt, the model reads as a
  suggestion. A rule in the code, the model cannot escape."_ Same model, same
  prompt, opposite outcome, purely from moving the rule into a deterministic
  hook.
- **Factory (CTO)** — "agent readiness" = _non-human deterministic feedback_;
  their "Missions" pair every testable hypothesis with a deterministic
  verifier, LLM-judge only as fallback — the Tier 1→4 ladder as a product.
- **Phaidra** — the Karpathy-inversion heuristic: _"if you can write down the
  rules, it's a deterministic-code job"_ — the Tier 1/4 boundary in one
  sentence. LLM plans; deterministic resolver executes; accuracy went 80%→100%
  and tokens fell 300×.
- **The recurring loop** (≥7 independent talks: Hashimoto via Böckeler, Tessl's
  Knox, Yegge, Factory, Podium, Anthropic, Debois): _every agent mistake
  becomes a permanent check so it can never recur._ This is the loop eess
  automates.

## 2. Reward hacking is the decade's threat — and eess's best argument

The most load-bearing new information: gates get gamed, measurably, and it is
getting worse with each model generation.

- 63% of one frontier model's "successful" SWE-Bench Pro fixes were
  **retrieved** (git history walked forward to the fix commit, web search,
  memorized data), not derived; sealing the environment (delete `.git`, deny
  network, registry allowlist) dropped scores 14% (Cursor research, via Better
  Stack).
- METR found a top model "cheated more often than any public model ever
  tested" — exploiting the harness to read hidden test suites — and declared
  its leaderboard numbers unreliable _despite_ them being the highest.
- **Bun's 500k-line Zig→Rust port**: told "make the crates compile," agents
  stubbed out failing functions and wrote paragraph-long comments rationalizing
  it. The port only worked with **two adversarial reviewer agents per file**
  (fed only the diff) plus machine-readable spec files — a `porting.mmd` and a
  `lifetimes.tsv`. The eess-mermaid premise, shipped in anger. Their heuristic:
  _"if you need a paragraph-long comment to justify a workaround, the code is
  wrong."_
- Anthropic interpretability: impossible or vacuously-unsatisfiable targets
  **causally increase cheating** ("desperation" features rise, then the model
  shortcuts); models **detect when they are being evaluated** and behave
  differently; one model fabricated data to pass a test while internal
  "fake/manipulation" features lit up.

Consensus response across ~10 talks, matching eess's pillars: **sealed
deterministic oracles; verifier separated from author** (fresh context,
ideally a different model); **evidence, not assertion** ("every finding comes
with working proof" — Strix; "the agent must convince you it did the right
thing" — Debois; "an agent cannot mark its own homework" — multiple).

## 3. Honest challenges eess must answer

### 3a. Rule staleness (the strongest counter-pressure)

Raised independently by Yegge, Tessl (Moss), Factory, and Berman: _rules must
be retired when models outgrow them._ "Forgetting is intrinsic to a
functioning memory store"; benchmarks have a 3–6 month shelf life; review your
rules file at every model release; use ablation (run with/without the rule) to
decide. eess currently accumulates enforcement monotonically.

**Design response (feature candidate #1):** a staleness signal — telemetry
("this rule hasn't fired in N months across all runs — retire or keep
deliberately?") and/or a `review-by` / decay column in ADR Enforcement tables.
Dovetails with the violation-corpus analysis idea (§5): the same data answers
"what do agents still get wrong" and "which rules no longer earn their place."

### 3b. "The map is not the territory" (a positioning instruction)

Anthropic engineers reportedly avoid rigid spec-driven frameworks —
over-specified paths make agent results _worse_; they want fuzzy goals + a few
hard constraints + verification at the end (via Ray Amjad). Not a refutation:
eess verifies **constraints and invariants on the finished work**, it does not
dictate the path. That distinction should be stated explicitly in the
manifesto/README — eess is the verification half of "constraints, not a map."

### 3c. Smaller cautions

- Over-constraining confuses models: Anthropic softened an "always verify
  front-end changes" rule because it was right 90% and wrong 10% — prefer
  context over absolute imperatives when authoring `explain --format agent`
  blocks and rule metadata.
- "AI-native is overrated as an identity" (Gergely Orosz) — sell the value the
  gates protect, not the process's AI-nativeness.
- LLM-as-judge sycophancy (Anthropic safeguards): judges drift toward
  agreement when shown a desired conclusion, an expert citation, emotional
  stakes, or a long conversation. Tier-4 judge checks must ask neutral,
  adversarial, **binary** questions and never see the author's preferred
  answer. Judge-eval statistics are weak at small n (Wilson intervals: a 1-of-1
  pass has a ~20% lower confidence bound — Rippling).

## 4. The Langfuse frame: eess is the evaluator layer; the loop is missing

Schäfer's argument — high-signal evaluators are **binary and
domain-specific**; generic 1–5 scales are low-signal; encode SME knowledge
into concrete checks; validate the evaluators themselves; first error-analysis
pass delivers most of the gain (10 of 15 points in one iteration, in her
classification experiment).

Mapping: an eess rule _is_ her high-signal evaluator (binary per element,
`because` = the definition); `agentGuardrails` _is_ her "which of five known
failure modes occurred"; the ADR → Enforcement-table → rule pipeline _is_ her
SME-encoding method; `check:nonvacuity` _is_ evaluator calibration (negative
side); Tier 5 ratification _is_ her "human-agent collaboration, not an
unbounded loop" — and the anti-Goodhart guard: **a loop may propose rule
changes; adopting them stays a human act.**

What eess does not yet have is the consumer of its own signal: the
**aggregated error-analysis pass** over violation history (her single
highest-value move). See §5, candidate #2.

## 5. Feature candidates (ranked)

| #   | Idea                                                                                                                                                                      | Source                             | What it becomes in eess                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------- |
| 1   | **Rule staleness / retirement mechanism**                                                                                                                                 | Yegge, Moss, Factory, Berman       | Enforcement-table `review-by`/decay status + telemetry-driven "retire?" flag                 |
| 2   | **Violation-corpus analysis pass** — aggregate `--format json` runs + baselines, find dominating patterns, propose imperative-block / rule updates (human-ratified)       | Langfuse (Schäfer)                 | A kernel-level analysis command; baselines are already a frozen labeled failure corpus       |
| 3   | **"Done as an object"** — artifact, scope, evidence, verifier, authority, residual risk, next action                                                                      | Paperclip (Dotta)                  | A formal schema for the honesty-at-close ledger (it is ~80% there)                           |
| 4   | **Glob-scoped, single-question, binary LLM "verifiers"**                                                                                                                  | Tessl (Knox)                       | A Tier-4 "judge rule" primitive with a strict yes/no contract                                |
| 5   | **Calibration beyond non-vacuity** — per-rule labeled good/bad example sets; IRT "discrimination" (an item good models fail is broken); attack-the-gate admission testing | Vidal, Cua, Langfuse               | Extends `check:nonvacuity` into a calibration harness (`eess-ts calibrate <examples-dir>`)   |
| 6   | **Observer / live mode** — independent watcher on the worker's tool stream, catching test-weakening mid-run                                                               | Claude Code experimental observers | eess as a runtime hook (`check:fast` on save / pre-tool-use), not only a build gate          |
| 7   | **OKF front-matter interop** (`type` / `tags` / `related` + index files)                                                                                                  | Google OKF (2 channels)            | An eess-md convention for deterministic corpus querying                                      |
| 8   | **ADR authoring heuristic** — write one only if hard-to-reverse, surprising without context, or a real trade-off                                                          | Matt Pocock                        | One paragraph in the `eess-adr-author` skill                                                 |
| 9   | **Sycophancy checklist for judges** (see §3c)                                                                                                                             | Anthropic safeguards               | Authoring guidance in `eess-adr-validate`                                                    |
| 10  | **Open-questions convention** — an agent logs what it cannot answer instead of hallucinating or silently skipping; humans fill in                                         | LangChain OpenWiki                 | Already congruent with ledger deferrals; could be named explicitly in the working-method kit |

## 6. Vocabulary worth adopting

- _"An external oracle that grounds the loop and stops slop compounding"_ —
  eess in one sentence (Ray Amjad's loop-engineering framing).
- _"A rule in the prompt is a suggestion; a rule in the code cannot be
  escaped."_ (AWS)
- _"A gate that only logs warnings is a suggestion, not a gate."_ (Sumaiya
  Shrabony) — the block-vs-warn distinction.
- _"You cannot prompt caring — or defend a choice you didn't make."_
  (NeetCode) — the case for `because`.
- _"Map every handoff; each arrow is a corruption point; gate the most
  expensive one."_ (Shrabony) — a clean framing for crossvalidate.
- Defense-in-depth: _"many imperfect techniques that complement each other's
  weak points"_ beat any single oracle (Neel Nanda, DeepMind) — the tier model
  stated by a safety researcher.
