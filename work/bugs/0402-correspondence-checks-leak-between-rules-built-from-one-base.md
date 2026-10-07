# Bug 0402: correspondence checks leak between rules built from one base

## Status

- **State:** Draft — reproduced 2026-10-07 against this repo's build at `9d18f0e`. No red test yet.
- **Severity:** Medium — a false red with a false attribution (ADR-009 rule 2). A rule reports a
  finding from a check it never declared, under its own id, so its author goes looking for a fault
  in the wrong rule.
- **Origin:** self-found · architect review of proposal 013, 2026-10-07.
- **Reported:** 2026-10-07

## Symptom

```ts
import { correspondence } from '@nielspeter/eess'
const side = (label: string, names: string[]) => ({
  elements: names.map((name) => ({ name })),
  label,
  identify: (e: { name: string }) => ({ name: e.name }),
})
const base = correspondence({ left: side('l', ['x']), right: side('r', ['x', 'y']) }).should()
const a = base.beComplete({ direction: 'left-to-right' }).rule({ id: 'a/left-only' })
const b = base.beComplete({ direction: 'both' }).rule({ id: 'b/both' })
export default [a]
```

Only `a` is exported, and `a` checks left to right, where `x` has its match. `eess-ts check` reports
`r "y" has no matching l`: the right-to-left half of `b`'s check, reported by `a`. Exit 1.

## Reproduction

The rule file above, run with `node packages/ts/dist/cli/bin.js check <file>` from a directory that
links `@nielspeter/eess` and `@nielspeter/eess-ts` to this repo's packages. About 25 ms.

## Root cause

`CorrespondenceBuilder` keeps its checks in a mutable array field
(`packages/core/src/correspondence.ts:88`), and both `beComplete()` and `preserveRelations()` push
onto `this` and return `this` (`correspondence.ts:109-115`, `:123-129`) instead of a copy. The class
does not override `copy()`, though `TerminalBuilder.copy()` says a subclass with extra fields "MUST
override this … and call `super.copy()` first" (`packages/core/src/terminal-builder.ts:355-364`). So
every builder derived from one base, through `beComplete()`, `preserveRelations()`, or the
copy-on-write `rule()`, `because()`, `expectNonEmpty()` and `excluding()`, shares one array: a
check added to any of them is checked by all.

The rest of the family builds rules copy-on-write; this class is the exception the base class's
own comment warns about.

## Fix

Not designed. `beComplete()` and `preserveRelations()` return a copy, and `CorrespondenceBuilder`
overrides `copy()` to copy its checks, so builders derived from one base are independent.

## Verification

- [ ] Red test written first: two rules built from one base with different `beComplete()`
      directions report only their own findings
- [ ] the same through `.rule()` and `.because()` taken before and after adding a check
- [ ] `npm run validate` green.

Deferred: none.
