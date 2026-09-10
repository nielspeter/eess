# Bug 0278: the strict-family barrel kept the count and dropped the functions

## Status

- **State:** Fixed — both functions restored to the `eess-ts` barrel, census rows
  added, red-first against the published `0.5.0`.
- **Severity:** High — it broke a real adopter's primary rule file at module
  load, in the release that shipped it.
- **Origin:** external · found upgrading a consuming project to `v0.5.0`.

## Symptom

`packages/ts/src/tsconfig/strict-family.ts` exports four things. The `v0.5.0`
barrel published two of them:

| export                    | on the 0.5.0 barrel |
| ------------------------- | ------------------- |
| `STRICT_FAMILY_SIZE`      | yes                 |
| `StrictFamilyFlag` (type) | yes                 |
| `isStrictFamily`          | **no**              |
| `resolveFlag`             | **no**              |

So a consumer could name a strict-family flag and count the family, and neither
test whether a key belongs to it nor resolve one against compiler options. The
type and the constant are only useful in the company of the two functions.

## Why it is High and not Medium

ESM resolves named imports at load. An adopter's rule file reading

```ts
import { isStrictFamily, resolveFlag, STRICT_FAMILY_SIZE } from '@nielspeter/eess-ts'
```

does not type-error; it fails to load:

```
SyntaxError: The requested module '@nielspeter/eess-ts'
does not provide an export named 'isStrictFamily'
```

Their `eess-ts check` stopped running entirely. A missing export is not a
degraded feature, it is a dead gate — which is the failure class this project
exists to prevent, shipped by this project.

## Root cause

Plan 0088's barrel pass removed 54 symbols from `eess-ts` on the stated
criterion that nothing outside the package's own `src/` referenced them and no
page taught them. That was measured **inside this repo**, which by construction
cannot see an adopter. These two are the counterexample: mirroring tsc's
strict-family resolution is an ordinary thing for a rule file to do, and the
adopter's own comment says exactly that.

The criterion is not wrong — 52 of the 54 were genuinely plumbing. What is wrong
is applying it per symbol rather than per module: three exports of one small
module survived the pass and one did not, leaving an incoherent surface. "All
four or none" is the shape that would have caught it.

## Fix

Restored to `packages/ts/src/index.ts` beside the constant, with the two rows the
published-surface census requires. The census caught the omission on the first
run — an export in neither list fails the matrix — which is that mechanism
working exactly as intended.

## Verification ledger

- [x] Red first against the **published** `@nielspeter/eess-ts@0.5.0`, not a
      local build: the named import throws `SyntaxError … does not provide an
export named 'isStrictFamily'`.
- [x] Both functions resolve from the barrel after the fix, checked by importing
      the built `dist` from outside the workspace.
- [x] Census rows added; the matrix goes 47/48 to 48/48. The failure it produced
      first — `expected [ '.:isStrictFamily', '.:resolveFlag' ] to deeply equal
[]` — is the reverse-direction assertion doing its job.
- [x] `docs/migrating-to-0.5.md` now lists all 54 removed names. A product review
      of that page predicted this exact failure before it merged, naming
      `resolveFlag` as the example, and the fix at the time was a pointer to the
      changelogs rather than the list. That was not enough.

Deferred: none. **Not fixed here:** the per-symbol-versus-per-module criterion
that allowed it. Worth a rule — a module whose exports are split across the
barrel boundary is at least a question — but that is a mechanism decision, not
this repair.
