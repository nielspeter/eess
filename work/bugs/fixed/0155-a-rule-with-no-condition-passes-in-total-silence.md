# Bug 0155: A rule with subjects and no condition passes in total silence

## Status

- **State:** Fixed — closed in this PR. Red test first
  (`packages/core/tests/assertion-less-rules.test.ts`: 4 of 6 rows failing
  before the change, both controls green), then the three-part fix, then the
  kernel contract test rewritten to prove its own contract directly.
  Deferred: none.
- **Severity:** High — false green. Subjects are selected, nothing is asserted
  about them, and `.check()` returns normally. This is the defect the product
  exists to prevent, in the library's own engine.
- **Origin:** self-found · fold audit of ts-archunit's fixed-bug corpus
  (upstream bug 0019), prompted by [bug 0154](../0154-a-directive-inside-a-string-literal-suppresses-a-real-violation.md)
- **Shipped in:** the published `@nielspeter/eess` (`0.2.2`) / `eess-ts`
  (`0.2.1`). The guard is at `rule-builder.ts:337` in `810808b` (the `v0.2.3`
  release commit), so this is live for adopters today — not gated behind plan 0100.
- **Reported:** 2026-08-19

## Symptom

A rule that selects subjects but chains no condition passes silently. The
guard that is supposed to catch it is unreachable for every rule written with
`.should()` — which is every rule the DSL documents.

## Reproduction

Verified against `packages/ts/dist` over `packages/ts/tests/fixtures/poc`:

```js
functions(p)
  .that()
  .haveNameMatching(/^parse/)
  .check()
// → does NOT throw. Exit 0.
// stderr only: "[eess] Rule '…' has predicates but no conditions."
```

Four subjects are selected. Nothing is asserted. The build is green.

Three shapes measured, because they differ and the title's claim ("total
silence") belongs to the last two, not the first:

| shape                                                | violations | stderr        |
| ---------------------------------------------------- | ---------- | ------------- |
| `.that().<pred>.check()`                             | 0          | warning fires |
| `.that().<pred>.should().violations()`               | 0          | **nothing**   |
| `.that().<pred>.should().areExported().violations()` | 0          | **nothing**   |

Row 3 is the sharpest red test available: the guard's own message asks _"Did
you use a predicate-only method after `.should()`?"_ — and provably cannot fire
for exactly that case.

## Root cause

`packages/core/src/rule-builder.ts:333`:

```ts
if (this._conditions.length === 0 && this._phase === 'predicate') {
```

`should()` (`rule-builder.ts:110-114`) sets `fork._phase = 'condition'`, so the
`_phase === 'predicate'` term is false for any rule spelled with `.should()`.
The guard can only fire for the predicate-only shape. And even when it fires it
is a `writeStderr` warning (`:335`), never a finding.

**This predates plan 0088's fold** — `git show 810808b:packages/core/src/rule-builder.ts`
carries the identical line at `:337`. eess forked from ts-archunit at ~0.17 and
froze; upstream fixed this afterward and the fix was not carried across.

Upstream's fix was two-part: an instrument (`assertsSomething` /
`collectWithAssertionGuard`) and a gate that turns the warning into an
unsuppressable finding. `grep -rn "assertsSomething\|collectWithAssertionGuard"
packages/` returns **zero hits** in eess.

Note the deliberate decision recorded at `rule-builder.ts:330-332` — that an
assertion-less rule "stays a stderr warning, not the unsuppressable ADR-010
finding." That decision is defensible; what is not is that the warning it
routes to cannot fire for the documented rule shape.

### Re-verified 2026-08-21 — the pointers rotted, the fix did not

**Every line number in this section is historical and no longer resolves to what
it describes.** The kernel re-split ([plan 0165](../../plans/completed/0165-integrate-the-copied-ts-archunit-engine.md)
Phase 2) moved 30 modules and renumbered the rest. Read them against the anchor
this record already names — `810808b`, the `v0.2.3` release commit — where
`packages/core/src/rule-builder.ts:337` is verifiably the broken guard, comment
and all. In the current tree those same numbers land in `buildRuleDescription()`,
which has nothing to do with this bug.

`check:corpus` is green over all of them, and that is not a gate failure: the
pointer check proves a cited line **exists**, never that it says what the prose
claims — which is [bug 0138](../0138-pointer-resolve-proves-existence-not-truth.md),
demonstrated here on a record filed two days earlier.

