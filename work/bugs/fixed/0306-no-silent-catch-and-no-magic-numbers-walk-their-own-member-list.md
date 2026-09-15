# Bug 0306: `noSilentCatch`, `noMagicNumbers` and the class metrics rules walk their own member list

## Status

- **State:** Fixed — `noSilentCatch` reads all the code a class runs, `noMagicNumbers` reads the
  class's member code, and the metrics ceilings measure a function-valued property as a callable
  member. None of them reads a default inside a destructured parameter (0309). A number that is the
  whole value of the class's own property or parameter is named by it, by design, so the reported
  `constructor(x = 4444)` stays unreported. Red test first.
- **Severity:** High — **false green.** A silent `catch` in an arrow-function property — the
  usual shape of an event handler on a class — passed `noSilentCatch`, and a magic number
  anywhere but a method passed `noMagicNumbers`.
- **Origin:** found by the method review of
  [0300](./0300-class-body-search-reads-methods-constructors-and-accessors-only.md)'s fix,
  measured then.
- **Reported:** 2026-09-14 · **Fixed:** 2026-09-14

## Symptom

As reported. `noSilentCatch()` over one class, a silent `catch (e) {}` per position:

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

0300 and 0307 fixed the class body search that `contain`, `notContain` and `useInsteadOf` share.
These rules did not use it; each kept its own list of members. `noSilentCatch` walked methods,
constructors and accessors; `noMagicNumbers` walked methods only — not even constructors; the class
metrics rules walked methods, constructors and accessors. The line pointers this record carried
were removed at close: the walks they named were replaced.

## Fix

**`noSilentCatch`** (`packages/ts/src/rules/errors.ts`) matches every catch clause over the shared
class search, with the reach 0307 gave a must-not-contain rule: member bodies, parameter defaults,
property initializers, static blocks, decorators, computed names and `extends`. Which clause is
silent is decided per match by `silentCatchMessage` (`packages/ts/src/conditions/catch-analysis.ts`),
which the function and module variants' `findSilentCatches` now use too. A finding's node and message
are unchanged. The first cut decided silence in the matcher and again in the loop; #137's first
enforcement review found the second check could not fail, so the matcher now finds catch clauses only.

**`noMagicNumbers`** (`packages/ts/src/rules/code-quality.ts`) is a numeric-literal matcher over the
same search. A finding names the member the number sits in — `Class.constructor`, `Class.static` for
a static block, `Class.limit` for an accessor — and a number in a method keeps the message it always
had. A number is read by its value, `getLiteralValue()`: the old `Number(text)` read `5_000` as `NaN`,
in the message and against the allowed list. #137's second architecture and product reviews found
it, and it is fixed here because this fix rewrote both lines. The description changes from
`have no magic numbers in method bodies` to `have no magic numbers in member code`: the old one names a
scope the rule no longer has. A baseline identity includes it, so its wording was settled here rather
than later, as #137's second product review asked, and the changeset says baselined findings report
once more and that the new ones among them need review. The metrics rules keep `have no method with …`,
which still reads true of a function-valued property.

The lines below were drawn by the implementer while fixing 0306 on 2026-09-14 — the maintainer had
asked that day for design questions to be reasoned out rather than put to them — and each moved under
#137's reviews. The maintainer accepts or rejects them at merge.

- **Reach.** The first cut read all the code a class runs, as `noSilentCatch` does. #137's first
  enforcement review measured the cost: every validation and ORM decorator argument — `@Max(150)`,
  `@Column({ precision: 12 })` — became a finding. Reading more is the fail-closed direction for a
  rule whose every match is a defect, as `notContain(call('eval'))`'s is; a number in a decorator
  argument is named by the decorator that takes it, so reading it adds findings nobody should act on.
  The rule reads member code — method, constructor and accessor bodies, parameter defaults, property
  initializers and static blocks — and a test pins that a decorator's and a computed name's numbers
  are not reported. The class body search's own documentation says why.
- **Named values.** `static readonly TIMEOUT_MS = 5000` IS the named constant the rule's message asks
  for. The first cut exempted `readonly` properties only; this repo's own architecture gate, which
  runs `noMagicNumbers`, then reported `private _minDistinctVocabulary = 8` and
  `private _minSimilarity = 0.85` in `packages/ts/src/smells/duplicate-bodies.ts` — builder defaults
  already named by their fields — and the exemption moved to any property or parameter. #137's first
  method review measured that as too broad: it exempted a nested function's default and a class
  expression's field inside a method, which the old method walk had reported. The exemption now covers
  a number that is the whole value of the class's own property or of its members' own parameter
  defaults. One inside a larger initializer or default, or in a function or class nested inside a
  member, is reported, and a test pins the nested cases. So a constructor default the Symptom table
  counts as a gap is reported when the number sits inside a larger default, not when it is the whole
  default. A number named another way — a key in a table a property holds, an array element, a
  function-valued property's parameter default, a local constant — is still reported; where that line
  belongs is 0317's question.
