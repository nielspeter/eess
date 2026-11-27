# Bug 0548: `check-corpus.mjs` exits on a second list

## Status

- **State:** Fixed — both exits read one verdict, the corpus rows run the json path once, and the ADR
  check has a production row.
  Found 2026-10-25 by the architect's and the enforcement review of
  [spike 0546](../../spikes/0546-where-a-corpus-check-spends-its-time.md); fixed 2026-11-27.
- **Severity:** Medium — no rule is known to escape today; every receipt member is also in the
  terminal path's list, checked by hand. **A rule added to one list and not the other exits 1 under
  `--format json` and 0 on the command CI runs.**
- **Origin:** self-found, 2026-10-25. Recorded rather than fixed in
  [bug 0547](./0547-eess-md-parses-a-text-more-than-once-per-process.md): it is a different defect.
- **Reported:** 2026-10-25

## Symptom

As of 2026-10-25 (the line pointers in this section are that day's):
`scripts/check-corpus.mjs` decides its exit twice. With `--format json` it exits on the receipt it
builds for the emitter (`scripts/check-corpus.mjs:1266`). Without it, the command CI runs, it
exits on `failed` (`scripts/check-corpus.mjs:1444`), computed at `scripts/check-corpus.mjs:1425`
from a hand-kept `problems` array, the ADR check's error and the emitter's own findings. The two
lists are kept equal by hand.

Only `check:nonvacuity`'s second, terminal run per corpus row proves each rule reaches the exit CI
judges ([bug 0127](./0127-nonvacuity-proves-a-condition-not-a-wired-rule.md)), which is why
every such row starts the script twice. And `gateCorpusProbe` (`scripts/check-nonvacuity.mjs:1842`)
asserts only the terminal run's exit code, not which rule it names, so a probe that reds a second
rule borrows that rule's exit.

## Fix

Derive the terminal exit from the same receipt the JSON exit reads, and delete `problems` or derive
it from the receipt. Then one row per production script proves a non-empty receipt exits 1, and the
corpus rows can run once, with JSON, halving their cost
([spike 0546](../../spikes/0546-where-a-corpus-check-spends-its-time.md) §1).

## What was done

- `scripts/check-corpus.mjs` computes one `verdict` (`finishPreset` over the receipt) before the
  format branch. The json path emits it and exits on it; the terminal path lists it (every finding
  but the ADR check's, printed under its own heading, and the emitter's) and exits on it. The
  hand-kept `problems` array is gone: what the terminal lists is derived from the verdict.
- `scripts/check-nonvacuity.mjs`: every terminal run that asserted only an exit code is gone, 46
  runs of `check-corpus.mjs` per full `check:nonvacuity` run from 19 sites, found under the three
  spellings the harness uses for the no-flags run (the literal path, the `CORPUS_TERM` constant and
  `runCorpusScript([])`):
  - 30 runs from 14 sites: `gateCorpusProbe`'s 9 rows, `gateCorpusProbeDir`'s 2, `gateBoardRewrite`'s
    4, `gateProposalProbe`'s 4, `gateCorpusFragment`'s 2, and 9 single rows;
  - 7 runs from 4 sites: `corpusSabotage`'s 4 rows and the three `**Extends:**` rows (found by the
    method review; the first commit missed them, since they spell the run `CORPUS_TERM`);
  - 9 runs from 1 site: `mentionRedThenGreen`'s green-direction terminal run, in the 9 rows that
    write a remedy in, which asserted exit 0 only.

  Every terminal run left asserts text only the terminal prints: the record-mention rows (each
  finding's message and remedy as printed), the fragment-reach row (the "not judged" count), the
  one-dead-check row (the emitter's finding beside healthy counts), the inert-exclusion row (the
  diagnostic), and the skipped, title, committed and left-out rows. `gateCorpusProbeDir` read the
  probe's message off the terminal run, so a probe that reds another rule could not borrow its exit;
  it now reads it off the rule's own json finding, which is stricter.

- Two new rows, appended so no other row changes shard:
  - `corpus/terminal-exit` runs the command CI runs over one broken link and asserts exit 1, the
    finding listed and the red summary: the row that exists for the terminal exit statement (the
    terminal-text rows red too if it is deleted).
  - `corpus/adr-production`, from the enforcement review: the ADR check through the production
    script. Before it, the only ADR row ran a fixture, so deleting the receipt member that adds the
    ADR findings left both exits green, measured by the review. It renames [ADR-001](../../../adr/001-toolchain-node-vitest-eslint-prettier.md)'s `## Enforcement`
    heading and asserts `adr/enforcement-declared` on that file in the json run and exit 1 under the
    ADR heading on the terminal run. The ADR findings are the ones the terminal's violation list
    leaves out, so this row also reds a terminal exit computed from that list again, which
    `corpus/terminal-exit` does not (also measured by the review). It also asserts that every finding in its json run
    is an `adr/*` one: a finding the terminal lists, such as a broken link to the renamed heading's
    anchor, would keep a list-computed exit at 1 and the row green (the review's re-check; no such
    link exists today).
- The terminal's ADR heading and its summary line read the verdict's ADR findings, not the raw
  `adrViolations`, so the display cannot print an ADR finding the exit does not count. The summary's
  count is the verdict's length, so each ADR finding counts once (it counted as 1 for all before),
  and the list prints in receipt order.
- The same two-list exit in `scripts/check-ledger.mjs` is recorded, not fixed:
  [bug 0661](../0661-check-ledger-exits-on-a-second-list.md).

## Verification

The boxes as filed on 2026-10-25 were: a red test; both exits read one receipt; one terminal row per
production script, the corpus rows' second run removed, and the shard time measured before and after.
They are kept below, each answered by what was measured.

- [x] Red first, on the code before the fix: a copy of `check-corpus.mjs` with `broken` left out of
      `problems`, one broken link planted in `docs/`: json exit 1; terminal exit 0, printing
      `✗ 1 broken` above `✓ corpus integrity — 34595 checks across 410 documents, 0 violations`.
- [x] Both exits read one receipt. After the fix, the same probe: json exit 1, terminal exit 1 with
      the finding listed; a clean tree exits 0; a malformed ADR exits 1 with its finding printed once,
      under the ADR heading.
- [x] One terminal row per production script: `corpus/terminal-exit`. On a scratch copy of the gate
      with `if (failed) process.exit(1)` deleted, its probe exits 0, which reds the row; on the fixed
      gate it exits 1 with the finding listed and the red summary.
- [x] The corpus rows' second run removed: 46 runs per full run, from 19 sites, against 3 the new
      rows add.
- [x] `corpus/adr-production` on scratch copies of the gate, [ADR-001](../../../adr/001-toolchain-node-vitest-eslint-prettier.md)'s heading renamed: the fixed
      gate passes it (json 1 and the finding on [ADR-001](../../../adr/001-toolchain-node-vitest-eslint-prettier.md), terminal 1 under the ADR heading); with the
      ADR receipt member deleted both exits are 0, which reds it; with the terminal exiting on its
      violation list again, the terminal exits 0, which reds it.
- [x] Shard time before and after, as CI job durations (setup and install included), one run each: - before, [PR #342](https://github.com/nielspeter/eess/pull/342)'s last run (44520402832), whose
      tree is this PR's parent: 13m59s, 10m52s, 14m14s, 10m46s; - after the first 30 runs' removal, this PR's first run (45966439726): 13m26s, 11m44s, 9m07s,
      11m13s. In all 45.5 minutes against 49.9, about 4.4 less; shard by shard it is mixed, which
      is runner variance. The other 16 runs, removed after the review, and the 3 runs the two new
      rows add (net 43 fewer in all) are measured by the final commit's own CI run, not here.

      One run on each side is not a trend against the 1.6x runner variance
      [bug 0552](../0552-nonvacuity-shard-3-runs-near-its-timeout.md) measured; that bug's own
      five-run criterion stays its own.
