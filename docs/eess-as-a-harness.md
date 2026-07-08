# eess as a harness

_Where eess sits in the wider conversation about grounding AI coding agents —
specifically Thoughtworks' [Exploring Generative
AI](https://martinfowler.com/articles/exploring-gen-ai.html) series on Martin
Fowler's site. eess didn't invent a category; this note situates it honestly in
one that's being named there, and is clear about what eess adds and where the
same caveats bite._

## eess is a "harness"

Birgitta Böckeler's [Harness
Engineering](https://martinfowler.com/articles/exploring-gen-ai/harness-engineering-memo.html)
memo describes the tooling that "constrains and guides AI agents" so their output
stays reliable and maintainable at scale. Her three harness categories map almost
one-to-one onto eess:

| Harness category (Böckeler)                                                                                                        | In eess                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Context engineering** — knowledge embedded in the codebase                                                                       | `CLAUDE.md`, `docs/`, the `eess-adr-*` [skills](/dogfooding)     |
| **Architectural constraints** — "deterministic custom linters and structural tests… alongside LLM agents" (she names **ArchUnit**) | **eess-ts** — exactly this, evolved from ts-archunit             |
| **Entropy management** — "agents that detect documentation inconsistencies and architectural violations"                           | `check:corpus` + the `eess-adr-validate` skill (spec↔code drift) |

Her sharpest critique of the approach she analysed is the opening for eess: it
_"lacks verification of functionality and behaviour — focusing on maintainability
while leaving actual correctness verification unexplored."_ That gap is exactly
what eess's [enforcement tiers](/manifesto) name. The harness half covers Tier 1
(static, maintainability); Tier 2 (behavioural correctness) is the hole she points
at — and eess forces every clause to _declare_ whether it is Tier-1-gated or needs
a Tier-2 behavioural test, rather than quietly leaving it unverified. Her call to
_"direct human input to where it is most important"_ is the same move as eess's
**gate-on-the-declaration**: deterministic gates handle Tiers 1–3, human/LLM
judgment goes to Tiers 4–5.

## Spec-driven, but by validation — not generation

Böckeler's [Understanding
Spec-Driven-Development](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)
compares Kiro, spec-kit, and Tessl, and sorts SDD into _spec-first_ →
_spec-anchored_ → _spec-as-source_. All three tools are **generative**: spec →
agent → code. eess is **validational**: spec ↔ code, drift fails the build.

That difference matters because of her central warning — that spec-as-source
risks _"the downsides of both MDD and LLMs: inflexibility **and**
non-determinism."_ eess **refuses spec-as-source**: it never generates code from
the spec. Code stays hand- or AI-written; the spec is validated against it, and
[neither is privileged](/what-is-eess). So eess is _spec-anchored_ — but anchored
by validation rather than generation, sidestepping the MDD trap she flags.

## Context engineering — and the illusion of control

Her [Context Engineering for Coding
Agents](https://martinfowler.com/articles/exploring-gen-ai/context-engineering-coding-agents.html)
enumerates the very Claude Code primitives eess ships with: `CLAUDE.md`, rules
files, **Skills** (lazy-loaded guidance), subagents, hooks. Two of her points land
directly on eess:

- _"As long as LLMs are involved, we can never be **certain** of anything."_ This
  is why eess **gates rather than trusts** — and why the `eess-adr-validate` skill
  flags softly, never blocks.
- _"Well-structured code serves as powerful implicit context."_ This is why the
  `eess-adr-*` skills give a capable agent working _inside this repo_ little lift:
  the repo itself — manifesto, ADRs, `CLAUDE.md` — already is the context. The
  skills earn their keep in consuming repos that lack those docs.

## Anchoring, and "deterministic where you can"

Her [Anchoring AI to a reference
application](https://martinfowler.com/articles/exploring-gen-ai/anchoring-to-reference.html)
is the closest cousin: a compilable source of truth plus **drift detection**. The
difference is instructive — hers is example-based (few-shot from real code, AI
closes the gaps); eess is rule-based (specs as executable rules). Her own caveat —
_"when is AI bringing something new? Simple transformations work better with
deterministic tools"_ — is the same instinct as eess's split: **deterministic for
Tiers 1–3, AI only for Tier 4.**

## The problem eess answers

Erik Doernenburg's [Assessing internal quality while coding with an
agent](https://martinfowler.com/articles/exploring-gen-ai/ccmenu-quality.html) is
the problem statement. Using only manual review (no gates), he finds agents _"have
a strong tendency to introduce technical debt."_ His vivid example — the agent
inventing "an empty string signals no token," i.e. _"it kinda works"_ /
_"working code ≠ good code"_ — is precisely the plausible-but-wrong drift eess
exists to make loud, and his duplicated URL-construction logic is what eess-ts
arch/smell rules catch. His conclusion that manual oversight is still required is
also eess's honest admission: the semantic-intent half (does the rule _mean_ the
clause?) can't be made deterministic — that is Tier 4, flagged softly.

## The throughline

Every author lands on the same principle: **you cannot get certainty from an LLM,
so put the determinism where you can and be honest where you can't.** eess's whole
design is that principle made concrete — hard gates for Tiers 1–3, soft-flagging
LLM judgment for Tier 4, and `pending` for "decided but not yet green." Its
distinctive contribution to the harness idea is the **tier model**: a way to
decide, per clause, which mechanism enforces it and how hard.
