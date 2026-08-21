# Bug 0187: four function predicates cannot fail

## Status

- **State:** Fixed — sabotage-verified per predicate, all four 0 → 3 or 4.
- **Severity:** Medium
- **Origin:** self-found · falsifiability sweep extended from `src/rules/` to the
  other 132 exported primitives (conditions, predicates, presets)
- **Reported:** 2026-08-21 · **Fixed:** 2026-08-21

## Symptom

`arePublic()`, `areProtected()`, `arePrivate()` and `areNotAsync()` are exported
public API. Widen all four to `test: () => true` — so that they filter nothing
at all — and the suite is unchanged:

```
 Test Files  261 passed (261)
      Tests  3519 passed (3519)
```

An author writing `.that().arePublic()` believes the rule applies to public
functions. It applies to whatever the predicate says, and nothing can tell.

## Reproduction

Replace each body with `return { description: 'MUTATED', test: () => true }` and
run `npx vitest run` in `packages/ts`. Measured 2026-08-21: 3519 pass, 0 fail.

## Root cause

**This is not "the primitives had no tests".** That was
[bug 0186](./0186-two-security-rules-cannot-fail.md), where the names appeared
nowhere. These four are exercised — `areNotAsync` has its own `describe` block
and three call sites, and the three visibility predicates run through the
builder under a `describe('arePublic (full chain)')`. They look covered.

Every one of those assertions is satisfied by "matches everything", in one of
two shapes:

**One-sided unit tests.** The whole of `areNotAsync`'s own block was:

```ts
it('matches non-async functions', () => {
  expect(areNotAsync().test(findFn('parseFooOrder'))).toBe(true)
})
```

`test: () => true` satisfies that. There was no `.toBe(false)` on an async
function anywhere — the predicate was only ever asked what it accepts, never
what it must reject, and a filter is defined by what it rejects.

**`.not.toThrow()` over a fixture chosen so the rule passes.** The visibility
predicates are used like this, in `tests/integration/function-rules.test.ts`
(28 `.not.toThrow()` assertions in that file):

```ts
it('public functions should not return any (compose with arePublic)', () => {
  // No function in the fixture returns `any`, so this should pass
  expect(() => {
    functions(p)
      .that()
      .arePublic()
      .should()
      .haveReturnTypeMatching(not(matching(/^any$/)))
      .check()
  }).not.toThrow()
})
```

The comment states the defect. The test asserts a rule passes over a fixture
selected so that it passes; widening the selector adds more functions that also
pass, so the assertion holds no matter what `arePublic` does.

`areAsync()`'s own unit block was one-sided in the same way, in the opposite
direction: it asserted only `.toBe(false)` on a non-async function, never
`.toBe(true)` on an async one. It is **not** in this bug's list, and the reason
is worth stating rather than assuming — measured, its margin was **9**, so eight
other call sites were already holding it. Being one-sided did not make it
unfalsifiable here; it made it dependent on tests written for something else.
The mirror is added anyway, taking it to 10.

## Why it matters

ADR-009: _a check that cannot fail is worth less than no check, because it is
counted as coverage._ These four are worse than 0186's two on exactly that
clause. `noConsole` had no tests, so a reader counting coverage would find
nothing. These have a `describe` block each. The coverage is legible, and false.

This is the failure the vacuity work since ts-archunit 0.18 exists to prevent,
and it is the one instance an `examined`-style count cannot reach: subjects
genuinely arrive, they are simply the wrong ones. A runtime census of examined
subjects over this suite clears all four — measured, 29,280 subjects examined,
these tests among them. Only mutation sees it.

## Fix

Tests only. **No fixture was added** — `MixedVisibility` in
`packages/ts/tests/fixtures/poc/src/members.ts` has carried a public, a
protected, a private and a no-modifier member since plan 0030. What was missing
was asserting against them.

`tests/predicates/function.test.ts` gains a matrix: each predicate asserted
against all four members, so every row states both what it accepts **and** what
it must reject. Plus:

- a **VACUITY row** — the fixture really carries three distinct scopes, asserted
  before anything is derived from it, because a fixture drifted to one
  visibility would satisfy the matrix trivially (ADR-010);
- a **mutual-exclusion row** — exactly one of the three matches each member,
  which catches a widening that per-predicate rows could miss if two drifted
  together;
- `noModifier` pinned as **public**, because TypeScript treats an absent modifier
  as public and a rule saying "public methods must X" has to cover it;
- the missing direction for `areNotAsync`, and its mirror for `areAsync`;
- `description` assertions — the strings baselines hash on (`hashViolation` keys
  on `rule::subject`).

## Verification

- [x] Red test written first: the repro above. All four widened, full suite
      **3519/3519 green** — measured, not inferred.
- [x] Sabotage-verified per predicate after the fix, by re-running the sweep's
      own mutation (`test: () => true`) against the repaired tree:

      | predicate      | before | after |
      | -------------- | ------ | ----- |
      | `arePublic`    | **0**  | 3     |
      | `areProtected` | **0**  | 3     |
      | `arePrivate`   | **0**  | 3     |
      | `areNotAsync`  | **0**  | 2     |
      | `areAsync`     | 9      | ~9    |

      **Corrected 2026-08-21.** The first version of this table read 4/4/4/3/10 —
      every after-value one too high, the same off-by-one that
      [bug 0186](./0186-two-security-rules-cannot-fail.md) carried and for the same
      reason (measured against a stale `dist`, so one unrelated test failed in
      every run). Re-measured after a fresh build, naming rows instead of counting:
      gutting `arePublic` fails `arePublic() matches the public members and REJECTS
      the others`, `the three are mutually exclusive` and `describe themselves by
      their scope`; gutting `areNotAsync` fails `rejects an async function — the
      direction that was missing` and `has readable description`. `areAsync` was
      not re-measured directly and its after-value is left approximate rather than
      restated as a number nobody checked.

