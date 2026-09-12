# Proposal 012 — a family config declares the artifact graph

**State:** Draft — **what this produces is a decision, not a change.** The asks
below cannot be evaluated until the prior question in Ask A is settled: whether a
family config declares _artifacts and their bindings_ or _dialects and their rule
files_. Every count below was measured against this repo at the head of `main`
(v0.5.1), not recalled; each measurement names the command that produced it. No
red test written; nothing here is a defect yet.

## Problem

Five dialects, one kernel, and no way to say what a project's eess configuration
_is_. Each consumer assembles the run by hand, and what they assemble is a list
of commands rather than a statement of what must agree with what.

Measured here:

| fact                                               | count  |
| -------------------------------------------------- | ------ |
| `check:*` scripts in this repo's `package.json`    | 19     |
| of those, invocations of a dialect CLI             | 4      |
| packages shipping a `bin`                          | 2 of 6 |
| binding subpaths published by `eess-crossvalidate` | 7      |

So fifteen of nineteen gates here are bespoke scripts, and the consuming project
this family was last measured against carries thirteen of its own. Every one of
them re-implements the same two things: what did I scan, and did I fail closed.

**That re-implementation is the cost, and it is not hypothetical.** Four of this
repo's drivers call the shared emitter a handful of times and then write their
own printing and exit handling around it — 25 such lines in `check-corpus.mjs`,
15 in `check-ledger.mjs`. Meanwhile the one well-tested CLI was found, this week,
printing **nothing at all** under the output format CI selects by default, so a
clean run reported no denominator
([bug 0223's review](../bugs/fixed/0223-type-module-rule-files-cannot-import-a-sibling.md)).
One command with that defect is a bug. Four hand-rolled drivers per adopter, in
code nobody reviews, is a category.

**But the deeper problem is not ergonomics.** A list of rule files cannot express
the thing the family is for. The purpose is that a Gherkin feature is implemented
in code, a Mermaid diagram is realised in code, an ADR's clause is proven by a
test — that the layers are coherent. A config that says
`rules: ['arch.rules.ts', 'spec.rules.ts']` names scripts and says nothing about
which artifacts are being held together, so **an artifact bound to nothing is
indistinguishable from an artifact that needs no binding.** The run is green
because the check was never declared, which is the failure class this project
exists to refuse.

## Existing code survey

Every ask below was checked against the code first. Nothing here proposes
building something the family already has.

- **The two-sided join exists.** `correspondence()` in `packages/core` is the
  kernel's primitive for "two artifacts must agree", and it already drives both
  directions. Nothing needs a second join engine.
- **The edges exist, as published subpaths.** `eess-crossvalidate` ships
  `mermaid-ts`, `md-ts`, `md-mermaid`, `md-gherkin`, `gherkin-ts`,
  `md-mermaid-er`, `files`. Those are the artifact graph, spelled one import at a
  time in each consumer's driver.
- **Completeness is already distinguished from citation-resolution.** Measured by
  running `npm run check:crossval`: it reports
  `scenario↔test (every citation resolves)` and, separately,
  `scenario↔test (every scenario is proven by a test)`. The second is the one
  that refuses an orphan. So the primitive this proposal depends on is built and
  green.
- **The merge and the emitter exist.** `mergeCollectResults`, `collectResult`,
  `hasEvidence`, `reportViolations` and `finishPreset` are all published from the
  kernel root today, verified by importing `@nielspeter/eess`. ADR-008 put
  reporting behind one emitter and ADR-014 made it refuse a verdict without
  evidence — a runner is the caller those decisions were written for.
- **No dialect config is family-shaped.** `eess-ts.config.ts` takes
  `{ rules, format, watchDirs }`, and `eess-mermaid`'s is the same shape. Both
  describe one dialect's run, neither describes a project.

So the machinery is present and the gap is a declaration.

## Asks

**Ask A — decide what a family config declares.** Two candidate shapes, and this
is the prior question the rest depend on:

1. **Artifacts and bindings.** The config names the artifacts in the project —
   the TypeScript project, the diagram, the ADR directory, the feature files, the
   markdown corpus — and the edges that must hold between them. The dialects
   become readers for an artifact type rather than tools a project invokes.
2. **Dialects and rule files.** The config names which dialects are in play and
   which rule files each one runs. Closer to what exists; expresses the run, not
   the coherence.

The proposal's author favours (1) and says so rather than hiding it, because (2)
cannot express "this artifact is bound to nothing" — which Ask C is about. But
(1) is unproven against this repo's own gates, which is the risk Ask B tests.

**Ask B — test the chosen shape on paper against this repo, before any code.**
Write the config for all 19 `check:*` gates here and all 13 in the consuming
project, and count how many it can express. Only 4 of 19 are dialect
invocations; the rest are bespoke. A shape that covers a fifth of the work may
still be worth shipping — that fifth is the ordinary adopter's whole world — but
it must be **sold as that**, and the number has to be known before the claim is
made rather than after an adopter discovers it.

**Ask C — an artifact bound to nothing is a finding.** With the graph declared,
"these two artifacts are present and nothing binds them" becomes checkable, in
the same way the evidence gate made "this rule examined nothing" checkable. This
is the ask that justifies the config; without it the config is a convenience.

**Ask D — one command runs the deterministic tiers, and says so.** A family
runner collects receipts, merges them fail-closed, and emits once. It runs
tiers 1 and 2. It does **not** run tier 4, which the manifesto defines as
judgments with no deterministic checker, mechanism "LLM validator, with cited
evidence" — that stays with the skills and the reviewer loop, where
`eess-adr-validate` already lives. The boundary must be stated in the command's
own output, because "one main CLI" invites the reading that it checks
everything.

**Ask E — decide where it lives.** `eess-crossvalidate` is the only package that
already peers on all four dialects, and none of them depends on it, so it is the
one package positioned to see the whole graph. A sixth package duplicating that
peer structure beside it would need an argument. The counter-argument is that
crossvalidate's entries are verdict functions rather than a fluent chain, so a
runner would arrive as a new subpath rather than as a use of what is there.

## Acceptance criteria

- The config expresses a named count of this repo's own gates, and that count is
  written down before the capability is described to anyone.
- An artifact declared with no binding produces a violation naming the artifact
  and the edge that is missing — red first, against a fixture with a features
  directory nobody bound.
- The runner's verdict is refused when any dialect hands back no evidence, per
  ADR-014, and its output carries a denominator **per dialect** rather than one
  summary number. A single exit code across five dialects is a good place to hide
  a vacuous gate.
- Removing any one binding from the config reds the run — measured one at a time,
  not asserted.

## Open questions

1. **Ask A's prior question is the proposal.** Nothing else can be evaluated
   until it is answered, and it is the author's to answer, not this document's.
2. **Can a graph config express single-artifact checks at all?** `check:arch` is
   not a binding; it is one artifact against a rule file. Either the config has
   two kinds of entry, or single-artifact checks stay outside it and the coverage
   number in Ask B gets worse.
3. **What does `files` mean in the graph?** `eess-crossvalidate` ships it beside
   six named pairs, and it is not obviously an edge between two artifact types.
4. **Does this belong in an ADR before a plan?** A family config constrains all
   five dialects and every future one. That is ADR-011/012/013 weight.

## Out of scope

- **Giving each dialect its own CLI.** A separate question, and the weaker one:
  it would add a fifth thing for each consumer to wire rather than removing the
  wiring. If the runner lands, the standalone-CLI question mostly dissolves.
- **Tier 4 validation.** Named in Ask D only to draw the boundary.
- **Replacing this repo's bespoke drivers.** Measured, `check-corpus.mjs` is 1,136
  lines and contains zero rule invocations in the shape a runner would execute —
  it is repo-specific policy, not plumbing. It stays either way, and any claim
  that a runner reduces it is false.

## A caution this proposal owes its reviewers

Written at the end of a session in which nearly every defect found was a claim
generalised from the one shape its author had tested — one barrel of five, one
field of a manifest, one project type of two, one file of an import graph. The
counts in this document are therefore each tied to the command that produced
them. The one number most likely to be wrong is Ask B's, because it has not been
measured at all yet; that is why Ask B exists before any code.

Related, and visible in the same `check:crossval` output: `md↔gherkin` reports
**1 citation across 4 scenarios**. Three stories are unbound today, in the repo
that invented the check. Whatever the config declares, it has to make that
visible rather than let a low number sit in the output unremarked.

## Review — 2026-09-12

**Ruling: Rewrite needed**

Three lenses, all reporting findings the submission above does not survive. The
material about reporting is real and worth keeping. The container is wrong, and
the survey missed the two things that decide it.

**The artifact graph already exists, as a rule file.** `spec.rules.ts` imports
`rows` from `eess-md` and `files` from `eess-crossvalidate` into an `eess-ts`
rule file, declares four artifacts, and joins them with two
`correspondence(...).beComplete({ direction: 'both' })` calls. One command runs
it; it emits once. Ask A's option (1) — "the config names the artifacts and the
edges, the dialects become readers" — is not a candidate shape. It is what this
repo already does, and `CLAUDE.md`'s own project tree describes that file as
exactly that. Ask A's option (2) is at a different level: `rules: ['spec.rules.ts']`
names the file, the file declares the graph. So the prior question the whole
proposal rests on is **malformed as posed**, and the survey's sentence "Nothing
here proposes building something the family already has" is false.

**ADR-006 already ruled on the other half, and the proposal does not cite it.**
"Rules are code, not config" is its decision line. Its rejected alternatives lead
with JSON config; its consequences say there is no centralized config file, users
write TypeScript instead, and "this is a feature, not a bug." The submission
cites ADR-008, 011 and 014 and never 006 — the one ADR that rules on its central
ask. Any rewrite must either be a TypeScript module exporting declarations, in
which case it is a rule file and no decision is owed, or a data config, in which
case it needs an amendment to ADR-006 that survives 006's own argument.

**Ask C is self-defeating as written, and unbuildable on half the graph.** A
checker that reads the config can only see artifacts someone declared, so an
artifact nobody wrote down stays invisible — green because the check was never
declared, which is the sentence the Problem section uses to condemn the status
quo, reproduced one level up. The fork is whether artifacts are **discovered** or
**declared**, and the submission never names it. Separately, measured across all
seven crossvalidate subpaths: only `mermaid-ts` and `gherkin-ts` can express
"bound to nothing" by default; `md-mermaid` can but does not default to it; and
`md-ts`, `md-gherkin` and `md-mermaid-er` cannot at all. `md-ts` hardcodes
`left-to-right`; `md-gherkin` ships only `scenarioCitationsResolve` and
`scenarioCitationStats`. So Ask C requires three new completeness primitives and
a default flip, none of it stated.

**The submission's own footnote was the live instance and it was under-read.** It
notes `md↔gherkin` reporting 1 citation across 4 scenarios and calls it a number
that should not sit unremarked. It is more than that: three scenarios are bound
to no document, the gate is green, and it is green because that edge has no
direction that could go red. Ask C's exact failure class, present today,
unfalsifiable, in the repo that invented the check.

**Ask B's unknown number is now measured, and it is the one that kills the
framing.** The enforcement lens reports 1 of 18 as written, 6 of 18 if open
question 2 is answered "two entry kinds", 9 of 18 counting partial absorption.
The submission said this number had to be known before the capability was
described. It now is.

**What survives, and it is the better proposal.** The kernel has no way to say "I
ran, here is what I examined, nothing was wrong": `reportViolations` returns early
on an empty receipt (`packages/core/src/report.ts`), so the clean-run denominator
is implemented in both dialect CLIs, in several other places, and again by hand in
every adopter driver. That is why bug 0223's review found the well-tested CLI
printing nothing under CI's chosen format — the capability has no single home.
Measured in the one real consumer: a 67-line driver of which roughly 40 lines are
scope printing and exit handling around one rule. A kernel receipt printer is
generic, small, needs no config, and would not have been visible without this
review.

**Ask D is largely `checkAll` one level up.** `packages/ts/src/core/check-all.ts`
already merges receipts, gates through `finishPreset(receipt, { report: 'return' })`,
dedupes, filters baseline and diff, and emits once — typed on kernel interfaces,
with one local dependency on `execute-rule.js` for the aggregation flag. The
honest framing is "lift `checkAll` to the kernel and solve the flag", not "build a
runner".

**Ask C also has a precedent one level down**, missed by the survey:
`unboundDeclarationFindings` in `packages/ts/src/builders/correspondence-findings.ts`
fires when a declaration names a side neither side of the join has. And a tension
the submission never argues: `beComplete` and the absence-assertion form are both
`marksAssertsCardinality`, so the kernel's own join deliberately declines to fail
on an empty side inside a declared binding, while Ask C proposes failing on
emptiness outside one.

**Recommended next step.** Rewrite around the reporting gap, which is one
shippable generic thing: a kernel primitive that reports a clean run with its
denominator. Drop Ask A and Ask E — `spec.rules.ts` and ADR-006 answer them
between them. Re-file Ask C only after deciding discovered-versus-declared, and
only with the three missing completeness primitives named as its scope. Ask D
becomes "lift `checkAll`", which may be a bug rather than a proposal.

**A correction this review owes, recorded rather than fixed away.** The survey
section was written by the proposal's author and asserts completeness it did not
have. It read `check-crossval.mjs` and the crossvalidate subpaths and stopped at
the package boundary; the answer to its central question was in a rule file at the
repo root, named in `CLAUDE.md`. `PROPOSALS.md` records three prior proposals lost
to exactly this. This is the fourth.
