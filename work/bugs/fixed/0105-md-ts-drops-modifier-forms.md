# Bug 0105: `md-ts` discards every `it.skip` / `it.only` definition — its own regex allows modifiers, the guard above it does not

## Status

- **State:** Fixed — `extractTestDefs` filters on the root callee, so the
  `(?:\.\w+)?` the grammar has always carried finally applies. Three red tests
  before, 68 green after.
- **Severity:** Medium — **false red**, plus a missing capability. It can only
  add violations, never hide one, so it does not reach High.
- **Origin:** **inbound** — filed by an agent in an external project during its
  first downstream consumption of `@nielspeter/eess-crossvalidate@0.1.2`, and
  adopted here on 2026-08-12 after verification. Its illustrative example was
  re-sourced (it carried the reporting project's domain vocabulary); the
  diagnosis and fix are as submitted.
- **Reported:** 2026-08-12 · **Fixed:** 2026-08-12 (PR #43)

## Symptom

An ADR that cites a test written as `it.skip('…')` is reported as citing a test
that does not exist:

```
adr/00NN-….md:83 cited it() "it('a documented pending guarantee')"
  has no matching test
```

The test exists, its title matches the citation character for character, and it
is written `it.skip(…)` deliberately — the rule it would enforce cannot be live
yet, and the skipped test is the record of that, cited from the ADR precisely so
the gap stays visible.

## Reproduction

```ts
// tests/a.test.ts
it.skip('a documented pending guarantee', () => {})
```

```markdown
| … | 2 | Vitest · `it('a documented pending guarantee')` | pending |
```

`adrCitationsResolve(corpus, project)` reports the citation as unresolved.
Change `it.skip` to `it` and it resolves. Nothing else differs.

## Root cause

`extractTestDefs` filters on the **full** callee text before the regex ever
runs:

```ts
// packages/crossvalidate/src/md-ts.ts:71
if (call.getName() !== 'it') continue
```

`eess-ts` names a modifier call by its whole member expression. From the model
itself:

```ts
// packages/ts/src/models/arch-call.ts:145
const fullName = objectName !== undefined ? `${objectName}.${methodName}` : methodName
```

For `it.skip(…)` the callee is a property access, so `objectName = 'it'`,
`methodName = 'skip'`, and `getName()` returns `'it.skip'`. It is dropped one
line before anything looks at its title.

Two things in the same file say this is unintended rather than policy:

1. **The regex two lines up already accommodates modifiers.**
   `packages/crossvalidate/src/md-ts.ts:27` reads:

   ```ts
   const IT_NAME_RE = /^it(?:\.\w+)?\(\s*['"`]([^'"`]+)['"`]/
   ```

   That optional `(?:\.\w+)?` group exists for exactly `it.skip(` and
   `it.only(`, and the guard makes it unreachable.

2. **The citation side accepts them too.** `IT_CITE_RE` at
   `packages/crossvalidate/src/md-ts.ts:25` carries the same `(?:\.\w+)?`, so an
   ADR _may_ cite `it.skip('…')` — and the AST side can never produce a match
   for it. The two halves of one preset disagree about what a test is.

The sibling preset already resolved this question the other way, with the
reasoning written down at
`packages/crossvalidate/src/gherkin-ts.ts:76`:

```ts
const root = call.getObjectName() ?? call.getMethodName()
if (root !== 'it' && root !== 'test') continue
```

> "the root callee is what matters, not the modifier … The gate binds a
> citation, it does not run the test, so a skipped test's citation is still
> checked (consistent with 'cites, not exercises')."

That argument applies verbatim to `md-ts`, which was simply never brought
forward.

## Why it matters

The failure lands hardest on the case the mechanism is most useful for. A
skipped test is _documentation of a known gap_, and an ADR citing one is a
project being honest about what is not yet enforced. Under this bug that honesty
is what breaks the build, while a project that had quietly deleted the test
instead has nothing to trip over.

A downstream project cannot work around it locally either: the options are to
un-skip a test that must not run, delete the citation and lose the record, or
stop using the preset.

## Fix

Adopt `gherkin-ts`'s root-callee logic:

```ts
const root = call.getObjectName() ?? call.getMethodName()
if (root !== 'it') continue
```

Then the optional `(?:\.\w+)?` in the title grammar finally does its job.

**Two corrections to this record, found while fixing it.**

1. **The regex moved.** This record was filed against `IT_NAME_RE` at
   `md-ts.ts:27`. [0104](./0104-it-title-capture-stops-at-any-quote.md)
   replaced it with `itTitleOf` in `packages/crossvalidate/src/it-title.ts`,
   where the modifier group lives in `CALL()`. Same optional group, different
   home; the diagnosis is unaffected.

2. **`it.each(table)(…)` is not excluded the way this record claimed.** It is
   _two_ calls, and only one is stopped by the guard. Measured against the real
   model:

   | call                      | `getName()`       | root              |
   | ------------------------- | ----------------- | ----------------- |
   | outer `it.each([1,2])(…)` | `it.each([1, 2])` | `it.each([1, 2])` |
   | inner `it.each([1,2])`    | `it.each`         | **`it`**          |

   The inner call's root **is** `it`, so it passes the guard. It is stopped one
   line later instead: argument 0 is an array, not a string literal, so the
   enriched name is bare `it.each` and `itTitleOf` finds no `(`. The outcome the
   record predicted is right; the mechanism it gave was right for the outer call
   only. Both paths are now asserted by `0008-not-tests.md`.

One deliberate difference to settle rather than copy blindly: `gherkin-ts`
accepts `test` as well as `it`; `md-ts` does not. Widening `md-ts` to `test`
would change what an ADR is allowed to cite, so it belongs in the ADR-table
contract, not smuggled in with this fix. Filing this as-is keeps `it` only —
and 0104 kept the callee alternation at each call site precisely so this fix
could not smuggle it in.

**The stronger reason, found in review and worth recording:** `eess-md`'s
text-level check is `it`-only too (`packages/md/src/rules/adr.ts:44` and `:51`
both read `it(?:\.\w+)?\(`). Widening `md-ts` alone would put `check:crossval`
and `check:corpus` out of sync about what an ADR may cite — one gate green and
the other red on the same table row. The contract has three implementations and
no binding home; that is [0111](../0111-md-adr-citations-resolve-by-prefix.md)'s
territory, and the `test` question is one clause of it.

**The guard is not what performs the exclusion.** `itTitleOf` is anchored on the
literal callee, so the grammar alone already rejects `describe(…)`, `test(…)`,
`suite.it(…)` and the outer `it.each([…])(…)`. Review measured it: delete the
guard entirely and all 68 tests stay green. It is kept as a cheap pre-filter
(skipping `getArguments()` + `getText()` for every call in the project) and as
defence in depth — a widening needs both fences — not for a rejection it does
not perform. The code comment says so now; the first draft did not.

A `patch` changeset on `@nielspeter/eess-crossvalidate`.

## Verification

Red first: three new tests, two of which fail before the change (the third is the
guard that must keep passing). 68 green after.

- [x] Red test written first: an ADR citing `it('x')` resolves against
      `it.skip('x')` in the project — `0006-modifiers.md` against
      `tests/modifiers.cases.ts`. Failed before the fix.
- [x] `it.only`, `it.concurrent` and `it.todo` resolve (same ADR).
- [x] An ADR citing `it.skip('x')` — the form the citation side already permits —
      resolves against the same definition (`0007-cited-in-modifier-form.md`).
      Failed before the fix.
- [x] **The containment half reddens on the widening it names.**
      `0008-not-tests.md` asserts four unresolved citations — a templated title,
      `it.skipIf(cond)(…)`, `describe(…)`, and `test(…)`. Widening md↔ts to its
      sibling's `it|test` turns it red; measured. The first draft of this record
      claimed 0008 was "a guard rather than a symptom" because it passed before
      and after — **that was wrong**, and review measured it: passing on both
      sides is necessary, not sufficient. As first written, deleting the guard,
      widening it to accept anything, or adding `describe` all left it green,
      because it carried no row that any single change could reach. The `test(…)`
      row is what makes it a guard; without it, "md↔ts accepts `it` only" was a
      habit rather than a decision.
- [x] Each test pins its own citation count via `adrCitationStats` before
      asserting `not.toThrow()`. Review demonstrated the bare form: misspell
      `## Enforcement` in a fixture ADR and both new positive tests pass while
      checking nothing — the trap the sibling test 12 lines up already documents.
- [x] `npm run validate` green.

Deferred — each re-homed, none left with this record:

- **Whether `md-ts` should also accept `test(…)`**, as `gherkin-ts` does — a
  contract question for the ADR enforcement table, not a parser fix. Now pinned
  by a failing test rather than a comment (`0008-not-tests.md`), so the decision
  cannot drift silently while it waits. **→ [0111](../0111-md-adr-citations-resolve-by-prefix.md)**,
  which owns the three-implementation contract this is a clause of.
- **`it.skipIf(cond)(…)` / `it.runIf(cond)(…)` still show this bug's symptom** —
  a static, citable title that resolves to nothing, because the callee is itself
  a call. **→ [0117](../0117-conditional-modifier-tests-are-invisible.md)**.
- **A `gated` row now resolves against `it.skip(…)`** — a clause claiming "runs
  in CI, failing blocks", backed by a test that never runs. This fix does not
  create the hole (the text-level check always accepted modifier text) but it
  makes the strong gate agree with it. **→ [0116](../0116-gated-row-resolves-against-a-skipped-test.md)**.
- **`extractTestDefs` and `itTitles` are now the same four-step reader**,
  differing only in callee set and whether `line` is kept. **→ [0115](../0115-two-test-definition-readers.md)**.

**Not dogfooded.** This repo's own `check:crossval` does not exercise the new
behaviour: its three ADR citations are all plain `it(`, and `packages/ts` holds
no `it.skip`/`it.only`/`it.concurrent`. A green `check:crossval` is not evidence
the modifier path works — only the unit suite is.
