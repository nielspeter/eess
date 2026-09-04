# Bug 0254: an ambiguous pointer passes silently and is counted inside "all ground in code"

## Status

- **State:** Draft — measured, not built.
- **Severity:** Medium — **a false green, not an over-claim.** Sixteen live
  pointers resolve to nothing, are never reported, and are counted in the
  denominator of a line that says they all resolved. This is the class
  [ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md) exists to
  forbid: a pass constructed from a default rather than from evidence. It is
  worse than [0253](./0253-frozen-drift-is-not-reported-only-unexamined.md),
  where nothing wrongly passes.
- **Origin:** self-found · review of
  [0249](./fixed/0249-most-of-work-is-outside-every-corpus-root.md), which
  widened the corpus root and added six instances on its first run.
- **Reported:** 2026-09-04

## Symptom

`packages/md/src/conditions/pointer-resolve.ts:118`:

```typescript
if (m.kind === 'ambiguous') return [] // reported elsewhere, never failed
```

**There is no elsewhere.** Nothing in `packages/md/src/rules`,
`packages/md/src/builders` or `scripts/check-corpus.mjs` counts, prints or
surfaces an ambiguous pointer. The comment describes a behaviour that was never
built, and it is the same shape as 0253 one branch over in the same file — found
by the review of the change that filed 0253, not by that filing.

The consequence is in the summary `check:corpus` prints on every green run:

```
pointers  463 live · ✓ all ground in code
```

**Measured 2026-09-04**, resolving every live pointer by hand against the
corpus's own file index:

| resolution                                      | count  |
| ----------------------------------------------- | ------ |
| exact repo-relative path                        | 355    |
| unique suffix match                             | 92     |
| **ambiguous — 2+ candidates, silently skipped** | **16** |
| unresolvable                                    | 0      |

Sixteen of 463 are inside `✓ all ground in code` without having grounded in
anything.

## Reproduction

Any bare filename that suffix-matches more than one file in the repo. The
sixteen live today, by document:

- `work/fold-audit-2026-08-19.md` — 6 (`project-relative.ts`, `path-universe.ts`,
  `cli/commands/check.ts`, `rule-builder.ts` ×2, `execute-rule.ts`)
- `work/bugs/0168-no-unused-exports-misses-barrel-re-exports-and-inline-type-imports.md` — 3 (`src/index.ts`, 5 candidates each)
- `work/plans/0235-the-emitter-takes-a-receipt.md` — 3 (`shared.ts`, 3 candidates each)
- `adr/010-a-pass-is-constructed-from-evidence.md` — 1 (`terminal-builder.ts`)
- `work/bugs/0130-cli-summary-counts-the-invocation.md` — 1 (`check.ts`)
- `work/bugs/0178-the-kernels-dead-glob-finding-cannot-fire.md` — 1 (`rule-builder.ts`)
- `work/proposals/009-core-a-verdict-cannot-be-assembled-by-hand.md` — 1 (`execute-rule.ts`)

Two resolved by hand, both false:

- `work/fold-audit-2026-08-19.md:294` cites line 294 of a bare
  `rule-builder.ts` as `fork._conditions = []`. That line is a closing brace in
  the kernel's copy and a comment terminator in the ts dialect's.
- `work/fold-audit-2026-08-19.md:293` cites line 337 of the same bare filename as
  a `_phase` comparison. That line is JSDoc prose in both candidates.

(Written without the `file:line` shape on purpose — quoting one of these
verbatim creates a seventeenth instance, which the first draft of this record
did. Inline code is extracted; only fenced blocks are not.)

Both are wrong, both pass, and both **cannot** fail — the ambiguity is what
protects them.

## Why it matters

The record that widened the root argued the suffix-resolution trap was the real
hazard: a pointer "checked and blessed against the wrong file — strictly worse
for a reader, because the gate now vouches for it." That hazard has a second
form nobody had looked at. A _unique_ suffix can be blessed against the wrong
file; an _ambiguous_ one is blessed against no file at all, and reads identically
in the summary.

The family already knows the right answer.
`packages/crossvalidate/src/gherkin-ts.ts:148` reports an ambiguous citation as a
violation carrying its own remedy — cite a longer suffix. `eess-md` does the
opposite while its docstring claims otherwise.

## Fix (not built)

The break class is nameable and the shape is settled by precedent: **an ambiguous
pointer is a finding, with a message naming the candidates and telling the author
to lengthen the suffix.** What needs deciding is only the severity —
`crossvalidate` fails; `eess-md` might reasonably `.warn()` first, since sixteen
existing pointers would red the build on the commit that ships it.

Whichever: it is a behaviour change in a published dialect, so it needs a
changeset, and the sixteen need fixing or sanctioning in the same change.

The JSDoc at `packages/md/src/conditions/pointer-resolve.ts` promising a report
that does not exist must go either way — that half is free.

## Verification

- [ ] An ambiguous pointer produces a finding (or a warning) naming its
      candidates — asserted on the message, not just the count.
- [ ] The summary's pointer denominator no longer counts a skipped pointer as
      grounded: `examined` and `resolved` are separately true, per ADR-010.
- [ ] A `check:nonvacuity` row over the production script, or the new behaviour
      is a claim rather than a check.
- [ ] The sixteen live instances are resolved to real paths or sanctioned, and
      the count is re-measured rather than assumed.
- [ ] No JSDoc claims a report that is not built.

## Related

- [0249](./fixed/0249-most-of-work-is-outside-every-corpus-root.md) — deferred
  its foreign-pointer fixture box here after review measured its
  `dropped-on-purpose` premise false.
- [0253](./0253-frozen-drift-is-not-reported-only-unexamined.md) — the sibling
  false claim in the same file; an over-claim where this one is a false green.
- [0255](./0255-an-exclusion-directive-inside-a-table-cell-is-inert.md) — the
  sanction an author would reach for on a pointer like these does not work where
  most of them live.
