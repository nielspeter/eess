# Bug 0264: a dynamic import escapes the verdict rule, through both legs at once

## Status

- **State:** Draft — found by an enforcement review of PR #110, reproduced, and
  pinned by a KNOWN-GAP test rather than described in prose.
- **Severity:** Medium — not a false green in a mechanism that claims to cover
  this, but an **unstated ceiling** on one that claims its two conditions "cover
  each other's blind spot". They do not, for one shape, and the claim was in the
  source until this bug corrected it.
- **Created:** 2026-09-06
- **Found by:** enforcement review · plan 0237's build

## Symptom

`preset/agent/no-verdict-outside-rules` does not flag this module:

```ts
export async function report(violations: unknown[]): Promise<void> {
  const { finishPreset: done } = await import('@nielspeter/eess')
  done(violations)
}
```

Measured against the real preset over
`packages/ts/tests/fixtures/presets/no-verdict-outside-rules/src/dynamic-rename.ts`:
not flagged. The static equivalent (`import { finishPreset as done } from …`)
**is** flagged, which is what made the gap easy to miss — the renamed-import
escape is covered, but only when the import is static.

## Root cause

Both legs are blind on the **same line**, so neither covers the other:

- **The import leg.** `onlyHaveTypeImportsFrom` is built on `TYPE_IMPORT_KINDS`
  (`packages/ts/src/conditions/dependency.ts`), which sets `dynamic: false`
  deliberately and for a good reason of its own: there is no way to make
  `await import(…)` erased, so a "make it a type import" remedy could not be
  followed, and a finding whose remedy cannot be followed is not a finding.
- **The call leg.** `call()` matches the callee's **lexical text**
  (`packages/ts/src/helpers/matchers.ts`), not a resolved symbol. Destructuring
  to `done` makes the callee text `done`, which the anchored regex never matches.

The `dynamic: false` decision is right **for the condition it was written for**
and wrong as a silent inheritance here: this rule does not want "make it a type
import", it wants "do not use eess at runtime in this file", and for that the
remedy IS followable — move it, or name the file in `ruleFiles`.

## Fix

Not decided. The building block exists: `FORWARD_EDGE_KINDS` in the same module
already treats `dynamic` as a real edge kind for a different condition, so a
third leg — "no dynamic import whose specifier matches the eess globs, whatever
it is destructured into" — is composable rather than novel. Deliberately not
done inside plan 0237: it is a new condition-level decision, and 0237 shipped
with the gap **stated** in four places instead.

## Verification

- [x] a KNOWN-GAP test pins the current behaviour —
      `packages/ts/tests/presets/no-verdict-outside-rules.test.ts` ·
      `it('KNOWN GAP — a dynamic import destructured under a new name escapes BOTH legs')`.
      It asserts the escape, so **closing this bug turns it red** and whoever
      closes it must come here and say so.
- [x] the covered half is pinned too —
      `it('a STATIC renamed import is caught by the import leg')`, which the
      source claimed in a comment and nothing proved.
- [ ] the third leg, or a recorded decision not to build one
- [ ] the ceiling removed from `docs/presets.md`, the option's JSDoc and the
      changeset once it is closed

Deferred: none.
