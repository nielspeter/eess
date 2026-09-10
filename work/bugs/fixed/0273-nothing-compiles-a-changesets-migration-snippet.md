# Bug 0273: nothing compiles a changeset's migration snippet

## Status

- **State:** Fixed — `check:docs-code` compiles the module-claim statements a
  changeset fence carries, so a stated export location is checkable. It does not
  require one to be stated; that residual is [bug 0275](../0275-a-migration-can-still-state-its-claim-in-prose.md).
  Closed in its own PR.
- **Severity:** Medium-to-high — raised from Medium by a product review: a changeset is copied verbatim into six published CHANGELOGs and reaches npm, so it is the one adopter-facing document with no gate.
- **Origin:** self-found · enforcement and release reviews of PR #122, independently.

## Symptom

`check:docs-code` compiled the fenced code blocks under `docs/` and every
package README. It never opened `.changeset/`. (The gate prints its own live
denominator per population on each run; a number pinned here would be stale
within a fortnight, which is the lesson `CLAUDE.md` records about its own
tables.)

A changeset body is the one document written specifically to tell an adopter how
to change their code, and it is the one document with no compile gate. It also
ships: changesets copies it into six `CHANGELOG.md` files and it reaches npm.

## The corruption that must produce a violation

A `ts` fence in `.changeset/*.md` importing a symbol from a package or subpath
that does not export it.

**And that would NOT have caught the instance below, which an architecture
review pointed out before this record's ledger could close on it.** This
changeset's two fences are bare call expressions with no import line:

```
throwIfViolations(violations)
```

```
finishPreset(violations, { report: 'throw' })
```

Both compile against a package that exports either symbol, and neither is where
the falsehood lived. The false claim was the surrounding PROSE — "`finishPreset`
is exported from the same three places the alias was, so the import line does not
move." A fence compiler cannot read that sentence.

So this bug has two break classes, not one, and the second is the one that bit:

1. **A fence that does not compile.** Cheap, mechanical, and worth having.
2. **A prose claim about WHERE a symbol is exported, contradicted by the built
   packages.** This is [bug 0267](../0267-the-freeze-checks-links-not-premises.md)'s
   shape — the check tests the link and not the premise — and it is harder,
   because it means extracting a claim from English. A narrower mechanism that
   would have worked: require the migration to name its import line in a fence,
   so the claim becomes compilable rather than prose. That is a convention
   change, and it is the honest cheap answer.

Filing both matters. Closing this bug on break class 1 alone would leave a
verification ledger that goes green on a gate which could not have found the
thing the bug was filed for — which is this repo's own subject, one level up.

## The instance that produced this bug

Plan 0263 Phase 5 removed `throwIfViolations` from three barrels and its
changeset told adopters:

> `finishPreset` is exported from the same three places the alias was, so the
> import line does not move.

`@nielspeter/eess-ts/presets` did not export `finishPreset`. An adopter
following that verbatim gets an ESM link-time error:

```
SyntaxError: The requested module '@nielspeter/eess-ts/presets' does not provide an export named 'finishPreset'
```

The subpath is the one `docs/getting-started.md` teaches, and
`docs/api-reference.md` documented the removed alias under its presets table, so
the adopter who followed the docs is exactly the one the migration failed. Three
reviewers found it; no gate did. This is ADR-009 rule 2 — a remedy must be
verified to remediate — missed in the very plan that shipped five
`emitter/remedy-remediates` fixtures for that clause.

## Why the fixture is cheap

The docs-code machinery already compiles fences against the built packages. The
work is extending its root set to `.changeset/**` and adding a non-vacuity
fixture that plants a fence importing a non-existent export and asserts the gate
reds by rule id.

Worth settling while building it: a changeset may legitimately show the OLD, now
broken call as the "before" half of a migration. The gate needs a way to say
which fence is the target state — a `before`/`after` convention, or compiling
only fences after a marker.

## The fix

`check:docs-code` gained `.changeset/*.md` as a third population, beside `docs/`
and the package READMEs, and **compiles the import statements of every `ts`
fence there** rather than the whole snippet.

