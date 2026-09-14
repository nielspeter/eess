# Bug 0306: `noSilentCatch`, `noMagicNumbers` and the class metrics rules walk their own member list

## Status

- **State:** Fixed — `noSilentCatch` and `noMagicNumbers` read all the code a class runs, and the
  metrics ceilings measure a function-valued property as a callable member. Red test first.
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

**`noSilentCatch`** (`packages/ts/src/rules/errors.ts`) is a catch-clause matcher over the shared
class search, with the reach 0307 gave a must-not-contain rule: member bodies, parameter defaults,
property initializers, static blocks, decorators, computed names and `extends`. Which clause is
silent moved into `silentCatchMessage` (`packages/ts/src/conditions/catch-analysis.ts`), which the
function and module variants' `findSilentCatches` now use too. A finding's node and message are
unchanged.

**`noMagicNumbers`** (`packages/ts/src/rules/code-quality.ts`) is a numeric-literal matcher over the
same search. A finding names the member the number sits in — `Class.constructor`, `Class.static` for
a static block, the class alone for a class decorator or `extends` — and a number in a method keeps
the message it always had. Reading property initializers raised one question the old walk never
met: `static readonly TIMEOUT_MS = 5000` IS the named constant the rule's message asks for, and
reporting it would tell an author to extract what is already extracted. A number that is the whole value of a declaration — a property's
initializer or a parameter's default, sign included — is named by that declaration and is not
reported; one inside a larger initializer or default still is. The first version exempted `readonly`
properties only. This repo's own architecture gate, which runs `noMagicNumbers`, then reported
`private _minDistinctVocabulary = 8` and `private _minSimilarity = 0.85` in
`packages/ts/src/smells/duplicate-bodies.ts` — builder defaults already named by their fields — and
the line moved to any property or parameter. So a constructor default the Symptom table counts as a
gap is reported when the number sits inside a larger default, not when it is the whole default. The description changes from `have no magic numbers in method
bodies` to `have no magic numbers in the code the class runs`; a baseline identity includes it, and
the changeset says baselined findings report once more.

**The metrics ceilings** (`packages/ts/src/rules/metrics.ts`). The record left open whether an
arrow-function property is a member of its own for them. It is: a ceiling fails closed only if it
measures every callable member, and `onClick = () => {…}` is as callable as `onClick() {…}` — skipping
it lets any amount of complexity through. `maxCyclomaticComplexity`, `maxMethodLines` and
`maxParameters` measure a property whose value is an arrow function or a function expression, named
`Class.onClick`. Declared members are listed first and named exactly as before, so an existing
finding keeps its qualified name and its identity. A static block, a parameter default and a property
holding anything else are not callable members and are not measured — `maxClassLines` still counts
them — which is stated rather than filed.

## Verification

- [x] Red test first — `packages/ts/tests/rules/class-rules-read-the-code-a-class-runs.test.ts`, the
      KNOWN-GAP tests inverted into target tests and run before the fix: `noSilentCatch` reported line
      `['4']` of five positions; `noMagicNumbers` reported the method's finding only, of six;
      `maxCyclomaticComplexity`, `maxParameters` and `maxMethodLines` reported nothing on the
      function-valued properties; the CONTROL passed. An existing test in
      `packages/ts/tests/rules/code-quality.test.ts` pinned the gap — "does not scan constructor
      bodies" — and was inverted.
- [x] The fix turns them green —
      `it('noSilentCatch reports a silent catch wherever the class runs it')`,
      `it('noMagicNumbers reports a magic number wherever the class runs it, named by its member')` and
      `it('the class metrics rules measure a function-valued property as a member')`, with
      `it('CONTROL — a property that is not a function, and a static block, are not members a metric measures')`
      still green, and the inverted `it('reports a magic number in a constructor body')` passes. The
      `noMagicNumbers` test also pins the named-value exemption: `static readonly TIMEOUT_MS = 5000`,
      `private readonly offset = -6000`, `retries = 4848` and `retry(attempts = 4949)` are not reported,
      and `scaled = 4747 * 10` and `constructor(x = 4444 * 2)` are. The first full
      `packages/ts` run after the fix also failed two tests in
      `packages/ts/tests/tools/scan-cardinality-assertions.test.ts`; that file passed on its own, and
      the next full run passed all 3731 tests. The cause was not found, and it has not recurred.
- [x] Sabotage matrix in the 0306 worktree (per-entry `node_modules`, `@nielspeter/eess` resolved
      to the worktree’s `packages/core`, literal replacements in `errors.ts`, `code-quality.ts`,
      `metrics.ts` and `catch-analysis.ts` restored by sha256 after every row, verdicts read by test
      title over this file and `code-quality.test.ts`): **19 rows, 0 mismatches**, run again after the
      named-value exemption replaced the readonly one. Baseline green. Each rule’s shipped walk
      restored reds its own test only, and `noMagicNumbers`’s also the inverted constructor test.
      Reading member code only reds the rule’s test, for both `noSilentCatch` and `noMagicNumbers`.
      Removing the static-block label reds the magic-number test; removing the constructor label also
      reds the constructor test. Removing the named-value exemption, not treating a parameter default
      as a named value, treating a number inside a larger initializer as one, or not reading a value
      through its sign reds the magic-number test. Measuring arrow functions only, or function
      expressions only, reds the metrics test; measuring every property reds it and the CONTROL.
      Reporting every catch, or treating a catch with no binding as not silent, reds the silent-catch
      test. Ignoring the allowed list reds the magic-number test and two `code-quality` tests. A total
      break of all three rules reds their three tests and the two `code-quality` tests that expect a
      finding. Two rows were void on their first run: prettier had put the matcher on one line, so
      their search strings did not match; they were re-anchored and run again.
- [x] `npm run validate` green.

Deferred: none.
