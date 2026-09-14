# Bug 0306: `noSilentCatch`, `noMagicNumbers` and the class metrics rules walk their own member list

## Status

- **State:** Draft — reproduced, and pinned by KNOWN-GAP tests.
- **Severity:** High — **false green.** A silent `catch` in an arrow-function property — the
  usual shape of an event handler on a class — passes `noSilentCatch`, and a magic number
  anywhere but a method passes `noMagicNumbers`.
- **Origin:** found by the method review of
  [0300](./fixed/0300-class-body-search-reads-methods-constructors-and-accessors-only.md)'s fix,
  measured then.
- **Reported:** 2026-09-14

## Symptom

`noSilentCatch()` over one class, a silent `catch (e) {}` per position:

| position                | reported |
| ----------------------- | -------- |
| arrow-function property | **no**   |
| static block            | **no**   |
| method                  | yes      |

`noMagicNumbers()` over one class, one literal per position:

| position                | reported |
| ----------------------- | -------- |
| arrow-function property | **no**   |
| static block            | **no**   |
| constructor default     | **no**   |
| method                  | yes      |

## Root cause

0300 fixed the class body search that `contain`, `notContain` and `useInsteadOf` share. These
rules do not use it; each keeps its own list of members:

- `noSilentCatch` walks methods, constructors and accessors (`packages/ts/src/rules/errors.ts:58`);
- `noMagicNumbers` walks methods only (`packages/ts/src/rules/code-quality.ts:125`);
- the class metrics rules walk methods, constructors and accessors
  (`packages/ts/src/rules/metrics.ts:20`).

## Fix

Not decided. `noSilentCatch` and `noMagicNumbers` read code, so the member walk 0300 introduced
answers them. The metrics rules measure a member — its complexity, its length — so whether an
arrow-function property is a member of its own, measured separately, is a question for them, not
a walk to reuse.

## Verification

- [x] KNOWN-GAP tests pin today's behaviour —
      `packages/ts/tests/rules/class-rules-with-their-own-member-walk.test.ts` ·
      `it('KNOWN GAP — noSilentCatch reads a method, not an arrow property or a static block')` and
      `it('KNOWN GAP — noMagicNumbers reads a method, not an arrow property, a static block or a parameter default')`.
      Each asserts the method IS reported, so neither can pass over a rule that reports nothing.
- [ ] the fix, with the KNOWN-GAP tests inverted into red-first tests
- [ ] `npm run validate` green.

Deferred: none.
