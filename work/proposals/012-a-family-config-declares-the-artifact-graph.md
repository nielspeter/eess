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
