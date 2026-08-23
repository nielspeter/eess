---
name: review-proposal
description: "Review an eess proposal for family fitness before it becomes a plan — does the ask already exist, does it belong in the kernel or in one dialect, and can the new capability actually go red? Use this skill whenever: a proposal in work/proposals/ is opened or mentioned, someone suggests a new API/builder/predicate/condition/preset for eess or one of its dialects, you're about to write or review a plan that adds public API surface, or anyone says 'proposal', 'new feature', 'new API', 'add method', 'add builder', 'add predicate', 'add condition'. Runs architect + product + enforcement reviews in parallel."
argument-hint: "<path-to-proposal or 'this proposal'>   e.g. /review-proposal work/proposals/001-md-corpus-rule-coverage.md"
---

# Review a proposal (before it becomes a plan)

eess is a **family**: a dialect-independent kernel (`@nielspeter/eess`) with sibling
dialects — `eess-ts`, `eess-md`, `eess-mermaid`, `eess-gherkin`, `eess-crossvalidate`.
It ships composable primitives, not opinions. An ask that lands in a dialect serves
every consumer of that dialect; an ask that lands in the kernel serves **every dialect
at once** — and constrains every one of them forever.

A **proposal** is design under debate: the shape of a capability, argued from measured
evidence, with its open questions still open. It is not a work order. An accepted
proposal becomes a **plan** in [`work/plans/`](../../../work/plans/) (via `/plan`,
stopping at Draft), and any binding decision inside it becomes an **ADR** in
[`adr/`](../../../adr/). This skill is the gate in between — it reviews the design
before anyone writes the plan, let alone the code.

Three lenses:

1. **Architect** — does this follow existing patterns, and is it in the right package?
2. **Product** — is it generic, or shaped by one corpus's specific bug?
3. **Enforcement** — can the new capability go red, and does the proposal say how?

## Background: what actually goes wrong

**Duplication — the #1 failure mode.** A proposal for "call rule builder exclusions"
went through three drafts in ts-archunit, whose engine is now `packages/core` +
`packages/ts` — the same code this repo ships, so the lesson is not history, it is
local. Draft 1 invented a second `.excluding()` without realising the base builder
already had one. Draft 2 proposed a `.not()` chain method with a `_negateNext` state
flag without realising `not()` already existed as an exported combinator and was
already used by presets. Draft 3 shipped as a pure docs fix — zero code changes.

**Placement.** The kernel/dialect line is eess's own architecture, and getting it
wrong is expensive in both directions: a dialect-specific concept smuggled into
`packages/core` poisons five dialects with knowledge they don't need, and a genuinely
cross-dialect primitive stuck inside one dialect gets reinvented four more times.
`correspondence()` is the kernel's answer to "two artifacts must agree" — a proposal
building a second join engine inside a dialect is building a parallel hierarchy.

**Unfalsifiable gates.** [Proposal 001](../../../work/proposals/001-md-corpus-rule-coverage.md)
carries its own recorded correction: its first draft specified **six new ways to fail
a build with no non-vacuity criteria at all** — a specification asserting what should
hold, with nothing that fails when it doesn't. That is precisely the defect this
project exists to prevent, committed inside a proposal about it, and it survived a
full draft unnoticed. This is why enforcement is a lens and not a footnote.

The root cause of the first two is the same: **the proposal was written without
surveying existing code.** The third has its own: the proposal described the capability
and never the corruption it must catch.

## Step 1: Locate the proposal

From `$ARGUMENTS`, find the proposal to review:

- A file path → read it.
- "this proposal" or similar → the recently opened `.md` under
  [`work/proposals/`](../../../work/proposals/), or the most recent one in the
  conversation.
- If unclear, ask.

Also read anything the proposal is already bound to — a plan that cites it, an ADR it
depends on. A proposal reviewed in isolation from its plan gets re-litigated later.

## Step 2: Existing code survey (MUST happen first)

