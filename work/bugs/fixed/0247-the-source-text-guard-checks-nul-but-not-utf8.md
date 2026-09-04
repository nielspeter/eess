# Bug 0247: the source-text guard catches the loud half and misses the silent one — invalid UTF-8 is unchecked

## Status

- **State:** Fixed — reproduced by planting one byte in a real source file,
  guarded, and closed in the same PR as the fix. `Deferred: none`.
- **Severity:** High — **a false green over the failure this repo's whole survey
  discipline depends on.** One stray byte makes `grep` skip a file with no
  warning, no output and no non-zero exit, while `check:integrity` reports the
  workspace clean. A search that skipped a file is indistinguishable from a
  search that found nothing in it.
- **Origin:** self-found · triaging an unmerged branch
  (`fix/0086-nul-bytes-in-published-dist`, 2026-08-08) whose headline fix had
  since landed by another route. Its guard checked two things; the one that
  landed checks one.
- **Reported:** 2026-09-04

## Symptom

`check:integrity` scans `packages/*/src/**` and reports

```
… 264 source files across 6 packages free of raw NUL bytes …
```

It reads each file as a Buffer and looks for `0x00`
(`scripts/check-workspace-integrity.mjs:320`). That is the **loud** half: a NUL
makes `file(1)` say `data` and `grep` say `Binary file … matches` — a visible
refusal a reader can act on.

**Invalid UTF-8 is the quiet half, and nothing checks it.** A single stray
latin-1 byte in a UTF-8 locale makes `grep` exit 1 with _no output and no
warning_. Nothing says the file was skipped.

## Reproduction

Measured 2026-09-04 on `main` at `bc0cfaf`. One byte appended to a real source
file:

```
$ printf '// probe: \xe9 latin-1 byte\n' >> packages/ts/src/smells/clusters.ts

$ file -b packages/ts/src/smells/clusters.ts
Non-ISO extended-ASCII text

$ grep -c "SimilarCluster" packages/ts/src/smells/clusters.ts
                      ← no output at all. The symbol IS declared in that file.

$ npm run check:integrity
Workspace integrity: OK — … 264 source files across 6 packages free of raw NUL
bytes, 10 probe roots free of leftover fixtures.
```

`grep` printed nothing for a symbol the file plainly declares, and the gate that
owns source-text integrity called the workspace clean in the same breath.

## Why it matters

This repo's survey discipline is built on grep seeing every source file. The
`review-proposal` skill's Step 2 is literally _"grep `packages/_/src`, always"*;
every reviewer persona is instructed the same way; and the agent-facing
instructions in `CLAUDE.md` send readers to grep before concluding anything.

The NUL guard exists because that assumption already failed once and cost real
work: `packages/crossvalidate/src/md-gherkin.ts` carried two NUL bytes for
months, produced a **live false negative that went into a filed bug report as
evidence**, and was independently re-derived and filed twice
([0099](./0099-nul-bytes-make-md-gherkin-unsearchable.md) and
[0144](./0144-md-gherkin-nul-bytes-break-grep.md)) by reviewers who each
grepped and each got nothing.

Invalid UTF-8 produces the same false negative **more quietly**: NUL at least
makes `file(1)` say `data` and grep announce a binary file. A latin-1 byte makes
grep say nothing whatsoever.

## Root cause

Not an oversight in the guard's design — a scope decision that was never
revisited. The guard was built while closing 0099, against the incident in hand,
which was a NUL. Its own comment records that the file was _"valid UTF-8, `tsc`
and ts-morph read it fine"_ — the property is named in the source, as a fact
about that incident rather than as a thing to check.

The unmerged branch that motivated this record shipped a `check:source-text.mjs`
covering **both** conditions, and said which one was worse:

> **Invalid UTF-8.** This is the silent one: a stray latin-1 byte in a UTF-8
> locale makes grep exit 1 with _no output and no warning at all_.

That branch never landed. Its NUL half arrived independently via 0099/0144; its
UTF-8 half did not arrive at all.

## Fix

1. Validate UTF-8 in the same loop that already reads the Buffer, reporting the
   byte offset and line so the finding is actionable — the NUL branch's shape.
2. Say so in the summary line, so a reader can tell which properties a green
   covers.
3. A `check:nonvacuity` scenario planting an invalid-UTF-8 probe, asserting the
   gate names the file **and gives the UTF-8 reason** — not merely that it exited
   non-zero, since `check:integrity`'s leftover-probe check reds on any
   `__nonvacuity_probe*` file and would otherwise answer for it. That trap is
   already recorded in the NUL scenario and applies verbatim.
4. Add the probe path to the harness's sweep list, or a killed run leaves an
   invalid-UTF-8 file inside the kernel's `src`.

## Verification

- [x] Red first: with one latin-1 byte appended to
      `packages/ts/src/smells/clusters.ts`, `check:integrity` now fails with
      `is not valid UTF-8 — first bad byte 0xe9 at offset 7156 (line 161)`. Before
      the fix the same file made `grep -c` for a symbol it declares print nothing
      while the gate reported the workspace clean.
