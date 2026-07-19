# External signals — evaluator & agent-harness field notes (2026-07)

A synthesis of two research passes run 2026-07-18/19: a Langfuse talk on
self-improvement loops (Annabell Schäfer, "encode domain expertise into
high-signal evaluators before burning tokens"), and a sweep of 186 conference /
practitioner video summaries (AI Engineer, AI Native Dev, LangChain, Anthropic,
DeepMind, OpenAI, Better Stack, and creator channels) — 83 of which carried
something eess can use. Talks are cited by speaker/company inline; every inline
citation resolves to the talk's YouTube video in the **source index (§7)** at
the bottom.

**Sources.** Every cited talk links directly to its YouTube video in the
source index (§7), grouped by channel. The findings were distilled from
transcript summaries of those videos; the video itself is the primary source.
The Langfuse talk was supplied as a pasted summary in the research session:
Annabell Schäfer (Langfuse), on self-improvement loops and high-signal
evaluators, June 2026.

**Reader context.** This doc assumes eess vocabulary — the enforcement-tier
model (Tier 1 static · 2 behavioral · 3 operational · 4 semantic-judgment ·
5 human ratification), rule metadata (`because` / `Fix:`), `check:nonvacuity`,
and the honesty-at-close ledger. If any of that is unfamiliar, read
[the manifesto](../docs/manifesto.md) and the ADR conventions in
[CLAUDE.md](../CLAUDE.md) first.

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

**Graduation status (as of 2026-07-19).** #8 landed in the `eess-adr-author`
skill (its "is this worth an ADR?" step); #9 landed in `eess-adr-validate`; #10
is already congruent with the working-method kit's ledger deferrals; §3b and the
§6 vocabulary shipped through plan 0072. #1 and #2 are drafted as
[plan 0073](plans/0073-violation-telemetry-rule-staleness.md) (waiting on real
adopter usage), which also absorbs the _coverage-growth_ half of the same
telemetry from plan 0067 Phase 2. The rest are unclaimed.

**Not answered by this sweep.** eess mechanizes Tier 1 plus the md/crossval
binding; a **Tier-2/3 mechanism** (clause → contract test, or a policy-as-code
hook) is the standing frontier — and nothing in 83 talks supplies one. Candidate
#4 above is Tier _4_, a different gap; §2's Bun port is the nearest field
evidence, not a mechanism. Drafted as
[plan 0079](plans/0079-tier-2-3-mechanization.md), from
[plan 0067](plans/completed/0067-harness-informed-roadmap.md) Phase 5.

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

## 7. Source index

Every talk cited above, grouped by YouTube channel — each entry links the
talk's video directly (`youtube.com/watch?v=<id>`).

**ai-engineer**

- [TJPInBjhE4Q](https://www.youtube.com/watch?v=TJPInBjhE4Q) — Sachin Gupta (eBay), "ReviewDebt: Scoring Every Pull Request" (§1)
- [WLXxTaPagA8](https://www.youtube.com/watch?v=WLXxTaPagA8) — Sumaiya Shrabony, "Every Solo Agent Builder Reinvents a Worse Version of CI/CD" (§6)
- [vJukHCIv7Ck](https://www.youtube.com/watch?v=vJukHCIv7Ck) — Elizabeth Fuentes (AWS), "Stop AI Agent Hallucinations" — rule-in-prompt vs rule-in-code (§1, §6)
- [EUsPvBeIx70](https://www.youtube.com/watch?v=EUsPvBeIx70) — Raahul Singh & Vanč Levstik (Phaidra), "Semantic Blindness" — the Karpathy-inversion (§1)
- [7P0elyLIxXo](https://www.youtube.com/watch?v=7P0elyLIxXo) — Dotta (Paperclip), "What Does Done Even Mean?" — done-as-an-object (§5)
- [uU5Gv2h8-9g](https://www.youtube.com/watch?v=uU5Gv2h8-9g) — Simon Willison × Cat Wu & Thariq Shihipar (Anthropic) — incident→eval, over-constraining (§1, §3c)
- [EfcfUB2uprc](https://www.youtube.com/watch?v=EfcfUB2uprc) — Alejandro Vidal, "Stop Evaluating Models Like It's the 50s" — IRT discrimination (§5)
- [ZSQb5fzRFPw](https://www.youtube.com/watch?v=ZSQb5fzRFPw) — Francesco Bonacci et al. (Cua), "Computer-Use 2.0" — attack-the-gate admission (§5)

**ai-native-dev**

- [tFffUnSq7VA](https://www.youtube.com/watch?v=tFffUnSq7VA) — Birgitta Böckeler (ThoughtWorks), "State of Play: AI Coding Assistants" — guides/sensors, Hashimoto's principle (§1)
- [D_cw-k0F1DM](https://www.youtube.com/watch?v=D_cw-k0F1DM) — Dru Knox (Tessl), "Harness Engineering" — binary glob-scoped verifiers (§1, §5)
- [Rgwu9nF_Xok](https://www.youtube.com/watch?v=Rgwu9nF_Xok) — Steve Yegge & Dru Knox — rule retirement, mutation testing (§1, §3a)
- [6VRKZQ3pmoU](https://www.youtube.com/watch?v=6VRKZQ3pmoU) — James Moss (Tessl), "Context Development Life Cycle" — skill staleness (§3a)
- [UvhmYntrLMI](https://www.youtube.com/watch?v=UvhmYntrLMI) — Patrick Debois, "Maps the Patterns of AI-Native Dev" — "agent must convince you" (§2)
- [I9RWrW32QEw](https://www.youtube.com/watch?v=I9RWrW32QEw) — Patrick Debois, "The Rise of Agent Enablement" — fix-the-system loop (§1)

**langchain**

- [HbUznYhKFOc](https://www.youtube.com/watch?v=HbUznYhKFOc) — Factory (CTO), "The best AI agents need more humans than you think" — agent readiness, Missions (§1, §3a)
- [J77ro1AJGa0](https://www.youtube.com/watch?v=J77ro1AJGa0) — Podium — failing trace → permanent eval (§1)
- [3lb_4OEOykc](https://www.youtube.com/watch?v=3lb_4OEOykc) — Rippling — Wilson confidence intervals for evals (§3c)
- [NxJjMvDN6aE](https://www.youtube.com/watch?v=NxJjMvDN6aE) — Brace (LangChain), "OpenWiki adopts the OKF spec" (§5)
- [sBg90v2qfas](https://www.youtube.com/watch?v=sBg90v2qfas) — Brace (LangChain), "OpenWiki Brains" — open-questions file (§5)

**better-stack**

- [pHAbwL7w83Q](https://www.youtube.com/watch?v=pHAbwL7w83Q) — "AI Benchmarks Are Fake!?" — 63% retrieved SWE-Bench fixes, sealed environments (§2)
- [27QLmUQvL2A](https://www.youtube.com/watch?v=27QLmUQvL2A) — METR on a top model gaming its harness (§2)
- [0TSxrzBVEwQ](https://www.youtube.com/watch?v=0TSxrzBVEwQ) — Bun's Zig→Rust port — adversarial reviewers, machine-readable specs (§2)
- [vRTliPb8fjg](https://www.youtube.com/watch?v=vRTliPb8fjg) — Strix — "validated findings, not 400 maybes" (§2)

**anthropic**

- [nvbq39yVYRk](https://www.youtube.com/watch?v=nvbq39yVYRk) — "What is sycophancy in AI models?" — judge-drift triggers (§3c)
- [rKV5JcALQoQ](https://www.youtube.com/watch?v=rKV5JcALQoQ) — "The different levels of how Claude thinks" — fabricated data to pass a test (§2)
- [D4XTefP3Lsc](https://www.youtube.com/watch?v=D4XTefP3Lsc) — "When AIs act emotional" — impossible targets causally increase cheating (§2)

**google-deepmind**

- [1DtMiRKg-cs](https://www.youtube.com/watch?v=1DtMiRKg-cs) — Neel Nanda × Hannah Fry — defense-in-depth, eval-awareness (§2, §6)

**the-pragmatic-engineer**

- [xafwfGVBxos](https://www.youtube.com/watch?v=xafwfGVBxos) — NeetCode × Gergely Orosz — "you cannot prompt caring" (§6)
- [cSIMVYjVF28](https://www.youtube.com/watch?v=cSIMVYjVF28) — Pragmatic Engineer AMA — "AI-native is overrated as identity" (§3c)

**ray-amjad**

- [hMgB1bjkI7o](https://www.youtube.com/watch?v=hMgB1bjkI7o) — "I Spent a Day With Anthropic Engineers" — "the map is not the territory" (§3b)
- [2-0lxK2wgJ8](https://www.youtube.com/watch?v=2-0lxK2wgJ8) — "Loop Engineering" — external oracles ground the loop (§6)
- [EVyhcfo_Zsw](https://www.youtube.com/watch?v=EVyhcfo_Zsw) — Claude Code experimental observer agents (§5)

**matt-pocock / cole-medin / matthew-berman**

- [6BB6exR8Zd8](https://www.youtube.com/watch?v=6BB6exR8Zd8) — Matt Pocock — ADR criteria, ubiquitous language (§5)
- [T33iI6izAKw](https://www.youtube.com/watch?v=T33iI6izAKw) — Cole Medin on Google's Open Knowledge Format (§5)
- [bjHuGNo3spk](https://www.youtube.com/watch?v=bjHuGNo3spk) — Matthew Berman on J-Space — models detect evaluation (§2)
- [etduwo9Lu3M](https://www.youtube.com/watch?v=etduwo9Lu3M) — Matthew Berman — review rules files at every model release (§3a)
