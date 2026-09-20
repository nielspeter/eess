# Bug 0333: the recommended floor reads functions only

## Status

- **State:** Fixed — each floor rule reads the broadest subject its condition has a variant for:
  `modules()` for `no-eval`, `no-function-constructor` and `no-silent-catch`, `functions()` for
  `no-empty-bodies`. Red test first.
- **Severity:** High — **false green on the floor every adopter installs.** `recommended` builds
  every rule it ships with `functions(p, …)`, so `eval` in a class's static block or in a callback
  handed to a call at module level passes it, while `noEval()` on `classes()` and `moduleNoEval()`
  on `modules()` — rules this package already ships — read both. The preset's own name for the rule
  is `no-eval`, and an adopter reading that reasonably believes it means no eval.
- **Origin:** self-found · [0321](./0321-function-positions-no-function-rule-reads.md) ruled
  that those positions belong to the class and module rules rather than to the function collection,
  which leaves the floor not running them.
- **Reported:** 2026-09-20 · **Fixed:** 2026-09-20 (PR #149)

## Symptom

Measured on PR #148's build, `recommended(p, { report: 'return' })`, findings under
`preset/recommended/no-eval` — and wider than this record first said. Eleven positions were
measured; ten reported nothing:

| the file holds                                | before | after          |
| --------------------------------------------- | ------ | -------------- |
| `export function c() { eval('x') }` (control) | 1      | 1 (`c`)        |
| `eval('x')` — a bare top-level statement      | **0**  | 1 (`floor.ts`) |
| `export const v = eval('x')`                  | **0**  | 1 (`floor.ts`) |
| `app.get('/', () => eval('x'))`               | **0**  | 1 (`floor.ts`) |
| `export const m = memo(() => eval('x'))`      | **0**  | 1 (`floor.ts`) |
| `export class S { static { eval('x') } }`     | **0**  | 1 (`S`)        |
| `export class F { x = eval('x') }`            | **0**  | 1 (`F.x`)      |
| a silent catch at top level                   | **0**  | 1              |
| a silent catch in a static block              | **0**  | 1              |

**A bare `eval('x')` at the top of a file passed a preset whose rule is named `no-eval`.** That is
not an exotic position, and it is what took this record from the three positions bug 0321 ruled out
to "the floor reads function bodies and nothing else".

## Root cause

`packages/ts/src/presets/recommended.ts:152` builds each spec with
`functions(p, { includeObjectLiteralFunctions: true })`. There is one collection and one subject
kind, so a condition that exists for classes or modules is never constructed. The four floor rules
are `no-eval`, `no-function-constructor`, `no-silent-catch` and `no-empty-bodies`; the first has a
class twin and a module twin, the second has a class twin, and the last two are function-shaped by
nature.

## Fix

**Ruled: each rule reads the broadest subject its condition has a variant for, and exactly one.**

The subject kinds NEST — a module's search reads the whole file, a class's reads its members — so a
rule built over two of them reports the same call twice. Measured: `moduleNoEval` reports the
control inside a function as well as everything outside one. One subject per rule id is therefore
not a preference but the only shape that does not double-report.

- `no-eval` → `modules()`; `no-silent-catch` → `modules()`; `no-function-constructor` → `modules()`,
  which needed a module variant this package did not have (`moduleNoFunctionConstructor`, added).
- `no-empty-bodies` stays on `functions()`. An empty body is a fact about a function; at module
  scope the question has no meaning.

**A module finding now names the declaration that contains the match** (`element`), falling back to
the file when nothing does — `c`, `S`, `F.x`, else `floor.ts`. Without it this ruling would have
turned every finding the floor already made from `runEval` into `dangerous.ts`, and `element` is
what `.excluding()` keys on and what a reader looks at first. A module finding's identity is keyed
on the file and the matcher, not on `element`, so a baseline built on module rules is unaffected by
that half.

**What it costs, measured:**

- **A baseline built on the floor must be regenerated** for the three rules that changed subject:
  their identities carry the subject kind (`function-body::…` → `module-body::…`). Unavoidable under
  any ruling that changes what a rule reads.
- **`expectEmpty` no longer applies to those three.** A matched file is always a subject, so they
  are never empty. This does not degrade silently: an adopter who declares one of them empty now
  gets the declaration's own assertion failing — _"`expectEmpty: […]` asserted this rule examines
  nothing, and it examines …"_ — which is the eess rule that a declaration is an assertion, not a
  silencer, doing exactly its job. Measured.
- **Cost on this repository's floor gate:** 0.87s over 270 source files, against 0.92–1.02s before
  the change. Reading whole files rather than collecting every function is not slower here.

## Related

- [0321](./0321-function-positions-no-function-rule-reads.md) — the ruling that leaves this
  open, with the measured table of which position each rule kind reads.

## Verification

- [x] reproduced and pinned — the KNOWN-GAP test filed with this record, which asserted the control
      was reported so a floor gone dead could not pass it. Red against the fix before it was
      replaced.
- [x] a ruling on which subject kinds the floor runs — see **Fix**: the broadest each condition has
      a variant for, and exactly one.
- [x] the fix, with the KNOWN-GAP test inverted —
      `packages/ts/tests/presets/the-floor-reads-every-subject.test.ts` ·
      `it('reports eval wherever it is written, not only inside a function')`,
      `it('reports one finding per call, not one per subject kind that could read it')` and
      `it('keeps the empty-body rule on its function subject')`. Each row names the element it is
      reported under, so a fix with the right count under the wrong subject could not pass.
- [x] the preset's own carrier tests re-asserted under the ruling, from both sides: the rule that is
      empty clears when declared, and a rule that examines the file reports its false declaration —
      `packages/ts/tests/presets/recommended.test.ts` ·
      `it('the carrier reaches EVERY rule the preset constructs')` and
      `it('declaring one rule clears ONLY that rule — by NAME, not by count')`.
- [x] Sabotage matrix over the three preset test files, sources restored by sha256 and verified,
      the tree unchanged. R0, as built: nothing red. R1, every rule reading a function again: 21
      red. R2, the empty-body rule reading a module: 22 red. R3, the eval rule back on functions: 1
      red. R4, the new module twin matching nothing: 2 red. R5, a module finding naming the file
      only: 4 red. R6, one naming a declaration always: 2 red.
- [x] a changeset — `.changeset/the-floor-reads-every-subject.md`, a breaking `minor`.
- [x] `npm run validate` green.

Deferred: none.