- [x] `tests/predicates/function.test.ts` goes 18 → 27 tests, and the suite
      3519 → 3528. The two deltas agree; the first draft of this line said
      "22 → 27", a number inferred rather than measured, and the suite total is
      what caught it.
- [x] `npm run validate` green.

## Residue, stated rather than implied

**`.not.toThrow()` — measured afterwards, and the concern does not survive.**
This section first said 371 such assertions remain, that "the shape cannot
distinguish" legitimate ones from the vacuous, and that "nothing measures which
is which". Something does now, and the population is healthy.

The instrument: make **every** condition report a violation for every element it
receives (an early return injected into all 74 `evaluate()` bodies in
`packages/ts/src`), then run the suite. Any `.not.toThrow()` test whose rule
genuinely examines subjects must fail. The ones that still pass are green for
some reason other than the rule's own logic. One suite run, not 369.

Of the **369** `it()` blocks containing `.not.toThrow()` (372 occurrences; all
titles literal, so all matchable against the reporter):

|                                                    | n       |                                                                                                                                |
| -------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **LIVE** — failed when conditions report           | **267** | the assertion is doing work                                                                                                    |
| inert: not a rule `.check()`                       | 41      | builder mechanics; `.not.toThrow()` is incidental                                                                              |
| inert: asserts cardinality                         | 21      | emptiness IS the assertion — `TerminalBuilder.assertsCardinality()` exempts it on purpose                                      |
| inert: test double / condition defined in the test | 17      | `defineCondition`, `TestRuleBuilder`, `SourceFileRuleBuilder` — outside `src/`, so the probe cannot reach them by construction |
| inert: subsystem off the `Condition.evaluate` path | 9       | correspondence, smells, tsconfig, graphql                                                                                      |
| inert: declares its emptiness                      | 6       | `.expectEmpty()` / `.allowEmpty()`                                                                                             |
| inert: uses `.warn()`                              | 2       | cannot throw by design                                                                                                         |
| inert: unexplained after classification            | 6       | **read individually — all legitimate**                                                                                         |

The last six were the point of the exercise and every one held up: positive-control
siblings asserting `.toThrow(ArchRuleError)` in the same block, an inline
`defineCondition`, a `smells.duplicateBodies` chain, and a `.not.toThrow()` whose
block's real assertion is a `.toThrow()` two lines down.

**Two classifier false positives are worth recording**, because both were caught by
reading the test rather than by the tool. A `\.notExist\(` pattern missed
`notExist<TypeDeclaration>()` written inside `satisfy(...)`, and a "no double"
pattern missed a builder subclass defined in the test file itself. Each time the
regex said "suspicious" and the source said "fine" — the same shape as this
session's three earlier mutation-matrix false alarms.

That first probe covered the `Condition.evaluate` path only, leaving 26 inert
blocks in test doubles, smells, correspondence, tsconfig and graphql
**unmeasured rather than cleared**. A second pass closed that.

### The second probe — one seam, every builder

All ten builder families extend a `TerminalBuilder`, and each routes its result
through a single `collectViolations()` thunk in `asRun()`. Injecting there — "if
this rule examined anything at all, report a violation" — covers rules, smells,
correspondence, cross-layer, slice, tsconfig and graphql at once, and reaches
builder subclasses defined inside test files, because they extend the real thing.

**The seam is in `packages/ts/src/core/terminal-builder.ts`, not the kernel's.**
Patching `packages/core/src/terminal-builder.ts` changed nothing and the run came
back identical to baseline — the ts dialect carries its own 917-line
`TerminalBuilder` (the kernel's is 455) with its own `vacuity-diagnosis.ts` and
`execute-rule.ts`, and every ts builder imports `../core/terminal-builder.js`. A
null result that looked like "nothing to find" was actually "wrong file", and only
the calibration run distinguished them.

Calibrated both ways: probe off, 3528 pass / 0 fail; probe on, 2873 / 655.

|                                         | n       |
| --------------------------------------- | ------- |
| **LIVE** under the condition probe      | 267     |
| **LIVE** under the builder-seam probe   | 296     |
| **LIVE under either — combined**        | **298** |
| inert under both: not a rule `.check()` | 39      |
| inert under both: asserts cardinality   | 21      |
| inert under both: declares emptiness    | 4       |
| inert under both: uses `.warn()`        | 1       |
| inert under both: unexplained           | 6       |

The six were read individually and **all carry a positive assertion in the same
block** — `expect(() => rule.check()).toThrow(ArchRuleError)`, or a
`violations()` inspection asserting a `bypassFilters` config finding. Three say
outright that they were **flipped from `.not.toThrow()`** when the evidence floor
landed:

> `// Behaviour flip, plan 0099. This asserted '.not.toThrow()': a 'minLines' so …`
> `// REVERSED at 0.23.0: this asserted '.not.toThrow()', pinning a detector …`

That is this concern, already found and fixed once, with the history kept in the
tests that changed.

**So: no `.not.toThrow()` test is vacuous, and none was changed.** 298 of 369 are
demonstrably live; the other 71 are each explained by a mechanism the corpus
documents. The residue this section opened with is closed, not narrowed.

**`resideInFolder` has no margin.** Widening it explodes the corpus every
path-based rule selects, and the suite times out (435s against a ~35s norm) on a
quiet machine. 111 tests reacted, so it is emphatically not unfalsifiable, but
this method cannot put a number on it.

**42 primitives sit at margin 1** across all 183 swept, and no gate measures
margin. Still unowned — see 0186's residue, unchanged.

Deferred: none
