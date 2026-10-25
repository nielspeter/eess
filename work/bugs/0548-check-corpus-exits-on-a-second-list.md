# Bug 0548: `check-corpus.mjs` exits on a second list

## Status

- **State:** Draft — found 2026-10-25 by the architect's and the enforcement review of
  [spike 0546](../spikes/0546-where-a-corpus-check-spends-its-time.md); no red test yet.
- **Severity:** Medium — no rule is known to escape today; every receipt member is also in the
  terminal path's list, checked by hand. **A rule added to one list and not the other exits 1 under
  `--format json` and 0 on the command CI runs.**
- **Origin:** self-found, 2026-10-25. Recorded rather than fixed in
  [bug 0547](./fixed/0547-eess-md-parses-a-text-more-than-once-per-process.md): it is a different defect.
- **Reported:** 2026-10-25

## Symptom

`scripts/check-corpus.mjs` decides its exit twice. With `--format json` it exits on the receipt it
builds for the emitter (`scripts/check-corpus.mjs:1266`). Without it, the command CI runs, it
exits on `failed` (`scripts/check-corpus.mjs:1444`), computed at `scripts/check-corpus.mjs:1425`
from a hand-kept `problems` array, the ADR check's error and the emitter's own findings. The two
lists are kept equal by hand.

Only `check:nonvacuity`'s second, terminal run per corpus row proves each rule reaches the exit CI
judges ([bug 0127](./fixed/0127-nonvacuity-proves-a-condition-not-a-wired-rule.md)), which is why
every such row starts the script twice. And `gateCorpusProbe` (`scripts/check-nonvacuity.mjs:1842`)
asserts only the terminal run's exit code, not which rule it names, so a probe that reds a second
rule borrows that rule's exit.

## Fix

Derive the terminal exit from the same receipt the JSON exit reads, and delete `problems` or derive
it from the receipt. Then one row per production script proves a non-empty receipt exits 1, and the
corpus rows can run once, with JSON, halving their cost
([spike 0546](../spikes/0546-where-a-corpus-check-spends-its-time.md) §1).

## Verification

- [ ] A red test: a receipt member left out of the terminal list exits 0 on the terminal path today.
- [ ] Both exits read one receipt.
- [ ] One terminal row per production script; the corpus rows' second run removed, and the shard
      time measured before and after.
