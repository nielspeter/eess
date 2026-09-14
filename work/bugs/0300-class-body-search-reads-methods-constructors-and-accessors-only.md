# Bug 0300: class-body search reads methods, constructors and accessors only

## Status

- **State:** Draft — reproduced, and pinned by KNOWN-GAP tests.
- **Severity:** High — **false green.** Every class-level body rule misses code in a
  field initializer, a static field, a constructor parameter default, a static block
  and an arrow-function property. In a class written for dependency injection, a
  field initializer is the ordinary place to read configuration.
- **Origin:** found by review of the records filed with it
  ([0297](./0297-no-process-env-reads-one-spelling-of-an-environment-read.md)),
  measured then.
- **Reported:** 2026-09-14

## Symptom

One class, one `process.env` read per position — all spelled `process.env.X`, so
this is not [0297](./0297-no-process-env-reads-one-spelling-of-an-environment-read.md):

| position                                          | `noProcessEnv()` |
| ------------------------------------------------- | ---------------- |
| field initializer `field = process.env.X`         | **missed**       |
| static field                                      | **missed**       |
| constructor parameter default                     | **missed**       |
| static block                                      | **missed**       |
| arrow-function property `f = () => process.env.X` | **missed**       |
| getter                                            | reported         |
| method                                            | reported         |

And `noEval()` reports nothing for `f = eval('1')` in a field initializer, while it
reports the same call in a method.

## Root cause

`searchClassBody` (`packages/ts/src/helpers/body-traversal.ts:176`) walks exactly
three things: every method's body (`:179`), the last constructor's body
(`:186-193`), and get and set accessors (`:196-207`). Property declarations,
parameter initializers and static blocks are never walked.

`classNotContain` (`packages/ts/src/conditions/body-analysis.ts:44`) is built on it,
and so is every class variant in `packages/ts/src/rules/security.ts` — `noEval`,
`noFunctionConstructor`, `noProcessEnv`, `noConsoleLog`, `noConsole`, `noJsonParse`
— and every adopter rule written `classes(p).should().notContain(…)`.

The JSDoc on `noProcessEnv` says "in class methods"; `docs/standard-rules.md:100`
says "No direct `process.env` access". Neither mentions fields.

## Fix

Walk the whole class — member initializers, parameter defaults and static blocks as
well as bodies — rather than enumerating member kinds. No ruling needed. Release: it
turns green gates red where a field was hiding a violation, so it is a behavioural
break, marked on `0.x`.

## Verification

- [x] KNOWN-GAP tests pin today's behaviour —
      `packages/ts/tests/conditions/class-body-search-skips-member-initializers.test.ts` ·
      `it('KNOWN GAP — noProcessEnv on a class misses every position that is not a method, constructor body or accessor')`
      and `it('KNOWN GAP — noEval on a class misses eval in a field initializer')`.
      Each asserts the method-body read IS caught, so neither can pass over a rule
      that catches nothing.
- [ ] the fix, with the KNOWN-GAP tests inverted into red-first tests
- [ ] `npm run validate` green.

Deferred: none.