Only the imports, because that is where the defect lives. A migration reads
`finishPreset(violations, …)`, where `violations` is the reader's variable and
not one a changeset can invent; demanding a runnable example would push authors
toward ceremony or toward the skip directive, and a gate people route around is
worth less than none (ADR-009 rule 1). `tsc` reports TS2305 for a named member a
module does not export whether or not the name is ever used, so an import line
alone is a complete check of the claim.

A fence with no import is a fragment, which is what makes the **"before"** half
of a migration free: a bare `throwIfViolations(violations)` asserts nothing about
where anything is exported. A before-side that genuinely needs its old import
line takes `<!-- eess-docs-code-skip: … -->`, the directive that already existed,
and the gate counts skipped fences in its summary so the waiver is visible.

The convention is written up in `RELEASING.md` under "A migration names its
import line".

## Verification ledger

- [x] Red test first: a changeset fence importing `thisSymbolDoesNotExist` from
      `@nielspeter/eess-ts/presets` left the gate **green at 58 fences** before
      the fix, and after it reds with
      `error TS2305: Module '"@nielspeter/eess-ts/presets"' has no exported member 'thisSymbolDoesNotExist'`.
- [x] `check:docs-code` reads `.changeset/**`, and the before/after question is
      **settled, not assumed**: measured both ways. With the skip directive the
      skipped count goes 1 → 2 and the gate is green; without it, the same fence
      reds.
- [x] A non-vacuity fixture, asserted by rule id:
      `docs-code/changeset-migration-does-not-compile` in
      `scripts/nonvacuity/bad-waived-gates.mjs`, claimed in `GATE_FOR` as a
      SECOND row for `check:docs-code`. Two populations need two rows — one row
      per script is exactly how this hole stayed open while the gate was green.
      Verified against an emptied implementation: dropping `CHANGESETS` from the
      file list makes the fixture report vacuous rather than pass.
- [ ] `deferred→` [0275](../0275-a-migration-can-still-state-its-claim-in-prose.md)
      — the demand side: nothing requires a migration to write a module claim, so
      a changeset stating an export location purely in prose still passes. This
      box is open on purpose. Every other box here is `[x]`, and a method review
      pointed out that a reader scanning boxes would see all-green while the
      residual lived only in trailing prose. The lane's disposition token says it
      where it is scanned.

- [x] **Break class 2 dispositioned as a convention, and the tier is stated
      rather than implied.** A migration's import line lives in a compilable
      fence. Dogfooded on the instance that produced this bug —
      `.changeset/throwifviolations-leaves-the-public-surface.md` carries
      `import { finishPreset } from '@nielspeter/eess-ts/presets'` in its fence,
      and pointing that specifier at a barrel without the symbol reds the gate.
      The sentence that was false in prose is now a thing that fails the build —
      **in that changeset**, because the import line was written into it. Not in
      the next one, unless its author writes one too. Three reviewers made the
      same point independently and the distinction is the whole residual below.

      **What is NOT gated, said plainly because an enforcement review found this
      box implying otherwise.** Nothing requires a changeset to write an import
      line. A migration stated purely in prose is a fragment and passes free —
      which is the original defect, still uncatchable by a mechanism. Measured on
      this branch with the gate's own extractor: **1 of 30 changesets carries a
      module claim**, in 2 fences. Three changesets have a `ts` fence at all; the
      other two declare no module and are compiled by nothing.

      **An earlier version of this line said "3 of 30", under the word
      measured.** It was the count of changesets with a `ts` fence, not with a
      claim — a different question, answered by a regex over whole files rather
      than by the extractor the gate uses. A method review caught it. The error
      ran in the direction that flatters this fix: it tripled the gate's apparent
      reach and understated the residual below by the same factor. So this is a
      **Tier 5 convention held by review**, written into `RELEASING.md`, and the
      build's contribution is narrower than "migrations are checked": the moment
      you state where a symbol lives, that statement becomes falsifiable.

      Two things make the convention harder to drift past than a bare rule. A
      changeset fence that carries an import but is not tagged `ts` is counted
      and named in the gate's summary, so the three-character retag that would
      silence it leaves a trace — the same visibility the skip directive has. And
      a failure in this population prints a remedy that says the import line is a
      claim about where a symbol is exported, rather than offering the skip
      directive as a co-equal option.

      The demand-side check — requiring a migration to HAVE a fence — is not
      built. It needs a way to tell a migration from any other changeset prose,
      which is the same "extract a claim from English" problem this record calls
      break class 2 in the first place.

