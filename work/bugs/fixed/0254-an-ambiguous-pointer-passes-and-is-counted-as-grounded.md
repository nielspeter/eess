# Bug 0254: an ambiguous pointer passes silently and is counted inside "all ground in code"

## Status

- **State:** Fixed — an ambiguous pointer is a violation naming its candidates;
  the sixteen live instances are resolved or sanctioned, and the two that were
  also stale are recorded below.
- **Severity:** Medium — **a false green, not an over-claim.** Sixteen live
  pointers resolve to nothing, are never reported, and are counted in the
  denominator of a line that says they all resolved. This is the class
  [ADR-010](../../../adr/010-a-pass-is-constructed-from-evidence.md) exists to
  forbid: a pass constructed from a default rather than from evidence. It is
  worse than [0253](../0253-frozen-drift-is-not-reported-only-unexamined.md),
  where nothing wrongly passes.
- **Origin:** self-found · review of
  [0249](./0249-most-of-work-is-outside-every-corpus-root.md), which
  widened the corpus root and added six instances on its first run.
- **Reported:** 2026-09-04

## Symptom

`packages/md/src/conditions/pointer-resolve.ts:118`:

```typescript
if (m.kind === 'ambiguous') return [] // reported elsewhere, never failed
```

**There is no elsewhere.** Nothing in `packages/md/src/rules`,
`packages/md/src/builders` or `scripts/check-corpus.mjs` counts, prints or
surfaces an ambiguous pointer. The comment describes a behaviour that was never
built, and it is the same shape as 0253 one branch over in the same file — found
by the review of the change that filed 0253, not by that filing.

The consequence is in the summary `check:corpus` prints on every green run:

```
pointers  463 live · ✓ all ground in code
```

**Measured 2026-09-04**, resolving every live pointer by hand against the
corpus's own file index:

| resolution                                      | count  |
| ----------------------------------------------- | ------ |
| exact repo-relative path                        | 355    |
| unique suffix match                             | 92     |
| **ambiguous — 2+ candidates, silently skipped** | **16** |
| unresolvable                                    | 0      |

Sixteen of 463 are inside `✓ all ground in code` without having grounded in
anything.

## Reproduction

Any bare filename that suffix-matches more than one file in the repo. The
sixteen live today, by document:

- `work/fold-audit-2026-08-19.md` — 6 (`project-relative.ts`, `path-universe.ts`,
  `cli/commands/check.ts`, `rule-builder.ts` ×2, `execute-rule.ts`)
- `work/bugs/0168-no-unused-exports-misses-barrel-re-exports-and-inline-type-imports.md` — 3 (`src/index.ts`, 5 candidates each)
- `work/plans/0235-the-emitter-takes-a-receipt.md` — 3 (`shared.ts`, 3 candidates each)
- `adr/010-a-pass-is-constructed-from-evidence.md` — 1 (`terminal-builder.ts`)
- `work/bugs/0130-cli-summary-counts-the-invocation.md` — 1 (`check.ts`)
- `work/bugs/0178-the-kernels-dead-glob-finding-cannot-fire.md` — 1 (`rule-builder.ts`)
- `work/proposals/009-core-a-verdict-cannot-be-assembled-by-hand.md` — 1 (`execute-rule.ts`)

Two resolved by hand, both false:

- `work/fold-audit-2026-08-19.md:294` cites line 294 of a bare
  `rule-builder.ts` as `fork._conditions = []`. That line is a closing brace in
  the kernel's copy and a comment terminator in the ts dialect's.
- `work/fold-audit-2026-08-19.md:293` cites line 337 of the same bare filename as
  a `_phase` comparison. That line is JSDoc prose in both candidates.

(Written without the `file:line` shape on purpose — quoting one of these
verbatim creates a seventeenth instance, which the first draft of this record
did. Inline code is extracted; only fenced blocks are not.)

Both are wrong, both pass, and both **cannot** fail — the ambiguity is what
protects them.

## Why it matters

The record that widened the root argued the suffix-resolution trap was the real
hazard: a pointer "checked and blessed against the wrong file — strictly worse
for a reader, because the gate now vouches for it." That hazard has a second
form nobody had looked at. A _unique_ suffix can be blessed against the wrong
file; an _ambiguous_ one is blessed against no file at all, and reads identically
in the summary.

The family already knows the right answer.
`packages/crossvalidate/src/gherkin-ts.ts:148` reports an ambiguous citation as a
violation carrying its own remedy — cite a longer suffix. `eess-md` does the
opposite while its docstring claims otherwise.

