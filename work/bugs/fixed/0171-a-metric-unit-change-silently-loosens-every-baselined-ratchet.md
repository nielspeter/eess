# Bug 0171: a metric unit change silently loosens every baselined ratchet

## Status

- **State:** Fixed — closed 2026-08-24. The fix shipped on 2026-08-19; the record did not. the baseline records and compares what a number COUNTS — `measuredUnit`, `MEANING_NEVER_CHANGED` and `staleMeasurementFinding` are in `packages/core/src/violation.ts` and `baseline.ts`, and the six verification boxes are ticked against named tests.

  Found by `ledger/finished-not-closed`, a check written the same day precisely because `honestyAtClose` proves a DONE item hides no open box and nothing proved the reverse — so a finished record could sit open indefinitely with `check:ledger` green over it. This is the first thing that check caught.

- **Found:** 2026-08-19, in review of the `linesOfCode` change
  ([bug 0170](./0170-linesofcode-counts-comments-so-documentation-reads-as-size.md)).

## Symptom

An accepted ceiling is a number **in a unit**, and the baseline compared across a
change of unit without noticing.

Bug 0170 changed `linesOfCode` from counting a span to counting code — measured
on this repo, `TerminalBuilder` went from 1218 to 372. The identity hash is
`file::element::metric` and none of those moved, so every baselined entry kept
matching and kept suppressing — now against a ceiling denominated in something
the tool no longer produces.

The consequence for anyone holding a baseline: that class may grow to **1218
code lines**, roughly three times its real size, with a green build the whole
way. It applies to every baselined finding from `maxClassLines`,
`maxMethodLines` and `maxFunctionLines`.

Nothing signalled it:

- `HASH_VERSION` correctly stays 5 — its own documented rule is "bump only when
  `hashViolation` changes", and identity genuinely did not change.
- `unmatchedBaselineFinding` structurally cannot fire: it is gated on
  `matched === 0`, and these entries **match**.
- The baseline format had a version slot for _identity_ and no slot at all for
  the _meaning_ of `measured`.

## Root cause

`packages/ts/src/helpers/baseline.ts` (and the kernel's copy at
`packages/core/src/baseline.ts`) stored `measured` as a bare number:

```ts
const accepted = this.acceptedMeasurements.get(hash)
if (violation.measured === undefined || accepted === undefined) return true
return violation.measured <= accepted
```

`372 <= 1218` is true, and meaningless. That arithmetic is the bug.

## Fix

Record what the number **counts**, and refuse to compare across a change.

- `ArchViolation.measuredUnit` — stamped by `metricViolation`, defaulting to the
  metric's own name, because for `methods` or `parameters` the name _is_ the
  unit. Only a metric that can change what it counts under a stable name needs
  to say so, and the line rules now declare `unit: 'code-lines'`.
- The baseline persists it and compares it. Incomparable means **not known**, so
  the finding is reported rather than silently re-accepted — failing closed,
  because assuming two numbers agree is not evidence that they do (ADR-010).
- `MEANING_NEVER_CHANGED` keeps old baselines working where they are still
  valid: an unstamped `complexity` entry counts what it always counted, so
  failing it would be a false regression. `code-lines` is deliberately absent
  from that set, and that absence is the whole fix.
- A `staleMeasurementFinding` meta-finding supplies the cause and the remedy.
  Without it the upgrade reports untouched code as new violations with nothing
  connecting that to the release note — the ADR-009 rule 2 failure this exists
  to prevent. It is `bypassFilters`, because a baseline must not be able to
  suppress the finding that says the baseline cannot be trusted.

Both copies are fixed. No dialect on the kernel emits `measured` today, so the
kernel half is latent — but the two files must not disagree about what a
baseline entry means, and the last review caught exactly that shape of half-fix.

## Verification

- [x] Red first: an unstamped entry accepting 1218 against a current
      `code-lines` measurement of 372 no longer suppresses —
      `baseline.test.ts` · `it('stops suppressing when the stored measurement predates unit stamping')`.
- [x] The finding says why, names the element with both numbers, carries a
      remedy, and is unsuppressable —
      `it('says WHY, so it does not read as fresh rot in the code')`.
- [x] An unstamped `complexity` entry still compares, so upgrading does not
      red every unchanged metric —
      `it('still compares a metric whose meaning never changed')`.
- [x] The ratchet still ratchets once both sides carry a unit: an improvement
      stays green and a regression past the ceiling still fails —
      `it('ratchets normally once both sides carry the same unit')`.
- [x] Sabotage: forcing `measurementComparable` to `true` (the pre-fix
      behaviour) reddens exactly the first two, and leaves the two guards green.
- [x] `npm run validate` — no new failures.

## Out of scope

The thresholds themselves. `maxClassLines(300)` now admits roughly three times
the code it used to, and re-deriving the repo's own numbers is a separate
judgement — noted in bug 0170.
