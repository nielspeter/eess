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
(`scripts/check-workspace-integrity.mjs:425`). That is the **loud** half: a NUL
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

## A near-miss, and the mechanism that now prevents it

The first version of this fix added the scenario to `bad-waived-gates.mjs` and
stopped there. It passed when invoked by hand — and `check:nonvacuity` still
reported **69** fixtures, exactly as before, because the harness runs an explicit
`gateNode(...)` row per scenario and nothing had registered one.

So the guard had a test, the test passed, and the gate that exists to prove tests
fire could not see it.

**This record originally stopped at "two instances is a pattern and not yet a
mechanism" and declined to build one.** Both reviews rejected that, from the same
observation: the mechanism already existed one screen away. `gateCoverage()`
catches a gate row no `check:*` claims, and `check-nonvacuity.mjs` already reads
`check-corpus.mjs`'s SOURCE to assert every rule id it can emit has a fixture. The
same technique over `SCENARIOS\['…'\]` closes the inverse.

It is built. Sabotage-verified in both directions:

| sabotage                                          | result                                                                                                                  |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| a scenario declared with no `gates` row           | `declares scenario "integrity/unregistered-probe" but no gate row runs it`                                              |
| the scan pattern drifts so the check sees nothing | `declares no SCENARIOS this check could see — the pattern it scans for has drifted, so this check is asserting nothing` |

The second row is the ADR-010 half: a check that can silently examine zero things
is the defect, not just a check that misses one thing.

`PROBE_PATHS` remains hand-kept and unguarded. Named here rather than fixed,
because it is a different list with a different failure mode, and this change is
already large.

## The unit test, and the one I wrote wrong first

Testing review's matrix was the sharpest artifact of the round: eight sabotages
of the validator, **six of which left the scenario green**. Its argument for a
unit test was that this is the first hand-rolled _algorithm_ under `scripts/` —
the other checks are structural sweeps whose behaviour is only observable end to
end, while this one is a pure function of bytes whose end-to-end probe reaches
one of six branches.

`firstInvalidUtf8` and `invalidUtf8At` moved to `scripts/lib/source-text.mjs`
with `scripts/lib/source-text.test.mjs` beside them, run by `node --test` from
`check:integrity` — the convention `scripts/lib/family-re-exports.test.mjs` set
and `check:family` already wires.

**The first version of that test caught three of the eight rows and looked like
it caught all eight.** Its class assertions went through `invalidUtf8At`, which
delegates the verdict to `TextDecoder` and is therefore right _whatever the
scanner does_ — so accepting an `F0` overlong, accepting past `U+10FFFF`, and
never reporting truncation all stayed green against a test written to catch
exactly them. Caught by running the matrix instead of assuming it, which is the
only reason it did not ship.

Fixed by asserting the scanner directly as well as the verdict. The whole matrix
now:

| sabotage of the validator             | caught by                       |
| ------------------------------------- | ------------------------------- |
| scanner always returns `-1`           | unit test                       |
| accept surrogates (`ED` clamp)        | unit test                       |
| accept `E0` overlongs                 | unit test                       |
| accept `F0` overlongs                 | unit test                       |
| accept beyond `U+10FFFF` (`F4` clamp) | unit test                       |
| skip unknown lead bytes               | unit test                       |
| never report truncation               | unit test                       |
| drop the `0xC2` floor                 | unit test                       |
| delete the UTF-8 finding entirely     | non-vacuity scenario            |
| suppress the NUL finding              | the NUL scenario, independently |

And the delegation means none of the first eight can let a bad file through any
more — re-running review's own sabotage, the gate still rejects an overlong, a
surrogate and an out-of-range lead. They are caught because a wrong offset is
still a wrong finding, not because the verdict depends on them.

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

## What review found — the guard was right, the reasoning around it was not

Three reviewers ran against the committed fix. **None found a defect in the
validator.** Two differential-tested it independently against
`TextDecoder('utf-8', { fatal: true })` — 8.1M and 16.7M+ inputs, covering
overlong forms, surrogates, `0xF5`–`0xFF`, stray continuations and
truncation-at-EOF — with **zero disagreements**, matching a third run of 1.4M
done here. What they found instead was a set of claims that outran their
mechanism, which is the more useful finding.

**The correctness nobody could check.** The validator was right; nothing in the
repo knew it. The shipped probe exercised one byte pattern out of the five the
code's own comment claimed to reject. Enforcement measured the consequence:
replace the lead-byte table with the naive form — dropping the `0xC2` floor and
the overlong, surrogate and range clamps — and the scenario stayed **green**
while the guard accepted `C0 AF`, `E0 80 80`, `ED A0 80` and `F5 80 80 80`. A
table simplification made in good faith would have reopened the bug with every
gate green.

The fix is architecture review's, and it removes the risk class rather than
patching it: **`TextDecoder` decides validity; the hand-rolled walk only
locates.** Re-running the exact sabotage now, the gate still rejects both an
overlong and a surrogate file. A bug in the walk can misreport a line number; it
can no longer decide whether a file is text. The three payloads are in the
scenario anyway, because the classes are what the finding names.

**A claim about `rg` that was false.** The finding said _"grep and rg skip a file
like this"_. Enforcement measured ripgrep 14.1.1: it does **not** skip a file for
invalid UTF-8 — its binary detection is NUL-based, and it decodes lossily and
searches. A reader who checked with `rg` would have seen the file searched fine
and concluded the gate was crying wolf. The message now says `grep`, and says
explicitly that `rg` finding it is not evidence the file is fine.

**A rationale for a mechanism that could not exist.** The two scan loops were
justified by _"a reader given both findings for one byte would fix the wrong
one"_. A raw NUL is **valid UTF-8** — `U+0000` encodes as `0x00` — so no single
byte can produce both findings, and no suppression existed anyway. Architecture
review caught it; the loops are merged, one read per file, and the early
`continue` that made the split look necessary is gone. This record's own Fix
section had said "in the same loop", which is not what shipped — that is now
true.

**A scope rationale that measurement contradicts.** The scan excludes everything
outside `packages/*/src`, on the written reason that the non-vacuity fixtures
carry corrupt payloads. Enforcement scanned the whole repo: **zero files carry
either defect, fixtures included** — they plant through `Buffer.from(...)` into
`packages/core/src` precisely so they stay greppable. The comment is corrected,
and the uncovered population (1,239 text files) is filed as
[0248](../0248-the-source-text-guard-covers-a-sixth-of-the-repo.md) rather than
widened here, because widening is a decision with consequences.

**And this record's own code pointer went stale in the commit that wrote it.** It
cited `check-workspace-integrity.mjs:320` for the NUL scan; the fix moved that
line. `check:corpus` reported green because the pointer rule asserts the line
EXISTS, not what it says — a record about a gate that reports green over a
property it does not check, shipping a pointer that a gate reports green over
without checking. Corrected to `:425`; the structural gap is real and belongs to
whoever picks up the pointer rule.

## Related

- [0099](./0099-nul-bytes-make-md-gherkin-unsearchable.md) — the incident
  the existing guard was built for, and whose guard box it closed.
- [0144](./0144-md-gherkin-nul-bytes-break-grep.md) — the same defect filed
  a second time, two days later, by a reviewer who never knew of the first. Its
  own lesson is that _"two correct write-ups are not a mechanism"_ — which is why
  this record ships a guard rather than a description.
