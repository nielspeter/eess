# Bug 0186: two exported security rules cannot fail

## Status

- **State:** Fixed — sabotage-verified per rule on the real tree, margins 0 → 5 and 0 → 3.
- **Severity:** Medium
- **Origin:** self-found · falsifiability sweep over all 51 `src/rules/` primitives,
  run to answer whether the `ts-archunit` test adoption had been gamed green
- **Reported:** 2026-08-21 · **Fixed:** 2026-08-21

## Symptom

`noConsole()` and `noJsonParse()` are exported public API
([`packages/ts/src/index.ts:397`](../../../packages/ts/src/index.ts) and `:398`),
documented, and **exercised by nothing**. Neither name appears anywhere under
`packages/ts/tests/`.

An adopter writing `.should().satisfy(noConsole())` believes console access is
now checked. It is checked by a rule no test can make fail.

## Reproduction

Replace both constructor bodies with a condition that can never report:

```ts
export function noConsole(): Condition<ClassDeclaration> {
  return { description: 'GUTTED', evaluate: () => [] }
}
```

Then `npx vitest run` in `packages/ts`:

```
 Test Files  261 passed (261)
      Tests  3510 passed (3510)
```

Nothing notices. That is the whole defect — colour cannot distinguish these two
rules working from these two rules deleted.

## Root cause

Both are one-line wrappers over machinery that IS well tested:

```ts
export function noConsole(): Condition<ClassDeclaration> {
  return classNotContain(access(/^console\./))
}
export function noJsonParse(): Condition<ClassDeclaration> {
  return classNotContain(call('JSON.parse'))
}
```

`classNotContain` is covered through `noEval`, `noFunctionConstructor`,
`noProcessEnv` and `noConsoleLog`. What was covered by nothing is each rule's
**discriminating argument** — the matcher it passes in — which is the entire
contribution the rule makes. Typo `/^console\./` to `/^consle\./` and the rule
reports nothing, forever, green.

`noConsole` vs `noConsoleLog` sharpens it: they differ in matcher **kind**, not
just breadth — `access(/^console\./)` against `call('console.log')`. Every
fixture that existed contained `console.log`, and a class containing
`console.log` cannot tell the two rules apart.

## Why it matters

This is the defect the project exists to prevent, in the project's own tree.
ADR-009: _a check that cannot fail is worth less than no check, because it is
counted as coverage._ Both rules are counted as enforceable primitives by
`scan-enforceable-primitives.ts`.

That census cannot see this, and says so executably — `it('NO coverage ratio is
derivable from name matching — the counter-example, documented')`. **No gate
binds "public primitive" → "exercised by a test".** The sweep that found this
was run by hand.

## Fix

A fixture carrying the cases that discriminate, and seven tests over it.

`packages/ts/tests/fixtures/rules/src/console-json-class.ts` — new, deliberately
separate from `security-class.ts`, whose classes are shared with the module- and
function-variant suites (widening one there would silently change what those
rules examine):

- `NonLogConsoleClass` — `console.warn`, `console.error`, and `console.table`
  **never called**, with no `console.log` anywhere. `noConsole` must flag all
  three; `noConsoleLog` must flag none. The uncalled access is what separates an
  `access` matcher from a `call` matcher.
- `JsonRoundTripClass` — `JSON.parse` beside `JSON.stringify`.
- `JsonWriterClass` — `JSON.stringify` alone, so the member name is pinned in
  both directions.

**The expectations are cross-derived, not hand-typed.** `fixtureLinesMatching()`
scans the fixture's TEXT for the sites and compares against the lines the rule's
AST walk reported — ADR-009 rule 5: a derivation is unguarded until a
differently-derived value can disagree with it. Hand-typing `[25, 29, 34]` would
agree with the rule by construction and survive any fixture edit.

Each cross-derivation carries its own vacuity guard (`expect(expectedLines)
.toHaveLength(3)`), because an empty scan would otherwise satisfy the comparison
against zero violations — the same vacuous green one level up (ADR-010).

A consequence, recorded because it is load-bearing: **no comment in the fixture
may contain a literal `console.`/`JSON.parse` spelling**, or the text scan counts
it as a site. The fixture's own header says so. The alternative — a comment
stripper in the test helper — would add untested logic to the fix for untested
logic.

## Verification

- [x] Red test written first: the repro above. Both rules gutted so they can
      never report, full suite **3510/3510 green** — measured 2026-08-21, not
      inferred from the absence of the names.
- [x] Sabotage-verified per rule, after the fix: gutting `noConsole` fails
      **5** tests (was 0); gutting `noJsonParse` fails **3** (was 0). Measured by
      re-running the sweep's own mutation against the repaired tree.
- [x] `security.test.ts` goes 8 → 17 tests.
- [x] The margins were raised deliberately after a first measurement came back
      `noConsole` 3 / `noJsonParse` **1**. Margin 1 is the weak class this whole
      audit is about — the two negative tests (`JsonWriterClass`, `CleanService`)
      assert _zero_ violations, so they stay green when the rule is gutted and
      only one test was carrying it. The `description` assertions close that, and
      they are load-bearing rather than padding: `description` becomes
      `violation.rule`, `hashViolation` keys on `rule::subject`, so the string is
      what every baselined entry for these rules hashes on.
- [x] `npm run validate` green.

## Residue, stated rather than implied

**The sweep covered `src/rules/` only** — all 51 exported primitives there, of
which these 2 were unfalsifiable. It did **not** cover `src/conditions/` (62
exported functions), `src/predicates/` (51), `src/builders/` (21) or
`src/presets/` (15). Roughly 150 exported functions are unswept. Nothing here
claims they are falsifiable; nobody has looked.

**The systemic gap is not closed by this record, and has no home.** 24 of the 51
swept rules have a margin of exactly **one** — a single test deletion from
unfalsifiable — and no gate measures margin.

A first draft of this section deferred that to "plan 0088 Phase 5, still
`pending`". **That was wrong and `check:corpus` caught the link.** Plan 0088 is
**Done** — all seven phases landed — and its Phase 5 is "Reconcile the eess-ts
dogfood gates", unrelated to margin. The `pending` row in its enforcement table
is a different clause (remedy fixtures). No plan or bug in the corpus owns
measuring rule margin; grepping `work/plans/` and `work/bugs/` for it returns
this record and three unrelated files.

So this is **disclosed residue, not a deferral** — there is nothing to defer it
to, and inventing a home would be worse than saying so. Standing one up is a
plan-authoring decision, not this bug's to make. This bug fixes the two rules at
margin 0; it does not build the instrument that would have caught them, and
nothing else is scheduled to.

Deferred: none
