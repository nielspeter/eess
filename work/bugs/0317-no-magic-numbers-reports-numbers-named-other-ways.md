# Bug 0317: `noMagicNumbers` reports a number the class names by a key, an array, a function property's default or a local constant

## Status

- **State:** Draft — reproduced, and pinned by a KNOWN-GAP test. A design question.
- **Severity:** Medium — noise, not a false green. Each shape is reported with "extract to a named
  constant" although the number already has a name. Since 0306 the rule reads property initializers,
  so a class's table of constants — `static readonly Status = { OK: 200, NotFound: 404 }` — is likely
  the largest source of new findings in that release. #137's product review notes that ESLint's
  `no-magic-numbers` ignores object property values unless `detectObjects` is set.
- **Origin:** #137's second product, enforcement and architecture reviews, measured then.
- **Reported:** 2026-09-14

## Symptom

`noMagicNumbers()` over one class:

| code                                                      | reported  |
| --------------------------------------------------------- | --------- |
| `static readonly Status = { OK: 4200, NotFound: 4404 }`   | yes, both |
| `private readonly delays = [4250, 4500]`                  | yes, both |
| `handler = (retries = 4003) => retries`                   | yes       |
| `method() { const TIMEOUT_MS = 4005; return TIMEOUT_MS }` | yes       |
| `static readonly LIMIT = 4999`                            | no        |

## Root cause

`isNamedValue` (`packages/ts/src/rules/code-quality.ts`) names a number by one of the class's own
properties or its members' own parameters, read through a sign and the wrappers that leave a value
unchanged (0306). A key in an object literal, an array element, a parameter of a function a property
holds and a local `const` are none of those.

## Fix

Rule on each shape, and record who ruled:

- a keyed table held by the class's own property — the key names the number, as a property does;
- an array element — nothing names it;
- a function-valued property's parameter default — 0306 made such a property a member for the metrics
  rules, which argues it is the class's own parameter here too;
- a local constant — exempting it drops findings the method walk reported before 0306, so it changes
  the rule in the other direction;
- a numeric key in a destructuring pattern — in a member's own parameter a computed `{ [4646]: k }` is
  reported and a plain `{ 4646: k }` is not read, while a plain key destructured in a member's body is
  reported (#138's architecture and enforcement reviews).

## Verification

- [x] KNOWN-GAP test pins today's behaviour —
      `packages/ts/tests/rules/named-values-no-magic-numbers-still-reports.test.ts` ·
      `it('KNOWN GAP — a keyed table, an array element, an arrow property default and a local constant are reported')`,
      with `LIMIT` exempt as its control.
- [ ] the ruling, recorded
- [ ] the fix, the KNOWN-GAP test inverted, a sabotage matrix
- [ ] `npm run validate` green.

Deferred: none.
