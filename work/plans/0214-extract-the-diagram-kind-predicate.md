# Plan 0214: publish `eess-mermaid`'s modelled-kind vocabulary

## Status

- **State:** Draft — implements [ADR-011](../../adr/011-a-dialect-publishes-its-modelled-vocabulary.md).
  An earlier draft of this plan tried to **design** that contract in its Approach and
  got it wrong twice; review's finding was that a cross-package contract binding every
  future dialect is a decision, not work. The decision now lives in the ADR and this
  plan builds it.
- **Implements:** proposal 006
- **Priority:** Medium — closes a live fail-open defect
  ([bug 0210](../bugs/0210-er-fence-selector-is-an-allowlist.md)) and removes the
  precondition that makes any future diagram kind unsafe to add.
- **Effort:** Medium — **not** the "move a pure function, rewire three call sites" an
  earlier draft claimed. Two new exports on a published package, a derivation that
  cannot be hand-edited, per-binding consumption declarations in a second package, a
  two-sided completeness check, bug 0210's five inherited verification boxes, and a
  non-vacuity fixture per ADR-011 clause.
- **Created:** 2026-08-22

## Problem

Five restatements of "which Mermaid kinds does eess model" live across two packages,
and nothing keeps them in agreement — the table is in
[ADR-011's Context](../../adr/011-a-dialect-publishes-its-modelled-vocabulary.md).
Bug 0210 is the live instance: `ER_HEADER` is an allowlist, so a themed `erDiagram`
has been silently dropped for months.

## Approach

ADR-011 decides the shape. This plan builds it for `eess-mermaid`, and the two
things below are where an earlier draft was wrong — recorded because the second one
is subtle enough to be worth a warning:

**1. The published set must be derived, not declared.** `MODELLED_KINDS` has to be
derivable from the artifacts themselves; a hand-editable constant satisfies the
letter of ADR-011 and inverts its purpose, because adding a name with no parser
silently removes coverage. Two candidate derivations, and the plan must pick one and
say why:

- **From the grammar files.** Glob `packages/mermaid/src/parser/grammar/*.langium`
  and gate that each contributes exactly one kind. Unforgeable without deleting a
  grammar. Cost: a filesystem read, and a rule that the glob is non-empty.
- **From a parser registry** — `{ classDiagram: parseClassDiagram, erDiagram: parseErDiagram }`,
  keys co-located with the parsers. Nothing can add a key without adding a parser, it
  costs nothing at import, and it doubles as the dispatch table
  [bug 0211](../bugs/0211-diagram-sniffs-its-input-and-reads-arbitrary-files.md)'s
  split entry point needs anyway.

  > Note the Langium constraint that rules out a third option: the generated module
  > exports each grammar as a separate named constant with no "all languages" export,
  > so walking "every grammar" requires importing each by name — which is itself
  > hand-listed, and forgeable in exactly the way this plan exists to prevent.

**2. Three categories, and only a sibling's is deniable.** A binding's selector is
**not** `MODELLED_KINDS`-complement. Per ADR-011, `classDiagram-v2` is
known-unmodelled and must still reach the parser to be reported as a grammar gap;
an unknown kind must reach it too, fail-closed. Only kinds a _sibling binding_
consumes may be denied.

> An earlier draft specified `denylist = MERMAID_KINDS − consumed`. Both reviewers
> found independently that this puts `classDiagram-v2` in the denylist — turning
> today's loud, honestly-phrased finding into `skipped += 1`, a counter nobody must
> print. It also inverts `md-mermaid-er`: every unknown kind would reach the ER
> parser as well, so one fence would yield two parse findings from two presets.
> Recorded rather than quietly replaced: the remedy committed the defect the plan
> was written to prevent, which is the fourth instance of that shape in this
> record's lineage.

**3. Rewire both bindings** to declare consumption against the published set.
`md-mermaid` consumes `classDiagram`; `md-mermaid-er` consumes `erDiagram`; each
declares the other's explicitly. That fixes bug 0210 as a consequence.

**Not the kernel** — ADR-011's last clause, already gated by `eess/kernel-no-dialects`.

## Files Changed

- `packages/mermaid/src/parser/` — the derivation, `MODELLED_KINDS`, and the
  normalised `diagramKind()` (it must return the kind token; today `declaredKind()`
  returns the raw line `graph TD` and callers normalise separately via `kindOf`)
- `packages/mermaid/src/index.ts` — the two exports
- `packages/crossvalidate/src/md-mermaid.ts`, `md-mermaid-er.ts` — consumption declarations
- `scripts/nonvacuity/` — a fixture per ADR-011 clause (below)
- a changeset: `@nielspeter/eess-mermaid` minor (new exports),
  `@nielspeter/eess-crossvalidate` **minor, not patch** — fixing a fail-open selector
  means fences that were silently skipped are now compared, so an adopter's green
  build can go red on upgrade with no rule change of their own

## Verification

Each row of [ADR-011's Enforcement table](../../adr/011-a-dialect-publishes-its-modelled-vocabulary.md)
is `pending` until the matching box here is ticked, and each needs a
`scripts/nonvacuity/` fixture rather than only a unit test — bug 0209's review showed
the unit suite can catch a selector regression while every production gate stays green.

- [ ] `MODELLED_KINDS` is exported and **derived**: adding a grammar without
      registering it cannot leave the set unchanged. Corruption fixture: register a
      third parser, assert the set grows without a second edit.
- [ ] A modelled kind no binding declares reds, in either direction — two-sided
      completeness via the kernel's `correspondence()`, not a hand-rolled join.
      **Name which `check:*` invocation drives the fixture**; a fixture asserting the
      constants agree with each other proves nothing about what CI runs.
- [ ] **A known-unmodelled kind still reaches the parser.** Corruption fixture: move
      `classDiagram-v2` into the denied set, assert the build reds. This is the clause
      the earlier design violated and it is the one most worth pinning.
- [ ] An unknown kind still reaches the parser (fail-closed) — `mixed-diagram.md`
      already covers this for `md-mermaid`; extend to `md-mermaid-er`.
- [ ] Bug 0210's own five boxes, inherited: a themed `erDiagram` is selected and
      compared, a `---` frontmatter'd one likewise, `tableErStats` counts it, and a
      non-ER fence is still skipped **without the document being skipped with it**.
- [ ] `check:family` green — the exports are dialect-local and `eess-crossvalidate`
      already peer-depends on `eess-mermaid`, so no standalone-sufficiency invariant
      moves. (`family/re-export-complete` covers kernel symbols only, so a
      mermaid-owned export is outside its scope either way.)

## Who closes bug 0210

**This plan ships the fix; 0210 closes `done-otherwise → 0214`**, carrying its five
verification boxes here. Stated because both records described the same repair and
neither named the owner, which is how a bug gets marked fixed without its own floor
being met.

## Out of Scope

- **The language-tag divergence.** `md-mermaid-er` accepts `lang === null`;
  `md-mermaid` requires `lang === 'mermaid'`. ADR-011 governs _kind_ vocabulary only
  and says so; this remains a per-binding option and needs its own decision.
- `diagram()`'s sniff — [bug 0211](../bugs/0211-diagram-sniffs-its-input-and-reads-arbitrary-files.md).
  If that lands first, its dispatch table and this plan's parser registry are the
  same artifact; sequence them together or build the registry once.
- Any new grammar. Ask B on proposal 006 is Held.
