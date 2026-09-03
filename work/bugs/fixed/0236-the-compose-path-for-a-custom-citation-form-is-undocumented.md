# Bug 0236: the compose path for a citation form the ADR preset does not know is documented nowhere

## Status

- **State:** Fixed — documented 2026-09-03, in the same PR that filed it.
  `Deferred: none`.
- **Priority:** Low — not a correctness gap. It is the whole remedy
  [proposal 008](../../proposals/promoted/008-md-adr-citation-form-for-bare-identifiers.md)
  was ruled to need, and the same shape as
  [0219](./0219-corpus-listing-surface-is-undocumented.md): a capability that ships,
  in the package the proposal names, that no page shows.
- **Implements:** proposal 008
- **Origin:** self-found — the `Docs-only` ruling on proposal 008 (2026-09-03) named
  documentation as the fix, and `check:corpus`'s `docs-only-ruling-names-no-owner`
  rule reported the ruling with nothing owning it the moment the ruling was saved.
  That rule exists because 004's identical ruling went unowned for ten days.

## Symptom

`adrEnforcement`'s citation check recognises two forms inside a Mechanism cell — a
backticked file path (`PATH_RE`, `packages/md/src/rules/adr.ts:43`) and an `it('…')`
title (`IT_CITE_RE`, `packages/md/src/rules/adr.ts:44`). A team whose enforcement
mechanism is a **named rule id in its own architecture tool** — not a file, not a
test — has no form the preset resolves, and the citation can go stale with the
preset reporting nothing.

Both halves of what such a team needs already ship as public API of `eess-md`:

- the forward and reverse directions at once —
  `correspondence().should().beComplete({ direction: 'both' })`
  (`packages/core/src/correspondence.ts:108`), re-exported from
  `packages/md/src/index.ts:41`;
- the rows of the Enforcement table as elements — `rows()`
  (`packages/md/src/builders/rows.ts:47`), whose own docstring names `.select()`
  into a correspondence as its primary use.

And nothing showed the two together for this case. Measured 2026-09-03:

| where                                                                    | says                                                                                                       | shows the compose path |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ---------------------- |
| `docs/markdown.md`, "ADR enforcement tables"                             | the `verifyCitations` option and the three rule ids                                                        | no                     |
| `packages/md/README.md`, "The ADR gate is an opt-in, opinionated preset" | "otherwise compose your own gate from `haveSection` / `haveTable` / `haveTableRowsSatisfying` / `resolve`" | no                     |
| `adrEnforcement`'s docstring                                             | "Teams whose ADRs differ compose their own gate from the generic primitives"                               | no                     |

Three places said "compose your own" and none said how. A consuming project read
all three, concluded eess-md "cannot do this itself", and wrote a ~50-line binding
of its own — a regex over each ADR's raw text, a snapshot file for the live set,
and a hand-rolled both-directions diff. Proposal 008 then asked for a
`citationForms` plugin on the preset, which its review declined: the plugin would
make an opinionated preset a plugin host, owning overlap and ordering for twenty
lines a user can already write.

## Reproduction

```bash
grep -n "direction: 'both'" docs/markdown.md   # before: one hit, the README Packages-table example
grep -n 'not a file or a test' docs/markdown.md # before: nothing
```

## Root cause

Not a code defect. A documentation gap that the proposal lane's own vocabulary
turns into an obligation: `Docs-only` means _the capability exists, the gap is
discoverability_, and a ruling that names a remedy needs an owner. This record is
that owner.

## Fix

Document the compose path where a reader already is, as a fence the docs-code gate
compiles:

- `docs/markdown.md` — a subsection under "ADR enforcement tables", _Citing
  something that is not a file or a test_: `rows()` over the Mechanism column,
  the cited ids pulled out with the team's own pattern, `correspondence()` against
  the set the team holds, `beComplete({ direction: 'both' })`. One recipe, both
  directions, and a paragraph on what makes it non-vacuous — a correspondence
  counts both sides, so a pattern that matches nothing over a non-empty live set
  is red, not green.
- `adrEnforcement`'s docstring — names the two forms it resolves and points at
  the recipe for anything else, so the answer is one hover away from the preset
  a reader would otherwise try to extend.
- `packages/md/README.md` — the "compose your own" sentence gains the pointer.

**What the recipe deliberately does not do.** It does not present the preset's
resolver as the reference for correctness while
[0111](../0111-md-adr-citations-resolve-by-prefix.md) is open — the built-in
`it('…')` resolution matches by prefix. The recipe goes through the kernel's
correspondence and never touches that regex, which is the honest reason it can be
written before 0111 is fixed.

## Verification

- [x] The standing check inverts: the second `grep` in _Reproduction_ finds the
      recipe's heading, and `direction: 'both'` now has a citation example beside
      the packages-table one.
- [x] The added fence compiles under `check:docs-code`, which went **56 → 57**
      import-bearing TS fences. This is the real verification: the fence dereferences `r.get('mechanism')`, `r.doc.relPath`
      and `r.line` on `MdRow`, and calls `beComplete({ direction: 'both' })`, so
      `tsc` fails it if any of those drift from the shipped types.
- [x] `check:corpus`'s `docs-only-ruling-names-no-owner` finding on proposal 008
      clears with this record's `Implements` line, and proposal 008 moves to
      `promoted/` with no `Held` row to block it.
- [x] `npm run validate` green from a run that reached the last step.

Not deferred, and named so it is not mistaken for one: nothing requires this
section to keep existing — `check:docs-code` compiles the fences that exist and
demands none. That is
[0220](../0220-nothing-requires-a-public-symbol-to-be-documented.md)'s subject,
already filed, and this record adds one section to its denominator.
