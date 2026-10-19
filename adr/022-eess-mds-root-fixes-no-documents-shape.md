# ADR-022: eess-md's root fixes no document's shape

- **Status:** Accepted (2026-10-19)
- **Extends:** [ADR-006](./006-framework-rules-architecture.md)
- **Context:** [proposal 017](../work/proposals/017-md-blocks-to-check-a-documents-shape.md) (second
  Review, decisions 1 to 3; "Consumer feedback", decisions 2 and 4),
  [plan 0458](../work/plans/completed/0458-the-examples-gate-a-document-shape-from-public-blocks-only.md),
  [plan 0495](../work/plans/0495-a-value-agrees-with-its-folder.md),
  [plan 0498](../work/plans/0498-honestyatclose-places-a-record-with-block-5.md),
  [plan 0504](../work/plans/0504-honestyatclose-boxes-and-deferrals-from-public-blocks.md),
  [plan 0455](../work/plans/0455-a-corpus-built-from-text.md),
  [bug 0497](../work/bugs/0497-corpus-freezes-two-folder-names-by-default.md)
- **Supersedes nothing.**

## The question

eess-md is the Markdown dialect, and Markdown corpora differ: work records, ADRs, wikis,
specifications, documentation. The maintainer's correction to proposal 017 set the line: "eess-md
should not dictate how a plan should look like, or bug or wiki", and it "need[s] to have all the
tools and buildingblocks to support the posibility to build plans, bugs, wikis, x, y, z".

ADR-006 gives a package three tiers (primitives at the root, standard rules under `rules/*`,
framework rules in their own packages) and lets a standard rule carry "sensible defaults". It does
not say what a dialect's root may assume about the documents it reads. The question is where a
document's shape (its labels, its state words, its folders, its section names, its box marks) may
be fixed, and what the two presets eess-md already ships may be built from.

## What was measured

At `9675402`, before this ADR. Line pointers below are to the tree that adds this ADR, after the
rewire, so `check:corpus` can resolve them; at `9675402` the `ledger.ts` lines cited sit ten lines earlier.

- **The presets reach past the root.** The two presets imported from 12 eess-md module edges
  (`honestyAtClose` in `rules/ledger.ts` from 8, `adrEnforcement` in `rules/adr.ts` from 4) and from
  one third-party package (`mdast`), and from none of them through the root. Nine of the 12 edges
  carried only symbols the root already exports, and were rewired to it with this ADR. Three edges,
  all from `ledger.ts`, carry seven symbols the root does not export: `validateMarks`
  (`model/task-items.ts`), `LABEL_HEADING`, `PLAIN_LABEL`, `labelPattern` and `wrappedLabelOf`
  (`model/label.ts`), and `proseText` and `unterminatedFence` (`model/prose.ts`, which are on
  `@nielspeter/eess-md/internal`, family plumbing, not the root). An adopter writing
  `honestyAtClose` from the root could not write it as it is written. That is what adopters 1 to 3
  did by hand (proposal 017, "Consumer feedback").
- **The root fixes one shape.** `corpus()` freezes `**/completed/**` and `**/archived/**` when the
  caller names no `frozen` globs (`packages/md/src/corpus.ts:61`), and frozenness changes what
  `pointers()` examines. Those are folder names a lane uses. No other root export reads a label,
  state word, folder, section name or box mark the caller did not give: `fields()` and `haveField`
  take the label and forms, `taskItems()` reads GFM's own two marks and the caller's declared ones
  (plan 0454), and `DEFAULT_CODE_BLOCK_BUDGET` is a time budget, not a shape.
- **The presets fix shapes, as ADR-006 lets them.** `honestyAtClose` defaults the label to `State`,
  the states to the plan lane's words and the done folders to five names
  (`packages/md/src/rules/ledger.ts:143`); `adrEnforcement` defaults its folder to `docs/adr/**`.

## Decision

**The root of `@nielspeter/eess-md` offers building blocks and fixes no document's shape. A shape is
the caller's, or an example's, and the two presets that fix one today are built from the same
public blocks an adopter has.**

A root export _fixes a shape_ when a rule reads a label, a state value, a folder, a section name or
a box mark that the caller did not name. Syntax that Markdown or GFM itself defines (a heading's
`#`, a task box's `[ ]` and `[x]`, a table's pipes) is the language, not a shape, and reading it is
not fixing one.

