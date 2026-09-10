# Bug 0273: nothing compiles a changeset's migration snippet

## Status

- **State:** Fixed — `check:docs-code` compiles the import lines of every
  changeset fence, both break classes dispositioned, closed in its own PR.
- **Priority:** Medium-to-high — raised from Medium by a product review: a changeset is copied verbatim into six published CHANGELOGs and reaches npm, so it is the one adopter-facing document with no gate.
- **Found by:** enforcement and release reviews of PR #122, independently.

## Symptom

`check:docs-code` compiles the fenced code blocks under `docs/` — 57
import-bearing fences, measured. It never opens `.changeset/`.

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
- [x] **Break class 2 dispositioned: the convention, not the shrug.** A
      migration's import line lives in a compilable fence. Dogfooded on the
      instance that produced this bug —
      `.changeset/throwifviolations-leaves-the-public-surface.md` now carries
      `import { finishPreset } from '@nielspeter/eess-ts/presets'` in its fence,
      and pointing that specifier at a barrel without the symbol reds the gate.
      The sentence that was false in prose is now a thing that fails the build.

Deferred: none.
