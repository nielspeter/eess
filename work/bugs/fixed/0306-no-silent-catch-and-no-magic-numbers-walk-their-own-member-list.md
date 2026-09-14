# Bug 0306: `noSilentCatch`, `noMagicNumbers` and the class metrics rules walk their own member list

## Status

- **State:** Fixed — `noSilentCatch` reads all the code a class runs, `noMagicNumbers` reads the
  class's member code, and the metrics ceilings measure a function-valued property as a callable
  member. A number that is the whole value of the class's own property or parameter is named by it,
  by design, so the reported `constructor(x = 4444)` stays unreported. Red test first.
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
are unchanged. The first cut decided silence in the matcher and again in the loop; #137's enforcement
review found the second check could not fail, so the matcher now finds catch clauses only.

**`noMagicNumbers`** (`packages/ts/src/rules/code-quality.ts`) is a numeric-literal matcher over the
same search. A finding names the member the number sits in — `Class.constructor`, `Class.static` for
a static block — and a number in a method keeps the message it always had. The description changes
from `have no magic numbers in method bodies` to `have no magic numbers in the class member code`; a
baseline identity includes it, and the changeset says baselined findings report once more.

Three lines were drawn in the fix on 2026-09-14, under the maintainer's instruction to fix 0306, and
each moved under #137's reviews:

- **Reach.** The first cut read all the code a class runs, as `noSilentCatch` does. #137's
  enforcement review measured the cost: every validation and ORM decorator argument — `@Max(150)`,
  `@Column({ precision: 12 })` — became a finding. Reading more is the fail-closed direction for a
  rule whose every match is a defect, as `notContain(call('eval'))`'s is; a number in a decorator
  argument is named by the decorator that takes it, so reading it adds findings nobody should act on.
  The rule reads member code — method, constructor and accessor bodies, parameter defaults, property
  initializers and static blocks — and a test pins that a decorator's and a computed name's numbers
  are not reported.
- **Named values.** `static readonly TIMEOUT_MS = 5000` IS the named constant the rule's message asks
  for. The first cut exempted `readonly` properties only; this repo's own architecture gate, which
  runs `noMagicNumbers`, then reported `private _minDistinctVocabulary = 8` and
  `private _minSimilarity = 0.85` in `packages/ts/src/smells/duplicate-bodies.ts` — builder defaults
  already named by their fields — and the exemption moved to any property or parameter. #137's method
  review measured that as too broad: it exempted a nested function's default and a class expression's
  field inside a method, which the old method walk had reported. The exemption now covers a number
  that is the whole value of the class's own property or of its members' own parameter defaults. One
  inside a larger initializer or default, or in a function or class nested inside a member, is
  reported, and a test pins the nested cases. So a constructor default the Symptom table counts as a
  gap is reported when the number sits inside a larger default, not when it is the whole default.
- **Sign.** A named value is read through a `-` or `+` sign. The first cut read through any prefix
  operator, which exempted `~9696`; #137's enforcement review found it, and a test pins `~`.

**The metrics ceilings** (`packages/ts/src/rules/metrics.ts`). The record left open whether an
arrow-function property is a member of its own for them. Ruled in the fix on 2026-09-14, under the
maintainer's instruction to fix 0306 and open to #137's reviews, it is: a ceiling fails closed only if
it measures every callable member, and `onClick = () => {…}` is as callable as `onClick() {…}` —
skipping it lets any amount of complexity through. `maxCyclomaticComplexity`, `maxMethodLines` and
`maxParameters` measure a property whose value is an arrow function or a function expression, named
`Class.onClick`, read through parentheses, `as`, `<T>`, `satisfies` and `!` — the first cut read the
bare function only, which #137's enforcement review found. Declared members are listed first and
named exactly as before, so an existing finding keeps its qualified name and its identity. A static
block, a parameter default, a function nested in a property's value and a property holding anything
else are not callable members and are not measured; `maxClassLines` still counts them.

**Found by #137's reviews beyond this record, and filed rather than widened into it:** a default
inside a destructured parameter is read by no class rule, and the function rules read no parameter
default at all (0309); an expression body whose root is a decision measures one low (0310);
`haveCyclomaticComplexity` and `maxMethods` count their own members (0311); a static block and a
function nested in a property's value have no metric ceiling (0312).

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
      `it("noMagicNumbers exempts the class's own named values, not those of a function or class nested in a member")`
      and `it('the class metrics rules measure a function-valued property as a member')`, with
      `it('CONTROL — a property that is not a function, and a static block, are not members a metric measures')`
      still green, and the inverted `it('reports a magic number in a constructor body')` passes. The
      magic-number tests pin what is not reported — `@Retry(4040)`, a computed name `[4646]`,
      `static readonly TIMEOUT_MS = 5000`, `private readonly offset = -6000`, `retries = 4848`,
      `retry(attempts = 4949)`, `bonus = +7171` and the class's own `own = 8000` and `p(z = 9000)` —
      and what is: `scaled = 4747 * 10`, `constructor(x = 4444 * 2)`, `flags = ~9696`, and a nested
      function's default, a nested class's field and a nested function's signed default. The metrics
      test pins a function behind each of the five wrappers.
- [x] Sabotage matrix in the 0306 worktree (per-entry `node_modules`, `@nielspeter/eess` resolved
      to the worktree’s `packages/core`, literal replacements in `errors.ts`, `code-quality.ts`,
      `metrics.ts` and `catch-analysis.ts` restored by sha256 after every row, verdicts read by test
      title over this file and `code-quality.test.ts`): **29 rows, 0 mismatches**, rewritten and run
      after #137's review fixes. Baseline green. Each rule’s shipped walk restored reds its own test
      only, and `noMagicNumbers`’s also the inverted constructor test. `noSilentCatch` reading member
      code only reds its test; `noMagicNumbers` reading decorators, computed names and `extends` reds
      its test. Removing the static-block label reds the magic-number test; removing the constructor
      label also reds the constructor test. Removing the named-value exemption, or not exempting a
      parameter default, reds both magic-number tests. Exempting a number inside a larger
      initializer, not reading through a sign, reading through any prefix operator, or reading
      through only `-` or only `+`, reds the member-code test. Exempting any class’s property, or any
      function’s parameter, reds the nested test. Measuring arrow functions only or function
      expressions only, or reading through any one of the five wrappers fewer, reds the metrics test;
      measuring every property reds the CONTROL. Reporting every catch, or treating a catch with no
      binding as not silent, reds the silent-catch test. Ignoring the allowed list reds both
      magic-number tests and two `code-quality` tests. A total break of all three rules reds their
      four tests and the two `code-quality` tests that expect a finding. Not guardable by
      construction, and so not rows: the loop's `Node.isCatchClause` check narrows a node the matcher
      already found to be one, and under member-code reach a numeric literal whose parent is a
      property or a parameter is always its initializer, so those initializer comparisons cannot fail.
- [x] `npm run validate` green.
- [ ] deferred→[0309](../0309-a-parameter-default-is-not-read-by-the-class-and-function-rules.md) —
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

Deferred: [0309](../0309-a-parameter-default-is-not-read-by-the-class-and-function-rules.md),
[0310](../0310-complexity-misses-a-decision-at-the-root-of-an-expression-body.md),
[0311](../0311-the-class-metric-predicates-and-max-methods-count-their-own-members.md),
[0312](../0312-code-a-class-runs-that-no-metric-ceiling-measures.md),
[0313](../0313-the-cardinality-scan-reads-probe-files-another-test-writes-mid-run.md).