1. **The root fixes no shape.** No export of the `@nielspeter/eess-md` root reads a shape the caller
   did not name. A new root block takes every such value from its caller, with no default. The one
   known exception is the default frozen folders (`**/completed/**`, `**/archived/**`) that
   `corpus()` applies, and that plan 0455's `corpusFromText`, a second constructor of the same
   corpus, shares if it ships before the fix. Bug 0497 removes the default from every constructor
   that has it, as one flagged break with a migration line, since removing it reds corpora that
   relied on it.
2. **A document's shape ships as an example.** A plan, a bug, a wiki page or any other kind of
   document is shown in `examples/`, run by `check:examples` and built from public root blocks only
   (plan 0458's gate), and never as an eess-md export.
3. **The presets are built from the roots.** `honestyAtClose` and `adrEnforcement` stay under
   `rules/*`, so no adopter breaks. A module under `packages/md/src/rules/` imports nothing from
   eess-md but the md root, `packages/md/src/index.ts`, and nothing from the kernel but
   `@nielspeter/eess`, its root, not `/internal`. Nothing else, third-party types and Node builtins
   included: the root's `MdDocument['root']` names the parsed tree, and a preset reads the disk
   through `corpus()`, so a preset needs neither, and none imports one. Whether the presets later
   leave eess-md is the maintainer's decision, and a break; it is not taken here.
4. **No new preset.** eess-md adds no module under `rules/*` and no preset subpath to its
   `exports`. A shape that would have been a preset is an example (clause 2). A preset written
   elsewhere and exported from the root is clause 1's.

## Why this, and not the alternatives

- **Move the presets out of eess-md now.** It is the cleanest line and a break for every adopter
  importing `@nielspeter/eess-md/rules/ledger` or `/rules/adr`. Clause 3 gets the same property
  (a preset is a caller of the blocks, nothing more) without the break, and leaves the move to the
  maintainer.
- **Let `rules/*` import eess-md's `/internal` entry.** `proseText` is there, so `ledger.ts` would
  pass today. But `/internal` is the family's plumbing; an adopter is not promised it. A preset that
  needs it shows a block the root is missing, and that is the finding the rule exists to make.
- **A default shape on the root, overridable.** The draft of proposal 017 that the maintainer
  corrected (`documentType({ fields, sections, relations, states })`) did this. Every adopter would
  then configure around eess-md's idea of a document; adopter 2 accepted the blocks "as long as
  `State:` stays ours to rename".
- **The arch rule without an ADR.** The rule says what may be imported. It does not bind block 5,
  `corpus()`'s default or a new preset, and proposal 017's decision 1 makes the principle binding.

## Consequences

- `adrEnforcement` is built from the roots. `honestyAtClose` carries three ratcheted edges
  (`model/label.ts`, `model/prose.ts`, `model/task-items.ts`), each excluded by its module and
  pinned so paying one down reds until its exclusion goes too (a stale `.excluding()` entry only
  warns, measured below), and the seven symbols that cross them are pinned one by one, so the debt
  cannot grow over an edge it already has.
- [Plan 0498](../work/plans/0498-honestyatclose-places-a-record-with-block-5.md) rebuilds
  `honestyAtClose`'s state reading and placement half on block 5 and removes the `model/label.ts`
  edge. [Plan 0504](../work/plans/0504-honestyatclose-boxes-and-deferrals-from-public-blocks.md)
  rebuilds its box and `deferred: none` halves from public blocks, removes the `model/task-items.ts`
  and `model/prose.ts` edges, and owns proposal 017 decision 3's closing proof (`honestyAtClose`
  built from public blocks with its fixtures unchanged).
- Block 5 ([plan 0495](../work/plans/0495-a-value-agrees-with-its-folder.md)) is a root block, so it
  takes its groups, folders, label and direction from the caller, with no default.
- [Plan 0455](../work/plans/0455-a-corpus-built-from-text.md)'s `corpusFromText` is a new root
  block and bound by clause 1: it may share `corpus()`'s frozen default only as the exception clause
  1 names, and loses it with bug 0497.
- `corpus()`'s default frozen folders stay until bug 0497 ships its break.
- A preset needing what the root lacks adds the block to the root first, as a block the caller names
  every value of.

## Enforcement