- **Sign and wrappers.** The first cut read a named value through any prefix operator, which exempted
  `~9696`; #137's first enforcement review found it, and the second cut read through a `-` or `+`
  sign only. #137's second enforcement and architecture reviews then measured
  `static readonly LIMIT = 5000 as const`, `(5000)` and `5000 satisfies number` reported, while the
  metrics rules in the same fix read a function through exactly those wrappers. A named value is now
  read through a sign, parentheses, `as`, `<T>`, `satisfies` and `!`, and a test pins each, and `~`.

**The metrics ceilings** (`packages/ts/src/rules/metrics.ts`). The record left open whether an
arrow-function property is a member of its own for them. The implementer ruled it is, on the same day
and on the same terms as above: a ceiling fails closed only if it measures every callable member, and
`onClick = () => {…}` is as callable as `onClick() {…}` — skipping it lets any amount of complexity
through. `maxCyclomaticComplexity`, `maxMethodLines` and `maxParameters` measure a property whose value
is an arrow function or a function expression, named `Class.onClick`, read through parentheses, `as`,
`<T>`, `satisfies` and `!` — the first cut read the bare function only, which #137's first enforcement
review found. Declared members are listed first and named exactly as before, so an existing finding
keeps its qualified name and its identity; a test that does not sort pins that order, and pins a
property finding's line at the property. A static block, a parameter default, a function nested in a
property's value and a property holding anything else are not callable members and are not measured;
`maxClassLines` still counts them.

**Found by #137's reviews beyond this record, and filed rather than widened into it:** a default
inside a destructured parameter is read by no class rule (0309); an expression body whose root is a
decision measures one low (0310); `haveCyclomaticComplexity` and `maxMethods` count their own members,
a disagreement this fix opened for the predicate (0311); a static block and a function nested in a
property's value have no metric ceiling (0312); the cardinality scan reads another test's generated
probes (0313); the function rules read no parameter default (0314); the function builder does not
collect constructors, accessors, function-valued properties or wrapped functions (0315); no nonvacuity
probe reaches the magic-number and metrics gates (0316); and the named-value line above (0317).

## Verification

- [x] Red test first — `packages/ts/tests/rules/class-rules-read-the-code-a-class-runs.test.ts`, the
      KNOWN-GAP tests inverted into target tests and run before the fix: `noSilentCatch` reported line
      `['4']` of five positions; `noMagicNumbers` reported the method's finding only, of seven;
      `maxCyclomaticComplexity`, `maxParameters` and `maxMethodLines` reported nothing on the
      function-valued properties; the CONTROL passed. An existing test in
      `packages/ts/tests/rules/code-quality.test.ts` pinned the gap — "does not scan constructor
      bodies" — and was inverted. The tests grew under #137's reviews; the matrix's red-first rows
      below measure each shipped walk again against the tests as they now stand.
- [x] The fix turns them green —
      `it('noSilentCatch reports a silent catch wherever the class runs it')`,
      `it('noMagicNumbers reports a magic number anywhere in member code, named by its member')`,
      `it("noMagicNumbers exempts the class's own named values, not those of a function or class nested in a member")`,
      `it('noMagicNumbers reads a number by its value, so a numeric separator matches the allowed list')`,
      `it('the class metrics rules measure a function-valued property as a member')` and
      `it('the metrics rules list declared members before function-valued properties, and anchor a property finding at the property')`,
      with
      `it('CONTROL — a property that is not a function, and a static block, are not members a metric measures')`
      still green. In `code-quality.test.ts` the inverted
      `it('reports a magic number in a constructor body')` passes, and
      `it('supports custom allowed list')`, which asserted an empty list the rule could not fail, now
      expects the constructor's finding by its message. The magic-number tests pin what is not
      reported — `@Retry(4040)`, a computed name `[4646]`, `static readonly TIMEOUT_MS = 5000`,
      `private readonly offset = -6000`, `retries = 4848`, `retry(attempts = 4949)`, `bonus = +7171`,
      a named value behind each of the five wrappers, and the class's own `own = 8000` and
      `p(z = 9000)` — and what is: `scaled = 4747 * 10`, `constructor(x = 4444 * 2)`,
      `flags = ~9696`, an accessor's `4141`, `4_256` as 4256, and a nested function's default, a nested
      class's field and a nested function's signed default. The metrics test pins a function behind
      each of the five wrappers.