## What a review round changed

**The published prose was the worst part of the first cut, and it is the same
defect one level up.** The changeset was edited to explain, in the changeset, why
its import line was now in a fence — naming this bug, three reviewers, a repo-local
script and a deep link into `work/bugs/fixed/`. That text ships verbatim into six
`CHANGELOG.md` files. A developer upgrading `eess-mermaid` would have got a
paragraph about this repo's drafting process instead of a migration. A product
review named it: the consumer of a changelog entry is an adopter, and that
paragraph had no consumer outside the repo.

Removing it exposed that the same fault was already there — `plan 0263`,
`plan 0235`, `plan 0070`, `bug 0185`, `ADR-008`, `docs/api-reference.md`. All are
gone; the changeset now reads as a changelog entry and nothing in it points at a
document an adopter cannot open.

**The remedy line was inverted for this population.** On a failure the gate said
"fix the example, or mark it illustrative with the skip directive". For a docs
fence that is right; for a changeset it offers, as a co-equal option, silencing
the exact defect the population was added to catch — ADR-009 rule 1. The message
now branches: a changeset failure says the import line is a claim about where a
symbol is exported, that a red means the claim is wrong or the barrel is missing
an export, and that the skip directive is for a "before" example only. Both
branches measured.

**The convention section over-claimed its tier.** It opened with a bolded
imperative and immediately named the gate, so a reader meeting it cold would take
the imperative as enforced. It is not: a migration written purely in prose is a
fragment and passes free. `RELEASING.md` now says which half is gated — nothing
checks that you wrote an import line, only that the line you wrote resolves.

**The summary printed one denominator across three populations**, which cannot
show one going dark. It now prints a count per population, and the changeset one was zero
for the whole time this bug was open with nothing saying so. The line is
deliberately not quoted here: an earlier draft did quote it, inside this very
paragraph about dishonest denominators, and it was stale one commit later when a
fourth population arrived.

**The document teaching the convention was outside every scanned population.**
`RELEASING.md` gained a `ts` fence carrying an import, in the section arguing
that a claim about where a symbol lives is not checkable until it is written as
an import — and it sat in none of `docs/`, `packages/*/README.md` or
`.changeset/`, so nothing compiled it. Found by a testing review. The repo-root
documents are scanned now, on the migration rule rather than the example rule,
because what they carry is a migration. Measured: pointing that fence's specifier
at a barrel without the symbol reds the gate.

**Every guard this bug added is now falsifiable, and none was at first.** A
second enforcement and testing round measured the same pattern three times: the
fix closed a fail-open and left the close unpinned, so one deleted token reopened
it with the whole harness green.

| deleted                        | before                                   | after                                                    |
| ------------------------------ | ---------------------------------------- | -------------------------------------------------------- |
| `noUncheckedSideEffectImports` | every row green                          | `docs-code/changeset-side-effect-import` reports vacuous |
| the root-doc population        | green, denominator silently `0 root doc` | `docs-code/root-doc-fence` reports vacuous               |
| `.changeset` from `probeRoots` | green, roots silently 11 → 10            | `integrity/leftover-probe-changeset` reports vacuous     |

The existing rows could not see any of it. The migration probe imports a NAMED
member, which reds via TS2305 with or without the side-effect flag; the leftover
probe plants under `packages/core/src/`, so it proves the leftover rule and not
the root set. A denominator printed to stderr is a signal to a human, not to the
build — which is the same distinction this record makes about `check:surface` two
sections up, applied to itself a round late.

**And two predicates disagreed about what a population is.** Selection used
`readsAsImportClaim`, which includes `RELEASING.md`; reporting and the
per-population counter keyed on the raw `.changeset` prefix. So a failure in the
document that TEACHES the convention printed the docs remedy — the skip directive
offered for a migration, inside the file whose own prose says the skip directive
is never for a migration. Both now route through the predicate that chose the
rule.

Deferred: [bug 0275](../0275-a-migration-can-still-state-its-claim-in-prose.md) — the demand side. This gate checks a claim once it is written as a module statement and requires nothing to be written, so a migration stated purely in prose still passes. That is this bug's own defect, surviving at one remove, and three reviewers read the ledger box as a mechanism when it is a convention. Naming it in its own record is the difference between a residual and a silence.
