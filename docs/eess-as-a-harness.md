# eess as a harness

_Where eess sits in the wider conversation about grounding AI coding agents. The
term of art is emerging as **harness engineering**: the tooling and practices that
constrain and guide agents so their output stays reliable at scale. eess didn't
invent this category — this note situates it honestly against the people naming
it, and is clear about what eess adds and where the same caveats bite._

## The harness, in the wild

Two of the most aggressive agent-first engineering efforts published case studies
of building a harness from scratch:

- **OpenAI — [Harness
  engineering](https://openai.com/index/harness-engineering/)**: an internal
  product, ~1M lines of code in five months with **zero manually-written lines** —
  every line written by Codex. _"Humans steer. Agents execute."_
- **Stripe — [Minions](https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents)**:
  one-shot end-to-end agents merging **1,000+ agent-produced PRs per week** into a
  codebase that _"moves well over $1 trillion per year of payment volume."_

Birgitta Böckeler's [Harness
Engineering](https://martinfowler.com/articles/exploring-gen-ai/harness-engineering-memo.html)
memo (part of Thoughtworks' [Exploring Generative
AI](https://martinfowler.com/articles/exploring-gen-ai.html)) is the analysis that
names the category.

## Both shops hand-rolled what eess packages

The striking thing about the OpenAI and Stripe write-ups is how much they
independently reinvented — per repo, from scratch — the exact pieces eess offers
as a reusable, cross-artifact framework:

| What they built ad-hoc                                                                                                                                                                                                                                                                                         | In eess                                                                                                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenAI: _"a rigid architectural model… a fixed set of layers, strictly validated dependency directions and a limited set of permissible edges… enforced mechanically via custom linters and structural tests"_ (Types→Config→Repo→Service→Runtime→UI, forward-only, cross-cutting via one Providers interface) | **eess-ts** — `layeredArchitecture`, `notDependOn`, `slices().respectLayerOrder()`. They cite ArchUnit; eess-ts is that, reusable.                                                                                                                 |
| OpenAI: docs/ as _"the system of record,"_ `AGENTS.md` as _"the table of contents, not the encyclopedia"_ — after _"one big AGENTS.md"_ failed because _"it doesn't lend itself to mechanical checks (coverage, freshness, cross-links), so drift is inevitable"_                                              | **`CLAUDE.md` + the corpus**, and **eess-md's `check:corpus` is exactly those mechanical checks** — cross-links resolve, code pointers ground, ADR tables valid. Their `exec-plans/{active,completed}` + `tech-debt-tracker` mirror `work/plans/`. |
| OpenAI: _"because the lints are custom, we write the error messages to inject remediation instructions into agent context"_                                                                                                                                                                                    | eess-ts `.because()` / `.rule({ suggestion, docs })`, and gate output that reports what it scanned                                                                                                                                                 |
| OpenAI: _"when documentation falls short, we promote the rule into code"_; _"human taste captured once, then enforced continuously"_                                                                                                                                                                           | the **tier / mechanism / status model** — a clause moving `manual` → `gated` _is_ "promote prose to code," made explicit and tracked                                                                                                               |
| OpenAI: background tasks that _"scan for deviations, update quality grades, and open targeted refactoring pull requests"_ (entropy / garbage collection)                                                                                                                                                       | `check:corpus` + the `eess-adr-validate` skill — the drift-scanner half                                                                                                                                                                            |
| Stripe: _"mix the creativity of an agent with the assurance that they'll always complete Stripe-required steps like linters"_; _"shift feedback left"_ (local lints < 5s before CI)                                                                                                                            | eess's exact split — **deterministic gates + agent only for Tier 4** — run locally (`npm run validate`, and `--changed` / `--watch`) and in CI                                                                                                     |
| Stripe: _"almost all agent rules… conditionally applied based on subdirectories"_                                                                                                                                                                                                                              | eess-ts rules scoped by `resideInFolder` / globs                                                                                                                                                                                                   |

The headline: the two most aggressive agent-first shops in the industry
independently built layered-architecture structural tests, doc-as-system-of-record
with mechanical consistency checks, remediation-in-lint-messages,
promote-prose-to-code, and continuous entropy cleanup. **eess is those pieces,
packaged** — reusable across artifacts (TS, Mermaid, Markdown), with an explicit
tier model — instead of hand-rolled per repo.

## What eess adds: the tier model — not a "missing verification" fix

An earlier version of this note repeated a claim (from a summary of the OpenAI
memo) that its harness _"lacks verification of functionality and behaviour."_
Reading the [primary source](https://openai.com/index/harness-engineering/)
corrects that — fittingly, the eess thesis biting a doc that drifted from its
source. OpenAI's _"Increasing application legibility"_ section **is** behavioural
verification: the app is bootable per git-worktree, the Chrome DevTools Protocol
is wired into the agent, observability is exposed via LogQL/PromQL, and they assert
performance SLOs like _"ensure service startup completes in under 800ms"_ and
_"no span exceeds two seconds."_ That is Tier 2/3 enforcement.

So eess's contribution is not filling a gap they left. It is making the split
**explicit and declarable**: eess's [enforcement tiers](/manifesto) force every
clause to name _which kind of fact it is_ (static / behavioural / operational /
judgment / rationale), _what mechanism_ checks it, and _what status_ it's in
(`gated` / `pending` / `manual` / …). OpenAI and Stripe verify across several
tiers; eess adds the taxonomy so that nothing is _silently_ unverified — the
unenforced surface becomes a queryable list rather than an assumption.

## Spec-driven — by validation, not generation

Böckeler's [SDD
survey](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html) sorts
spec-driven development into _spec-first_ → _spec-anchored_ → _spec-as-source_.
OpenAI, Stripe, and the SDD tools are all **generative**: intent → agent → code.
eess is orthogonal: it is **validational** — spec ↔ code, drift fails the build,
and it does not care _who_ wrote the code. That is why eess composes _with_ a
generative harness rather than competing with it: OpenAI and Stripe would use an
eess-style layer as the mechanical guardrail their agents run against.

It also sidesteps Böckeler's warning that _spec-as-source_ risks _"the downsides
of both MDD and LLMs: inflexibility and non-determinism."_ eess never generates
code from the spec; [neither spec nor code is privileged](/what-is-eess).

## Context engineering — and the illusion of control

Böckeler's [Context
Engineering](https://martinfowler.com/articles/exploring-gen-ai/context-engineering-coding-agents.html)
and OpenAI's _"give Codex a map, not a 1,000-page instruction manual"_ land on the
same two lessons eess lives:

- _"As long as LLMs are involved, we can never be **certain** of anything."_ →
  eess **gates rather than trusts**, and the `eess-adr-validate` skill flags
  softly, never blocks.
- _"Well-structured code serves as powerful implicit context."_ → this is why the
  `eess-adr-*` skills give a capable agent working _inside this repo_ little lift:
  the manifesto, ADRs, and `CLAUDE.md` already are the context. The skills earn
  their keep in consuming repos that lack those docs.

## The throughline

Every author lands on the same principle: **you cannot get certainty from an LLM,
so put the determinism where you can and be honest where you can't.** OpenAI
_"promote the rule into code."_ Stripe _"always complete required steps like
linters."_ eess makes that principle a taxonomy: hard gates for Tiers 1–3,
soft-flagging LLM judgment for Tier 4, `pending` for "decided but not yet green."
Its distinctive contribution to the harness idea is the **tier model** — a way to
decide, per clause, which mechanism enforces it and how hard.