- [x] **Deleting the UTF-8 loop reds the non-vacuity scenario — and the way it
      reds is the point.** `check:integrity` still exits 1 and still names the
      probe, because its leftover-probe check reds on any `__nonvacuity_probe*`
      file. The scenario reports
      `named the invalid-UTF-8 probe and never gave the UTF-8 reason`. An
      assertion on exit code and file name alone would have stayed green with the
      guard deleted — the fail-open-inside-the-harness trap bug 0231 recorded and
      the NUL scenario already warns about, hit here on purpose.
- [x] The NUL scenario passes unchanged under that same sabotage: the two are
      independent findings with independent remedies.
- [x] `check:nonvacuity` now reports **70 fixtures**, up from 69, and
      `gate coverage — OK`.
- [x] `npm run validate` green from a run that reached the last step.

## A near-miss worth recording: the scenario the harness never ran

The first version of this fix added the scenario to `bad-waived-gates.mjs` and
stopped there. It passed when invoked by hand — and `check:nonvacuity` still
reported **69** fixtures, exactly as before, because the harness runs an explicit
`gateNode(...)` row per scenario and nothing had registered one.

So the guard had a test, the test passed, and the gate that exists to prove tests
fire could not see it. Two edits closed it: the `GATE_FOR` row, and the
`check:integrity` claim list — and the harness's own coverage check caught the
second (`gate "integrity/source-text-utf8" is in the list but no check:* claims
it`), which is that check earning its place.

This is the same hand-kept-list class as the `PROBE_PATHS` sweep in
`bad-waived-gates.mjs`, which bug 0242's work also had to be reminded about. Two
lists, both hand-kept, both silently tolerant of an omission. Worth its own
record if it happens a third time; noted here rather than filed, because two
instances is a pattern and not yet a mechanism.

## The gate caught me ticking a box before it was true

Worth one paragraph, because it is this record's own subject one level up.

The `npm run validate` box was ticked while writing the Verification section,
before that run had happened. `check:ledger`'s `findFinishedNotClosed` then red:

```
work/bugs/0247-…md:5  ledger/finished-not-closed
  every one of this record's 5 ledger box(es) is ticked and none is open,
  but State is "Draft" — so the board counts finished work as outstanding.
```

It is the same rule that stayed quiet on
[0238](./0238-the-kernels-reason-free-waiver-promotion-is-untested.md) an hour
earlier, and correctly so — that record had one genuinely open box. Here every
box was ticked, so the rule had something to say and said it.

The fix was to close the record in this PR rather than to un-tick the box: the
work IS done, and a same-PR close is what this project requires. But the tick
preceded the evidence, which is exactly the habit the box exists to prevent.

## What became of the branch this came from

`fix/0086-nul-bytes-in-published-dist` (2026-08-08, never pushed, no PR) was
triaged file by file rather than cherry-picked or deleted on sight. Its "bug
0086" is not this repo's bug 0086 — that number belongs to
[links to directories do not resolve](./0086-links-to-directories-do-not-resolve.md),
fixed long ago. The collision is a renumbering artifact and cost a few minutes of
confusion, which is the argument for citing records by path and not by number
alone.

Every one of its four contributions is accounted for:

| the branch shipped                                                       | disposition                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| raw NUL bytes removed from two sources                                   | **landed independently** via [0099](./0099-nul-bytes-make-md-gherkin-unsearchable.md) / [0144](./0144-md-gherkin-nul-bytes-break-grep.md); measured 0 NUL bytes in both files on `main`                                           |
| a NUL guard                                                              | **landed**, inside `check:integrity` rather than as a separate script                                                                                                                                                             |
| **a UTF-8 validity guard**                                               | **never landed — this record**                                                                                                                                                                                                    |
| `module-dependencies.ts`, so `export … from` counts as a dependency edge | **superseded by something better**: `packages/ts/src/core/module-edges.ts` uses `getImportStringLiterals()`, covering re-exports, dynamic imports and `import x = require` across 20 measured forms, citing the same upstream bug |
| `bad-links.mjs` non-vacuity fixture                                      | **superseded**: `corpus/broken-links` has two rows in the harness today                                                                                                                                                           |

So the branch carries nothing further that is owed, and can be deleted. Recorded
here rather than left as tribal knowledge, because the next person to find an
unpushed month-old branch deserves the answer without redoing the triage.

**The general lesson is the one that cost real time:** its most valuable content
was not its headline fix — that had already arrived by another route — but a
_second_ guard mentioned in passing in its commit message. A branch triaged by
its title would have been deleted with that still unlanded.

## Related

- [0099](./0099-nul-bytes-make-md-gherkin-unsearchable.md) — the incident
  the existing guard was built for, and whose guard box it closed.
- [0144](./0144-md-gherkin-nul-bytes-break-grep.md) — the same defect filed
  a second time, two days later, by a reviewer who never knew of the first. Its
  own lesson is that _"two correct write-ups are not a mechanism"_ — which is why
  this record ships a guard rather than a description.