## Fix (not built)

The break class is nameable and the shape is settled by precedent: **an ambiguous
pointer is a finding, with a message naming the candidates and telling the author
to lengthen the suffix.** What needs deciding is only the severity —
`crossvalidate` fails; `eess-md` might reasonably `.warn()` first, since sixteen
existing pointers would red the build on the commit that ships it.

Whichever: it is a behaviour change in a published dialect, so it needs a
changeset, and the sixteen need fixing or sanctioning in the same change.

The JSDoc at `packages/md/src/conditions/pointer-resolve.ts` promising a report
that does not exist must go either way — that half is free.

## What the fix does

`pointerResolves` no longer returns early on `ambiguous`. It records the
candidates and falls through to the null-target path, so a corpus configured with
`externalRoots` still gets to resolve there first — an in-repo ambiguity is not
evidence about an external checkout. Failing that, it emits:

```
ambiguous code pointer: "rule-builder.ts:1" matches 2 files
(packages/core/src/rule-builder.ts, packages/ts/src/core/rule-builder.ts)
— cite a longer suffix so it names one
```

**No autofix**, deliberately: choosing among the candidates is a judgement, and a
deterministic rewrite would pick whichever sorted first and call it repaired.

**Severity is the caller's, not the condition's** (ADR-008). The condition emits a
violation; `.check()` fails on it and `.warn()` reports it, exactly as for broken
and stale. The record asked whether to ship `.warn()`-first — that turned out to
be the wrong question, because it is not the dialect's call to make.

The remedy rides in the **message** rather than `because`: `because` is
rule-level and one rule covers all three classes, which need different remedies.

## What the sixteen turned out to be

Resolving them is where the fix earned its keep — **the ambiguity was hiding
staleness**. Three pointers named a line that does not say what the document
claimed, and could not have failed while ambiguous:

| document             | was                                      | is                                                                                                                                                                                                                                                 |
| -------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `adr/010-…md`        | a bare `terminal-builder.ts` at line 467 | `packages/core/src/terminal-builder.ts:344` — the file is 447 lines by the gate's own arithmetic (`split('\n').length`, which counts the empty element after the trailing newline; `wc -l` says 446), so line 467 did not exist under either count |
| `work/bugs/0178-…md` | a bare `rule-builder.ts` at 259          | `packages/core/src/rule-builder.ts:280` — `deadGlobDiagnosis()` had moved 21 lines                                                                                                                                                                 |
| `work/bugs/0130-…md` | a bare `check.ts` at 153                 | `packages/ts/src/cli/commands/check.ts:260`, and the record's "verified live, unchanged" was not true                                                                                                                                              |

A fourth finding is substantive rather than positional:
**`resetStderrGuardForTests`, which [0168](../0168-no-unused-exports-misses-barrel-re-exports-and-inline-type-imports.md)
cites as an example of a barrel-only export, no longer exists anywhere under
`packages/ts/src`.** That record now says so; its example set needs re-deriving
by whoever fixes it.

Three rows in `work/fold-audit-2026-08-19.md` are sanctioned rather than
repointed. They are dated citations against commit `810808b`, the v0.2.3 release
tree — they record where a defect stood in _another_ tree on 2026-08-19, so
repointing them at today's code would falsify the measurement the audit exists to
preserve. Sanctioned as a region, because a directive inside a table cell is inert
([0255](./0255-an-exclusion-directive-inside-a-table-cell-is-inert.md)). Verified
narrow: a pointer immediately after the sanctioned region still reds.

## What review found, and what the first fix got wrong

Seven lenses reviewed the fix. Three of them independently found the same defect,
and it was the fix's own claim:

**The fix shut the front door and left a side door open.** `externalRoots` are
consulted before the new ambiguous branch, and every exit from that block
returned. So with `externalRoots` configured, an ambiguous pointer either
returned `[]` when no root was present on disk — **the identical silent skip this
record exists to close** — or was reported as `broken code pointer: … not in the
repo`, which is false, since the pointer is in the repo twice, and which throws
away the candidates and the remedy.

The changeset, the code comment and the JSDoc all asserted the opposite as a
settled fact. The enforcement lens measured why that survived: it inverted the
stated precedence and **all 116 `eess-md` tests still passed** — the claim had
never had a test. Three tests now cover the three cases, and both repairs are
sabotage-measured: each mutation fails exactly the test that covers it.

