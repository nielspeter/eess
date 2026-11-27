# Bug 0548: `check-corpus.mjs` exits on a second list

## Status

- **State:** Fixed — both exits read one verdict, and the corpus rows run the json path once.
  Found 2026-10-25 by the architect's and the enforcement review of
  [spike 0546](../../spikes/0546-where-a-corpus-check-spends-its-time.md); fixed 2026-11-27.
- **Severity:** Medium — no rule is known to escape today; every receipt member is also in the
  terminal path's list, checked by hand. **A rule added to one list and not the other exits 1 under
  `--format json` and 0 on the command CI runs.**
- **Origin:** self-found, 2026-10-25. Recorded rather than fixed in
  [bug 0547](./0547-eess-md-parses-a-text-more-than-once-per-process.md): it is a different defect.
- **Reported:** 2026-10-25

## Symptom

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
- `scripts/check-nonvacuity.mjs`: the 14 places that ran the terminal path only for its exit code
  run the json path alone, so 30 runs of `check-corpus.mjs` per full `check:nonvacuity` run are
  gone (`gateCorpusProbe`'s 9 rows, `gateCorpusProbeDir`'s 2, `gateBoardRewrite`'s 4,
  `gateProposalProbe`'s 4, `gateCorpusFragment`'s 2 and 9 single rows).
  - `gateCorpusProbeDir` read the probe's message off the terminal run, so a probe that reds
    another rule could not borrow its exit; it now reads it off the rule's own json finding, which
    is stricter.
  - Three rows keep a terminal run, for what only the terminal prints:
    `corpus/links/fragment-reach` (the "not judged" count), the one-dead-check row (the emitter's
    finding beside healthy counts) and the inert-exclusion row (the diagnostic).
  - A new row, `corpus/terminal-exit`, runs the command CI runs over one broken link and asserts
    exit 1, the finding listed and the red summary: the one row per production script that proves
    the terminal exit statement.
- The same two-list exit in `scripts/check-ledger.mjs` is recorded, not fixed:
  [bug 0661](../0661-check-ledger-exits-on-a-second-list.md).

## Verification

- [x] Red first, on the code before the fix: a copy of `check-corpus.mjs` with `broken` left out of
      `problems`, one broken link planted in `docs/`: json exit 1; terminal exit 0, printing
      `✗ 1 broken` above `✓ corpus integrity — 34595 checks across 410 documents, 0 violations`.
- [x] Both exits read one receipt. After the fix, the same probe: json exit 1, terminal exit 1 with
      the finding listed; a clean tree exits 0; a malformed ADR exits 1 with its finding printed once,
      under the ADR heading.
- [x] One terminal row per production script: `corpus/terminal-exit`. On a scratch copy of the gate
      with `if (failed) process.exit(1)` deleted, its probe exits 0, which reds the row; on the fixed
      gate it exits 1 with the finding listed and the red summary.
- [x] The corpus rows' second run removed: 30 runs per full run.
- [x] Shard time before, from [PR #342](https://github.com/nielspeter/eess/pull/342)'s last CI run
      (44520402832): 13m59s, 10m52s, 14m14s, 10m46s. After: this PR's CI run, recorded in the PR.