Before evaluating any ask, survey the codebase for capabilities the proposal may be
unaware of. This is the most important step, and it must cover **both axes**: does the
capability exist, and where does it belong?

For every new builder, method, type, condition, predicate or preset the proposal wants:

1. **Grep the concept across all packages** — `packages/*/src`, not one dialect. If the
   ask is "negation", grep `not`, `negate`, `exclude`, `invert`. A dialect often already
   has the element type the proposal thinks is missing (`packages/md/src/builders/` ships
   `docs`, `links`, `pointers`, `rows`, `task-items`, `vocabulary` — a proposal asking
   for task-item assertions must say why `taskItems()` doesn't already answer it).
2. **Check the kernel first** — `packages/core/src/index.ts` for what is already public;
   `rule-builder.ts` for the base surface every dialect inherits (`that` · `and` ·
   `should` · `andShould` · `satisfy` · `because` · `rule` · `excluding` · `select` ·
   `check` · `warn` · `severity` · `fork`); `combinators.ts` for `not()`/`and()`/`or()`,
   which compose with `satisfy()` on **every** builder; `correspondence.ts` for the
   two-sided join; `report.ts` / `violation.ts` for reporting (ADR-008).
3. **Check the target dialect's layering** — dialects follow
   `model(s)/ → predicates/ → conditions/ → builders/` (+ `presets/` in ts, `rules/` in
   md). A new element type costs a `getElements()` plus predicates and conditions, and
   inherits the whole base surface for free. If a proposal is adding conditions to an
   existing builder where a new element type is the honest answer, say so — and vice
   versa.
4. **Check the sibling dialects for precedent** — the strongest evidence for the right
   shape is that another dialect already has it. If `ts` exposes a method in both
   predicate and condition form, an md proposal asking for the same is following
   precedent, not inventing. If **no** dialect has it, ask why this one is special.
5. **Check presets and rules for usage** — `packages/ts/src/presets/`,
   `packages/md/src/rules/`. If a preset already does the thing by hand, the mechanism
   exists and the ask may be "promote it", not "build it".
6. **Check the repo's own rules files** — `arch.rules.ts`, `spec.rules.ts`,
   `mermaid.rules.ts`. eess dogfoods itself; a capability the repo's own gates would
   have used is well-motivated, and one they wouldn't deserves a question.

Collect findings into an **Existing code survey** section. For each ask, state one of:

- **Already exists** at `path/to/file.ts:LINE` — with the call that would express it.
- **Exists in a sibling dialect** at `path:LINE` — precedent to copy, not invent.
- **Genuinely new** — no equivalent found, and here's where it belongs
  (`packages/core` if every dialect would want it; the dialect if only one would).

## Step 3: Spawn architect + product + enforcement reviewers

Spawn **all three** in a **single message** (parallel execution). Give each the
proposal content, the Step 2 survey findings, and the shared context below.

**Shared context for every reviewer:**

- eess is a family — the kernel serves all dialects; a dialect serves all its users.
- The ADRs in `adr/` are **binding**: 003 (fluent builder DSL), 005 (no `any`, no `as`),
  006 (rules are code, not config; presets are functions), 007 (AST engine confined
  behind one boundary), 008 (caller owns reporting — detection ≠ emission).
- The base `RuleBuilder` owns shared behaviour; builders inherit, they don't duplicate.
- `not()`/`and()`/`or()` in `packages/core/src/combinators.ts` compose via `satisfy()`.
- `correspondence()` in the kernel is the existing two-sided join.

### Architect review

1. **DUPLICATION** — does any ask duplicate an existing capability? (The #1 failure mode.)
2. **PLACEMENT** — kernel or dialect? Would another dialect want this? Does anything
   dialect-specific leak into `packages/core`? Does anything cross-dialect hide in one
   package?
3. **PATTERN FIT** — does the proposed API follow `model → predicates → conditions →
builders`, or invent a mechanism beside it? Read the files the survey cites and compare.
4. **LAYERING** — right level? Base builder vs. per-dialect? New element type vs. new
   condition on an existing one? Predicate vs. condition (and does it need both — the
   dual-use phase dispatch)? Pre-filter vs. post-filter?
5. **COMPOSABILITY** — do the primitives compose with `not`/`and`/`or`/`satisfy`, and is
   each new element type usable as a side of `correspondence()` via `.select()`?
6. **EDGE CASES** — state leakage across `fork()`, phase-guard interaction, dual-use
   dispatch, violation line attribution (elements must report their **own** line).
7. **ADR COMPLIANCE** — against all eight. And the inverse: does any ask constitute a
   _new_ binding decision that belongs in an ADR rather than buried in the proposal?

Structure findings as: Critical / Important / Minor / Praise.

### Product review

1. **GENERIC FITNESS** — would a developer on any project understand and use this, or is
   it shaped by the one corpus that motivated it? (Evidence from a real corpus is a
   strength; vocabulary from it in the API is not.)
2. **NAMING** — do names read in a README strangers read? Do they match the sibling
   dialects' vocabulary, or introduce a second word for an existing concept?
3. **EXAMPLES** — generic scenarios, or the source project's terminology and language?
4. **SCOPE** — the minimum generic primitive, or a narrow convenience layer? Is the
   proposal one shippable thing, or several that should be split and sequenced?
5. **EXISTING SOLUTION** — given the survey, is this new API or a docs gap? (Capabilities
   that exist but are undiscoverable read exactly like missing features.)
6. **BACKWARDS COMPATIBILITY** — does anything break existing rules, and is the release
   additive (minor) or breaking (major)? Six packages version independently — say which
   ones move.

Structure findings as: Critical / Important / Minor / Praise.

### Enforcement review

The lens the other two won't apply. eess exists so that drift **fails the build**; a
proposal that adds gates must specify how each one goes red.

1. **BREAK CLASS PER CAPABILITY** — for every new way to fail a build, does the proposal
   name the specific corruption that must produce a violation? A capability with no break
   class is unfalsifiable.
2. **WHAT THE VIOLATION SAYS** — colour is not the proof, attribution is. Does the
   proposal specify the message, and would it send an author to the right fix? (A
   spelling drift reported as an absent field sends them to add a second field.)
3. **NON-VACUITY** — is each capability represented in `scripts/check-nonvacuity.mjs`,
   so an emptied implementation can't stay green? A rule matching zero elements is the
   failure class that gate exists for.
4. **TIER** — which manifesto tier (1 static · 2 behavioral · 3 operational · 4 semantic ·
   5 ratification) does the capability enforce at, and is that honest? A Tier-4 claim
   dressed as a Tier-1 mechanism is over-claiming.
5. **FALSE POSITIVES** — for heuristic extractors especially: what is _green_ that looks
   red? If it can't be made quiet, should it ship `.warn()`-only?
6. **DOGFOODING** — would this repo's own gates use it, and does the proposal say so?
   The family that can't state its own conventions in its own dialect is the finding, not
   the exception.

Structure findings as: Critical / Important / Minor / Praise.

## Step 4: Synthesize

After all three return, write a synthesis:

### Verdict

One line: **Ship as-is** / **Ship with changes** / **Split and sequence** / **Rewrite
needed** / **Docs-only** / **Reject**.

### Existing code survey results

Per ask: already exists / exists in a sibling dialect / genuinely new. The most
actionable section — past proposals have been resolved entirely by this finding.

### Placement call

Per ask: `packages/core` or which dialect, and why. Name anything that must **not** move
into the kernel.

### Critical issues (must address)

Deduplicated across all three reviewers. Lead with duplication and placement.

### Important concerns (should address)

Deduplicated list.

### Minor suggestions

Brief list.

### Praise

What the proposal gets right.

### Recommended next step

Concrete, in the house vocabulary — e.g. "drop Ask 3, the kernel's
`correspondence().select()` already expresses it — docs example instead"; "write the
break class for `fileRefs()` before this becomes a plan"; "the frontmatter-precedence
question is a binding decision — ADR first"; "accept asks 1–2, `/plan` them as Draft,
leave 3–6 in the proposal". Say explicitly whether the proposal is ready to become a
plan, and what must be settled first.

## Step 5: Record the Ruling in the proposal file

The synthesis above is chat-facing. The proposal file itself needs the verdict in
one fixed, literal shape — `PROPOSALS.md`'s own Vocabulary section promises this
("recorded _in the proposal_, as a `## Review — YYYY-MM-DD` section, with the
submission preserved below it"), and [bug 0141](../../../work/bugs/0141-no-check-binds-accepted-proposals-to-plans.md)
found that promise was never wired to an actual instruction — five different
proposals ended up with five different shapes of `**Ruling:` line, none of them
reliably parseable.

Append to the proposal file (never edit the submission above it away — corrections
and re-reviews stack, they don't replace):

```markdown
## Review — YYYY-MM-DD

**Ruling: <verdict>**

<the reasoning — the synthesis above, in prose>
```

`<verdict>` is copied **verbatim, same casing**, from `PROPOSALS.md`'s Ruling
table — exactly one of: `Ship as-is` / `Ship with changes` / `Split and sequence` /
`Rewrite needed` / `Docs-only` / `Reject`. The bold span closes immediately after
the verdict — `**Ruling: Rewrite needed**`, not `**Ruling: Rewrite needed — because
…**` — so the line is a fixed-shape header a parser can key on, never a sentence to
truncate a regex against. A proposal reviewed more than once gets more than one
`## Review —` section, in order; the most recent one is the operative Ruling.

**A consequence, not a decision made here.** Writing `Ship as-is` or `Ship with
changes` makes `check:corpus` go red on this proposal the moment the file is
saved — [plan 0142](../../../work/plans/0142-bind-proposals-to-plans.md)'s
linkage gate has nothing to point at until a plan declares
`**Implements:** proposal NNN` against it. That red is expected and does not mean
the review did anything wrong; it means `/plan` (the next step, a human decision,
not this skill's) is now owed before `check:corpus` is clean again — this skill
records the finding and stops, per its own guard below, and does not accept the
proposal by writing the Ruling.

**Reviewing never closes a proposal either.** The lane has terminal states —
`Promoted` (a plan or bug owns the ask, and the header names it) and `Rejected` —
but they mark _dispatch_, not _verdict_. A proposal ruled `Rewrite needed` stays
`Draft`, because the material is still live. Writing `State: Promoted` is the job
of whoever files the owning record, in that record's own PR, and `check:corpus`
refuses it when no owner declares `**Implements:** proposal NNN`, when the ruling
is `Rewrite needed`/`Reject`, or when any disposition row is still `Held`.

## Guards (the failures models actually have)

- **Skipping the survey.** Every duplication finding in this project's history came from
  a proposal written without reading the code. Step 2 is not optional and not last.
- **Surveying one package.** The ask may be answered by the kernel or by a sibling
  dialect. Grep `packages/*/src`, always.
- **Reviewing the ask instead of the shape.** "Should we have this capability?" is the
  easy half. "Where does it live and how does it go red?" is where proposals fail.
- **Accepting a proposal by reviewing it.** A green review produces a Draft plan, not
  code. Authoring is not committing to build.
- **Settling the author's open questions.** A proposal's **Open Questions** are decisions
  reserved for the library author. Surface them, argue them, flag any the reviewers think
  are actually blocking — but don't quietly resolve one in the synthesis.
- **Losing the correction.** If the review finds a defect the proposal committed _in
  itself_, record it in the proposal rather than silently fixing it. That is how the
  template learns.
