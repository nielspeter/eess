# Bug 0245: a correspondence finding is about two elements and names one, so `--changed` drops it from the other

## Status

- **State:** Draft — found by architecture review, verified in source, not fixed.
- **Severity:** Medium — **a false green under `--changed`, in the kernel.** The
  finding is correct and complete on a full run. What is lost is the diff-aware
  run: edit the side the finding is not anchored at, and the gate reports
  nothing. That is the direction that costs most — the edit that breaks the
  correspondence is precisely the one that makes the finding invisible.
- **Origin:** self-found · architecture review of the
  [0242](./fixed/0242-a-waiver-on-a-non-anchor-file-silently-does-not-apply.md)
  fix, which asked whether the anchor problem had a kernel sibling. It does.
- **Reported:** 2026-09-04

## Symptom

`correspondence()` is the kernel's two-sided join: it binds two element
selections and reports where they disagree. Every finding it emits is therefore a
fact about **two** elements. It is constructed by one function
(`packages/core/src/correspondence.ts:65`) which takes a single `ElementInfo` and
sets `file` from it. Nothing sets `relatedFiles`.

`relatedFiles` is the field
[0239](./fixed/0239-a-cluster-finding-carries-one-file-so-diff-aware-drops-the-rest.md)
added for exactly this shape, and `DiffFilter` reads it
(`packages/core/src/diff-aware.ts:57`): a violation survives `--changed` when its
own `file` changed **or** when any file it names as related did. A finding with
no related files survives only from its anchor.

So the kernel's own join has the defect that record fixed in one dialect's
duplicate detector, and it has it for every dialect at once.

## Where it bites hardest

`preserveRelations` — because there both endpoints exist and the unnamed one has
a real file. The finding reads:

```
<left> "X" relates to "Y" but its <right> counterpart does not
```

anchored on the left element. The right counterpart is a located element the
matcher already holds (`packages/core/src/correspondence.ts:255-271`). Delete the
relation on the RIGHT — the edit that causes the finding — and a `--changed` run
touching only that file drops it.

`beComplete` splits in two, and the first draft of this record treated it as one.
Architecture review found the half that was missed:

- **`leftAmbiguous`** (`packages/core/src/correspondence.ts:210`) — _"matches
  multiple Rs — the correspondence is ambiguous"_. Those counterparts are real,
  located elements. That is not an open question at all; it is the same clear
  defect as `preserveRelations`, and the record did not name it.
- **The unmatched arms** are the genuine question: a finding saying an element
  has **no** counterpart cannot name a counterpart's file, because there isn't
  one. What such a finding could honestly carry is the other selection's source,
  which is not always one file. Worth deciding deliberately rather than by
  omission.

**And the severity is understated, in a way that widens the defect.**
`violationFor` sets `file: info.file ?? '<selection>'`
(`packages/core/src/correspondence.ts:70`), and `ElementInfo.file` is optional.
A selection whose `identify` yields no file therefore produces a violation whose
`file` is the literal string `'<selection>'` — never a path, never in any changed
set, and `bypassFilters` is not set. Such a finding is invisible under
`--changed` from **every** side, not merely from the unnamed one. Whether any
shipped dialect hits that path today is one grep across their `identify`
implementations and is owed before this is fixed.

## Why it matters

This is not one dialect's problem. `correspondence()` is what
`adrEnforcement`, the diagram/code binding and `eess-crossvalidate` are built on,
so a spec-versus-code disagreement is reported at one artifact and invisible from
the other under `--changed`. The whole promise of those gates is that drift
between two artifacts fails the build; a filter that can only see one of the two
weakens exactly that.

`--changed` is also the mode a pre-commit hook and a PR gate would use, which is
where the invisibility lands on the person who made the edit.

## Reproduction

Not yet written as a fixture. By inspection, verified 2026-09-04:

- `violationFor` (`packages/core/src/correspondence.ts:65`) constructs every
  correspondence violation and sets `rule`, `ruleId`, `element`, `file`, `line`,
  `message`, `codeFrame` — and no `relatedFiles`.
- `grep relatedFiles packages/core/src` returns the type declaration, the JSON
  formatter and the diff filter. No producer in the kernel sets it.

**Stated as an inspection and not as a measurement on purpose**, because the
0242 record two doors down is a case study in what inspection gets wrong: the
same review that found this one also read a `groupByFolder` sort key as a live
defect that a probe then showed to be unreachable. A red test comes first here
too.

## Fix (not built)

Give `violationFor` the counterpart's `ElementInfo` where one exists, and set
`relatedFiles` from it. `preserveRelations` has it in hand at the point of
construction. `beComplete` needs the decision above first.

Two things to settle before building:

- **What `beComplete` should name**, if anything. An honest `undefined` beats an
  invented file.
- **Whether this needs a fixture per dialect or one in the kernel.** The kernel
  is where the bug is; the dialects are where it is felt.

## Do not re-derive the ordering — the seam, named now

Whoever fixes this will need "which of these locations does the finding sit at",
and `eess-ts` already answers it: `comparePositions`
(`packages/ts/src/smells/duplicate-report.ts:126`) is the total order — path,
then line, then name — and `anchorIndex`
(`packages/ts/src/smells/duplicate-report.ts:168`) picks the minimum. Written
down here on architecture review's instruction, because re-deriving it
independently in the kernel is precisely the reinvent-in-a-second-place failure
that would justify promoting it, arrived at by accident instead of on purpose.

**It is deliberately NOT in the kernel today**, and the reasoning should be
inherited rather than re-litigated: one consumer is speculative generality; the
kernel emits no multi-location finding at all (that is what this record is);
and ADR-011 makes the kernel root public API, so a hoist would publish a symbol
whose only caller is one dialect's unit test — `@nielspeter/eess/internal` would
be the ceiling, not the root.

**Fixing this record creates the second consumer.** That is the moment to
promote, not before — and the kernel's shape differs enough to be worth checking
first: it holds two `ElementInfo`s with optional `file`/`line` and a
`'<selection>'` sentinel, not an N-list of guaranteed positions.

## Verification

- [ ] Red first: a `preserveRelations` finding survives `--changed` when only the
      right-hand file changed, and does not today.
- [ ] The identity is unchanged, so committed baselines are unaffected.
- [ ] A `check:nonvacuity` row, so an emptied implementation cannot stay green.
- [ ] `leftAmbiguous` names its counterparts — the half this record first missed.
- [ ] The unmatched arms' behaviour is decided explicitly and written down, not
      left as whatever falls out.
- [ ] Whether any dialect's `identify` yields no file — making `file` the literal
      `'<selection>'` and the finding invisible from every side — is measured, and
      the answer is recorded here either way.

## Related

- [0239](./fixed/0239-a-cluster-finding-carries-one-file-so-diff-aware-drops-the-rest.md)
  — the same defect in `eess-ts`'s duplicate detector, fixed there. This record
  is that finding asked of the kernel.
- [0242](./fixed/0242-a-waiver-on-a-non-anchor-file-silently-does-not-apply.md) —
  the other coordinate of a two-sided finding: which side it is reported AT.
  Review of that fix is what surfaced this.
- [0084](./0084-preserve-relations-right-to-left.md) — the other open defect in
  the same function: `direction: 'both'` checks one direction. Anyone opening
  `relations()` should read both.