- [x] Sabotage matrix in the 0306 worktree (per-entry `node_modules`, `@nielspeter/eess` resolved
      to the worktree’s `packages/core`, literal replacements in `errors.ts`, `code-quality.ts`,
      `metrics.ts` and `catch-analysis.ts` restored by sha256 after every row, verdicts read by test
      title over the 0306 test file and `code-quality.test.ts` only): **39 rows, 0 mismatches**, run
      after #137's second review fixes. Baseline green. Each rule's shipped walk restored reds its own
      tests in those two files: `noSilentCatch`'s its test; `noMagicNumbers`'s the member-code and
      separator tests and the constructor and allowed-list tests; the metrics' the metrics and order
      tests. `noSilentCatch` reading member code only reds its test; `noMagicNumbers` reading
      decorators, computed names and `extends` reds its test. Removing the static-block or accessor
      label reds the member-code test; removing the constructor label also reds the constructor and
      allowed-list tests. Removing the named-value exemption, or not exempting a parameter default,
      reds both exemption tests. Exempting a number inside a larger initializer; not reading through
      a sign, or reading through any prefix operator, or through only `-` or only `+`; and not
      reading through any one of the five wrappers each red the member-code test. Exempting any
      class's property, or any function's parameter, reds the nested test. Matching the allowed list
      against the text reds the separator test; building the message from the text also reds the
      member-code test. Measuring arrow functions only, or reading through any one of the five
      wrappers fewer, reds the metrics test; function expressions only also reds the order test.
      Measuring every property reds the CONTROL. Listing function-valued properties first, or
      anchoring a property finding at its function, reds the order test. Reporting every catch, or
      treating a catch with no binding as not silent, reds the silent-catch test. Ignoring the allowed
      list reds the member-code, nested and separator tests and two `code-quality` tests. A total
      break of all three rules reds their six tests that expect a finding and three `code-quality`
      tests. Not guardable by construction, and so not rows: the catch matcher's `Node.isCatchClause`
      and the magic-number matcher's `Node.isNumericLiteral`, because the search checks the kind before
      it calls a matcher; the loops' `Node.isCatchClause` and `Node.isNumericLiteral`, which narrow a
      node the matcher already found to be one; the initializer comparisons in the named-value check,
      because under member-code reach a numeric literal whose parent is a property or a parameter is
      always its initializer; and `memberLabel`'s class-name fallback, which member code never reaches.
      Other test files guard more of this — `errors-silent-catch.test.ts` the shared
      `findSilentCatches`, `metrics.test.ts` a constructor's metric name — and the matrix does not
      count them.
- [x] `npm run validate` green.
- [ ] deferred→[0309](./0309-a-default-inside-a-destructured-parameter-is-not-read-by-the-class-rules.md) —
      "anywhere in member code" does not reach a default inside a destructured parameter, for
      `noSilentCatch` and `noMagicNumbers` as for every class rule.
- [ ] deferred→[0310](../0310-complexity-misses-a-decision-at-the-root-of-an-expression-body.md) — a
      function-valued property whose expression body is itself a decision is measured one low.
- [ ] deferred→[0311](../0311-the-class-metric-predicates-and-max-methods-count-their-own-members.md) —
      the `haveCyclomaticComplexity` predicate and `maxMethods` do not follow the metrics rules’ members.
- [ ] deferred→[0312](../0312-code-a-class-runs-that-no-metric-ceiling-measures.md) — a static block
      and a function nested in a property's value have no metric ceiling; this record first stated it
      as a limit, and review asked for a home.
- [ ] deferred→[0313](../0313-the-cardinality-scan-reads-probe-files-another-test-writes-mid-run.md) —
      the first full `packages/ts` run after the fix failed both scan tests in
      `packages/ts/tests/tools/scan-cardinality-assertions.test.ts`, and the next passed; traced to the
      scan reading another test's generated probes.
- [ ] deferred→[0316](../0316-no-nonvacuity-fixture-for-the-magic-number-and-metrics-gates.md) — no
      nonvacuity probe shows the gates this fix widened can fire on this repo; raised by #137's first
      enforcement review.
- [ ] deferred→[0317](../0317-no-magic-numbers-reports-numbers-named-other-ways.md) — where the
      named-value line sits for a keyed table, an array element, a function-valued property's
      parameter and a local constant.
- [ ] dropped-on-purpose — #137's first enforcement review noted that a finding in a computed member
      name takes that name's whole source text as its element, which feeds the baseline identity. A
      computed name has no other name: `getElementName` names every class-rule finding inside a member
      so, and this fix changes no naming.

Deferred: [0309](./0309-a-default-inside-a-destructured-parameter-is-not-read-by-the-class-rules.md),
[0310](../0310-complexity-misses-a-decision-at-the-root-of-an-expression-body.md),
[0311](../0311-the-class-metric-predicates-and-max-methods-count-their-own-members.md),
[0312](../0312-code-a-class-runs-that-no-metric-ceiling-measures.md),
[0313](../0313-the-cardinality-scan-reads-probe-files-another-test-writes-mid-run.md),
[0316](../0316-no-nonvacuity-fixture-for-the-magic-number-and-metrics-gates.md),
[0317](../0317-no-magic-numbers-reports-numbers-named-other-ways.md).