**The grep in this section has also inverted.** It reads
`grep -rn "assertsSomething\|collectWithAssertionGuard" packages/` returns **zero
hits** in eess — the diagnosis that eess lacked upstream's instrument. Run today
it returns many: the instrument is present on both paths. That sentence is true
of the tree it was written against and false of this one.

Where the machinery lives now:

|                             |                                                                           |
| --------------------------- | ------------------------------------------------------------------------- |
| the guard                   | `packages/core/src/rule-builder.ts:377`                                   |
| `assertsSomething()`        | `packages/core/src/rule-builder.ts:216`                                   |
| `should()` sets the phase   | `packages/core/src/rule-builder.ts:122`                                   |
| the finding constructor     | `packages/core/src/terminal-builder.ts:422`                               |
| the rewritten contract test | `packages/core/tests/contract/extension-surface.test.ts:265` (was `:207`) |

**The check worth making, given the split, is that the fix survived on _both_
implementations** — the failure mode [bug 0163](../0163-a-config-finding-prints-twice-defeating-adr-008s-gated-clause.md)
turned out to have, where a fix landed on one of two duplicated copies and
nothing recorded it. It did:

- kernel — `rule-builder.ts:377` calls `assertionLessViolation()`;
- eess-ts — `core/terminal-execution.ts:28` branches on `run.assertsSomething()`
  and returns `assertionLessFinding(run.facts)`.

Two constructors for one concept, which is the duplication 0165 Phase 2 names
rather than a defect in this fix. Both dialect families are gated; no path
regressed. The old `writeStderr` warning ("predicates but no conditions") is gone
from the tree entirely.

## A kernel contract test is green because of this defect

Found in PR #70's review, and it constrains the fix.

`packages/core/tests/contract/extension-surface.test.ts:207` —
`it('named-selection reuse across two branches does not leak conditions (bug
0016, RuleBuilder side)')` — ends with a branch that calls `.should()` and
adds no condition, asserting `not.toThrow()`. Its comment claims that branch
_"hits the 'predicates but no conditions' assertion-less path and passes."_

**It does not.** Measured: that shape emits **zero** stderr lines. `should()`
sets `_phase = 'condition'`, so the guard at `rule-builder.ts:333` cannot
fire — which is precisely this bug. The test passes in total silence, and its
stated mechanism is fiction.

Two consequences:

- **Fixing part 1 below changes what that test asserts** (the branch starts
  warning); **fixing part 2 breaks it** (the branch starts throwing). The test
  and its comment must be rewritten as part of this fix, not after.
- **Plan 0150 cites this test title** as its evidence that plan 0088's
  review-finding 4 is closed
  (`work/plans/0150-close-0088s-disclosed-review-findings.md`). That evidence
  is weaker than the citation implies: the test does exercise the copy-on-write
  contract, but its final assertion currently proves nothing.

See [bug 0156](../0156-should-twice-silently-drops-the-first-assertion.md).
An intermediate draft claimed the two fixes were _entangled_ — that 0156 could
not be fixed without first settling `fork()` semantics. **That is not so:**
0156's fix is measured, one line, and leaves this contract test passing 9/9.
What the two genuinely share is only this test's **comment**, which
misdescribes why its final branch passes. Correcting that comment belongs to
whichever of the two is picked up first; neither blocks the other.

## Ruling — unsuppressable configuration finding, not a warning (2026-08-19)

The open question this record carried. Decided against ADR-009's own
discriminator, with the blast radius measured rather than estimated.

**ADR-009 rule 1 states the test:** _"The discriminator is whether the remedy
is optional, not whose check it is… A finding the reader is expected to judge
has an optional remedy and should warn. A finding with one correct answer must
fail."_

An assertion-less rule has **no optional remedy**. There is no state in which
"it keeps asserting nothing" is correct — the answer is add a condition or
delete the rule, and either way something must change. Contrast the two rules
ADR-009 itself names as deliberately `warn`: `no-silent-catch` and
`no-empty-bodies` warn _because_ they have known suppressible false positives
the user must judge one by one. This has none.

**The counter-argument in the code answers a different question.**
`rule-builder.ts:330-332` reads: _"distinct from the zero-examined case above
and stays a stderr warning, not the unsuppressable ADR-010 finding — examined
is non-zero either way."_ That is **true, and it settles a different point**:
it correctly rules out reusing `zeroExaminedViolation()`'s message, because
this is not the zero-examined case. It does not establish that the answer is a
_warning_. The choice was always "which finding", not "finding or warning" —
and the argument only eliminates one candidate finding.