The arch rules run in `check:arch` (`arch.rules.ts`). Measured on the tree that adds this ADR with
`eess-ts check arch.rules.ts`, each sabotage red (exit 1) on the rule named and restored green:
`rules/adr.ts` importing `../model/label.js` (a value), `../model/document.js` (type only),
`@nielspeter/eess/internal` and `mdast` (type only), each on `md/rules-import-only-the-root`, and,
measured by PR #246's enforcement review, `node:path` and `../model/label.js` imported dynamically,
as a type expression and as a re-export, on the same rule;
`rules/ledger.ts` gaining a fourth edge, `../model/fields.js`, on the same rule; and `rules/ledger.ts`
dropping each of its three excluded imports, on that module's `md/rules-ledger-debt-is-current-*`
pin. With the pins removed from the rule file, a dropped import printed `Unused exclusion` and
exited 0, which is why the pins exist. A fifth symbol over an excluded edge, and an excluded module
re-exporting another internal for `ledger.ts`, passed the arch rule (exit 0); the per-symbol test
reds on both. The eess-md test titles are not cited by `it('…')`: `check:crossval` resolves
eess-ts's tests only (bug 0262).

| Clause                                                                                                      | Tier | Mechanism                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Status  |
| ----------------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| **1** — no root export reads a shape the caller did not name                                                | 5    | Review of every new root block against this clause. No static check tells a shape from any other default; Markdown's and GFM's own syntax is not a shape                                                                                                                                                                                                                                                                                                                                                                                       | manual  |
| **1** — the default frozen folders are removed from every constructor that has them, as one flagged break   | 2    | Bug 0497: a corpus built without `frozen`, by `corpus()` and by `corpusFromText` if plan 0455 has shipped it, marks no document frozen, red first in `packages/md/tests`; the break ships with a migration line naming its dependants (bug 0185)                                                                                                                                                                                                                                                                                               | pending |
| **2** — a document shape is shown as an example, never as an eess-md export                                 | 5    | Review against this clause; clause 4's test catches a new preset under `rules/*` or a new subpath, and clause 1's review one exported from the root                                                                                                                                                                                                                                                                                                                                                                                            | manual  |
| **2** — a document-shape example is built from public root blocks only                                      | 1    | Plan 0458's rules in `arch.rules.ts` (`eess/examples-md-public-blocks-only`, `eess/examples-md-uses-a-block`, `eess/examples-md-no-hand-built-rules`, `eess/examples-md-no-rule-constructors`), each with its row in `scripts/check-nonvacuity.mjs`; the examples run in `check:examples`                                                                                                                                                                                                                                                      | gated   |
| **3** — a module under `rules/*` imports only the md root and the kernel root                               | 1    | `md/rules-import-only-the-root` in `arch.rules.ts`, `onlyImportFrom` over `packages/md/src/rules/**`, type imports included; row `arch/md-rules-import-only-the-root` in `scripts/check-nonvacuity.mjs` plants an internal import in `packages/md/src/rules/adr.ts` and requires the finding on that file naming the module; the sabotages above. Cannot see a dynamic import of a computed string, which no eess-ts edge rule sees                                                                                                            | gated   |
| **3** — `honestyAtClose`'s debt is a ratchet: no edge or symbol is added, each paid-down edge closes        | 1    | One `.excluding()` per edge, matched by its module; the nonvacuity row plants a fourth edge in `packages/md/src/rules/ledger.ts` and requires the allowlist's finding naming it, so an exclusion widened past its module reddens the row. `md/rules-ledger-debt-is-current-label`, `-prose` and `-task-items` pin each excluded edge with `dependOn`, and the row drops the prose import and requires that pin. `packages/md/tests/rules/ledger-debt.test.ts` pins the seven symbols and that each is declared, not re-exported, in its module | gated   |
| **3** — `honestyAtClose` no longer imports `model/label.ts`                                                 | 1    | [Plan 0498](../work/plans/0498-honestyatclose-places-a-record-with-block-5.md) removes the edge, its exclusion, its pin and its symbols from the test, after block 5 (plan 0495)                                                                                                                                                                                                                                                                                                                                                               | pending |
| **3** — `honestyAtClose` no longer imports `model/prose.ts` or `model/task-items.ts`                        | 1    | [Plan 0504](../work/plans/0504-honestyatclose-boxes-and-deferrals-from-public-blocks.md) removes both edges the same way, with the box and `deferred: none` halves rebuilt from public blocks                                                                                                                                                                                                                                                                                                                                                  | pending |
| **4** — no new preset under `rules/*` and no new subpath                                                    | 1    | `packages/md/tests/rules/no-new-preset.test.ts` pins the files under `packages/md/src/rules/` and the whole `exports` map of `packages/md/package.json`, a change detector: adding either edits the test, which review reads against this clause. Measured red on a planted `rules/` module and on a planted `./presets/wiki` subpath. Cannot see a preset exported from the root, which is clause 1's                                                                                                                                         | gated   |
| Rationale: why not move the presets now, allow `/internal`, ship a default shape, or rely on the rule alone | 5    | The alternatives above                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | n/a     |