**The escape hatch the changeset offered did not work.** An `eess-exclude`
comment matches a violation by rule id, and a chain that never calls
`.rule({ id })` has none — so the sanction is silently inert, which is the shape
[0255](./0255-an-exclusion-directive-inside-a-table-cell-is-inert.md) is about,
reached by a second route. The prerequisite was documented once, in a kernel doc
the changeset did not link. It is now stated where the recipe is given.

**Three smaller things, each the same species as the bug:** the README — the doc
a stranger reads first — still described the old behaviour; an assertion added in
this very fix used backticks where the message uses double quotes and so could
never fail; and the count in the Verification box below was pinned and wrong, then
its first correction itemised the delta and was wrong again.

The parts that held up under independent measurement: all sixteen repaired
pointers were hand-verified against real code rather than accepted as gate-green;
the fold-audit sanctions were judged legitimate historical carve-outs rather than
coverage suppression; and the non-vacuity row catches both the original
regression and a reclassification into `broken`.

## Verification

- [x] An ambiguous pointer produces a finding naming its candidates — asserted on
      the message, and on both candidate paths by name rather than on a count
      (`packages/md/tests/pointers.test.ts`, three new tests plus a CONTROL that
      the unique suffix still resolves, so this is not "flag everything").
- [x] The denominator no longer counts a skipped pointer as grounded. It is no
      longer skipped: it is examined and reported, so `examined` and `resolved`
      are separately true without a second mechanism.
- [x] `check:nonvacuity` row `corpus/pointers/ambiguous` over the production
      script — its **own** row, because `gateCoverage()` asserts per rule id and
      this class shares `corpus/pointers-resolve` with two others. It asserts the
      message classes as `ambiguous` and names both candidates, not merely that
      the id fired. **Sabotage-measured:** restoring the `return []` takes both
      the json and terminal runs to exit 0, so the row reds. 73 → 74 fixtures.
- [x] The sixteen are resolved (13) or sanctioned (3), and re-measured rather
      than assumed — by re-running the gate, not by arithmetic on a remembered
      number.

      **This box pinned `464` and was wrong; the committed tree prints `463`.**
      Review caught it. The first correction then tried to itemise the delta and
      was also wrong — it attributed one pointer to this record leaving the live
      set when the record carries five (measured at the commit in question, not
      at the tip). **The reviewer who caught the pin then itemised it too, and
      also miscounted that same term — as two.** Three attempts at one small
      piece of arithmetic, three different answers, by two parties who were both
      being careful. The itemisation is dropped rather than attempted a fourth
      time.

      **The invariance, which is what the box should have said from the start:**
      the live pointer count falls whenever a document leaves the live set or a
      citation stops being a pointer, and `check:corpus` prints the current
      figure on every run. That sentence cannot go stale. A pinned integer in a
      record that is itself about to move into `fixed/` — changing the very count
      it pins — cannot help but. `work/bugs/fixed/0249…` records the identical
      lesson from the previous round; writing it down did not stop me repeating
      it, which is worth more than the number was.

- [x] No JSDoc claims a report that is not built — the "reported, never failed"
      docblock and the `paths` option's own wording both corrected.
- [x] `docs/markdown.md` **and `packages/md/README.md`** describe the rule, so
      the next person meets it in the guide rather than in a red build. The
      README was missed first time and caught by two lenses.
- [x] The `externalRoots` precedence is _tested_, not merely stated: three cases
      (absent roots, present-but-no-match, resolves-externally) with a CONTROL,
      each sabotage-measured. The two non-resolving exits used to skip silently
      and to report a false "not in the repo".
- [x] The exclusion recipe in the changeset names its `.rule({ id })`
      prerequisite, so the sanction it offers is not silently inert.
- [x] The summary classifier is extracted to `scripts/lib/pointer-classes.mjs`
      with its own tests, because its labels have now been wrong twice and could
      not be tested in place.
- [x] The gate's pointer summary learned the third class. It had two buckets and
      printed "16 stale (line past end)" over sixteen ambiguous ones — the same
      mislabelling the split was added to remove, one class later. It is now a
      table with an `unclassified` bucket, so a fourth class cannot be silently
      absorbed.

Deferred: none.

## Related

- [0249](./0249-most-of-work-is-outside-every-corpus-root.md) — deferred
  its foreign-pointer fixture box here after review measured its
  `dropped-on-purpose` premise false.
- [0253](../0253-frozen-drift-is-not-reported-only-unexamined.md) — the sibling
  false claim in the same file; an over-claim where this one is a false green.
- [0255](./0255-an-exclusion-directive-inside-a-table-cell-is-inert.md) — the
  sanction an author would reach for on a pointer like these does not work where
  most of them live.
