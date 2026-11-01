# Bug 0597: the accepted-denominator fixture assumes one accepted proposal

## Status

- **State:** Fixed — the fixture demotes every live accepted proposal, read the way the gate reads
  them, and requires that none is left accepted (PR #293).
- **Severity:** Medium — it failed loud, not open: CI went red on a correct corpus. But a
  non-vacuity row whose violating input depends on a fact about the live corpus breaks whenever
  that fact changes, and blocks unrelated records work.
- **Origin:** self-found · CI on PR #292, 2026-11-01; judged by an enforcement review the same day.
- **Reported:** 2026-11-01

## Symptom

PR #292 recorded four proposals as `Ship with changes`. Its CI failed:
`fixture "corpus/accepted-denominator-empty" did not fire on its violating input`.

## Root cause

The fixture proves that `corpus/accepted-proposal-denominator-empty` fires when the lane has
reviewed proposals and none is accepted. It built that state by demoting one named proposal, 005,
from `Ship as-is` to `Docs-only`, because 005 was the lane's only accepted proposal when it was
written; the gate's own comment in `scripts/check-corpus.mjs` said the same. With five accepted
proposals, demoting 005 left four, and the gate rightly stayed quiet. The gate was correct; the
fixture's input no longer violated.

## Fix

`gateCorpusAcceptedDenominatorEmpty` (`scripts/check-nonvacuity.mjs`) selects the accepted
proposals with the gate's own reader, `isAccepted(operativeRuling(text))`, and demotes each one's
operative Ruling line, inside nested `withRewrittenFile` calls so every file is restored on any
exit. The line is the last `**Ruling: …**` line in `proseText`'s reading (the one fence reader,
which keeps every line in place), not `operativeRulingLine`'s, which names the blank line above a
ruling ([bug 0326](../0326-a-ruling-finding-names-the-blank-line-above-the-ruling.md)). The row requires that it demoted
at least one proposal, that none is left accepted, and the gate's finding. The stale comment in
`scripts/check-corpus.mjs` no longer states a count.

## Verification

- [x] On `main` (one accepted proposal): the row passes, "demoted 1 accepted proposal(s), 0 left
      accepted".
- [x] With the gate's guard removed from `scripts/check-corpus.mjs`: the row fails.
- [x] On PR #292's tree (five accepted proposals): the row passes, "demoted 5 accepted
      proposal(s), 0 left accepted". The three runs took 16–17 s each.
- [x] A mismatch between the gate's reader and the raw file fails closed. Two earlier versions were
      refused before anything was written: one found the line by `operativeRulingLine`'s number
      ([bug 0326](../0326-a-ruling-finding-names-the-blank-line-above-the-ruling.md)'s off-by-one), and the row refused to rewrite the wrong line; the next scanned
      fences with a regex of its own, and `scripts/lib/one-fence-reader.test.mjs` refused it,
      since `proseText` is the one fence reader.
- [x] The script still loads in CI's merge job, which runs it with Node builtins only and no
      `npm ci`. The first push imported the ruling reader and `proseText` at the top of
      `scripts/check-nonvacuity.mjs`, and that job failed with `ERR_MODULE_NOT_FOUND` for
      `@nielspeter/eess-md`. They are now loaded inside the row, when it runs. Measured: a copy of
      `scripts/` with no `node_modules` loads the new version and reproduces CI's error with the
      pushed one.
- [x] `npm run validate` green.

Deferred: none