**Upstream reached the same conclusion**, for a reason eess shares: _"A rule
that asserts nothing about what it selects cannot fail, so it is reported as a
configuration finding."_

**Blast radius, measured** (guard made reachable in an isolated worktree, then
promoted to a finding, suites and gates run both ways):

|                                                                                     |            |
| ----------------------------------------------------------------------------------- | ---------- |
| assertion-less rules in `arch`/`arch.internal`/`spec`/`family`/`mermaid` rule files | **0**      |
| tests broken                                                                        | **1**      |
| everything else                                                                     | unaffected |

The single test is
`packages/core/tests/contract/extension-surface.test.ts:207` — the one this
record already establishes is **green for the wrong reason**: its final branch
asserts `not.toThrow()` and its comment claims that branch "hits the
'predicates but no conditions' assertion-less path", which it provably does
not. Rewriting it is owed regardless of this ruling.

## Fix

Three parts. Parts 1 and 2 are this bug; part 3 is the consequence.

1. **Make the guard reachable** — drop the `_phase === 'predicate'` term at
   `packages/core/src/rule-builder.ts:333`. `should()` sets the phase to
   `'condition'`, so today the guard cannot fire for any rule the DSL
   documents. Without this, part 2 changes nothing.
2. **Emit a configuration finding**, not a stderr line: `bypassFilters: true`
   so `.excluding()` cannot suppress it and `.asSeverity('warn')` cannot
   downgrade it — it reports that the rule's own instrument is broken, not a
   fault in what was examined. Message names the rule and both remedies (add a
   condition, or delete it).
3. **Rewrite `extension-surface.test.ts:207-220` and its comment.** Give
   branch B its own passing condition so the test proves "no leak" directly,
   instead of leaning on the assertion-less path to keep it quiet.

**Ordering, corrected after review (PR #71, architect).** An earlier draft said
"gate-first, ahead of `collectViolations()`", with the accepted consequence
that a dead glob plus no condition reports the missing assertion only.
**Measured, both halves were wrong:** the gate sits _inside_
`collectViolations()` and _after_ the zero-examined branch, so a dead selector
reports as a dead selector — and the "saves a full walk" rationale is empty,
since `getElements()` and the predicate filter have already run. The real
behaviour is the better one; it is now stated as what it is.

**All four builders, not just the kernel.** `slices()`, `schema()`,
`schemaFromSDL()` and `resolvers()` carried the identical branch as a stderr
warning. Fixing only `RuleBuilder` would have left one DSL with four different
answers to the same mistake — and the changeset's headline would have been an
overclaim. The finding constructor therefore lives on `TerminalBuilder` beside
its five siblings and is exported, so each builder passes its own remedy.

**Do not extend `RuleBuilder` inline.** A crude inline version pushed the class
to 313 lines and tripped this repo's own 300-line rule; the finding constructor
belongs in a helper.

## Verification

- [x] Red test first, on the **`.should()` shape** — not the predicate-only
      one. `functions(p).that().<pred>.should().check()` and
      `…​.should().areExported().check()` must throw (or emit a finding).
      **Why the shape matters:** changing `writeStderr` → `throw` at
      `rule-builder.ts:335` while leaving the `_phase === 'predicate'` term
      intact satisfies a predicate-only test, satisfies the control, satisfies
      the vacuity control — and leaves every documented rule shape silent. A
      checklist that tests only `.that().<pred>.check()` is a false floor.
- [x] Control: a rule _with_ a condition is unaffected — both the failing and
      the passing case pinned.
- [x] Vacuity control: the fixture really selects a non-zero number of
      subjects, asserted by identity — via a condition reporting one violation
      per selected element, since running the assertion-less rule itself now
      returns the finding under test.
- [x] The warning-vs-finding decision is recorded in this file — see Ruling:
      an unsuppressable configuration finding, per ADR-009 rule 1's
      optional-remedy discriminator.
- [x] `extension-surface.test.ts` and its comment rewritten so branch B proves
      "no leak" with its own passing condition, not via silence.
- [x] `npm run validate` green.
- [x] **Re-verified 2026-08-21** on both duplicated engine copies, after the
      kernel re-split renumbered every pointer this record cites. The gate is
      live on the kernel and on eess-ts; the citations are corrected above and
      anchored to `810808b`.

Deferred: none.
