# Bug 0232: a non-vacuity fixture blames the gate when the baseline is dirty

## Status

- **State:** Draft — reproduced; the correct pattern already exists six times in
  the same file, so the fix is to follow it.
- **Severity:** Medium — no false green: the fixture reds, which is safe. The
  cost is that it reds with the **wrong diagnosis**. `check:nonvacuity` reports
  `did not fail on violating input` — "this gate is vacuous" — when the truth is
  "an unrelated file in the corpus has a stale pointer". An operator who
  believes it goes looking for a hole in a gate that is working.
- **Origin:** self-found · running `npm run validate` with three untracked
  proposals present; the chain stopped at `check:corpus`, and
  `check:nonvacuity` then blamed the discrimination fixture.
- **Reported:** 2026-09-03

## Symptom

```
nonvacuity: corpus/proposal-implements-discriminates — FAILED (did not fail on
violating input) · discriminates cited-in-prose from declared ·
prose-only exit 1 (want 1), declared exit 1 (want 0)
```

Read plainly, that says the gate cannot tell a prose mention of a proposal from
a declared `**Implements:**` line — a real and serious defect, and the exact
thing [bug 0141](./fixed/0141-no-check-binds-accepted-proposals-to-plans.md)
built this fixture to prevent.

It is not what happened. The gate discriminates correctly. What was true is that
three untracked proposal files elsewhere in `work/proposals/` carried stale
`path:line` pointers, so `check:corpus` exits 1 no matter what the probe does.

Measured: with those three files set aside, `check:corpus` is `1268 checks
across 152 documents, 0 violations` and the fixture passes.

## Root cause

`gateCorpusProposalImplementsDiscriminates` (`scripts/check-nonvacuity.mjs:1075`)
proves the discrimination by running the whole gate twice and comparing exit
codes:

```js
const proseRun = sh(process.execPath, [join('scripts', 'check-corpus.mjs')])
const proseStillRed = proseRun.code === 1

writeFileSync(PROBE_CORPUS_PLAN_IMPLEMENTS, declaredPlanMd)
const matchedRun = sh(process.execPath, [join('scripts', 'check-corpus.mjs')])
const matchedGoesGreen = matchedRun.code === 0 // ← the defect

const ok = proseStillRed && matchedGoesGreen
```

`matchedGoesGreen` is a claim about **the entire corpus**, not about the probe.
Any pre-existing violation anywhere — a stale pointer, a missing board row, a
half-written proposal — makes it false, and the fixture then reports the gate as
vacuous.

The `proseStillRed` half has the mirror-image weakness: it would be satisfied by
any unrelated violation, so on a dirty baseline the fixture can only ever fail,
and on a dirty-in-the-right-way baseline it could pass without the rule firing
at all.

## The pattern it should have followed already exists

This is not a new technique to invent. Of the eight `.code === 0` sites in
`check-nonvacuity.mjs`, **six** deliberately keep the clean-baseline arm out of
the verdict — it is informational, in the `detail` string only:

```js
// scripts/check-nonvacuity.mjs:486
const ok = bad.code === 1 && firedOn(bad, 'eess/adr002-no-raw-typescript', '__nonvacuity_probe__')
// Clean direction is a bonus proof that the gate is not always-red (informational).
const clean = sh(EESS_TS, ['check', 'arch.rules.ts'])
const cleanNote = clean.code === 0 ? 'clean → green' : `clean → exit ${clean.code} (in-flight)`
```

Their own comments say why, in as many words: _"Exit 1 alone is weak here
(in-flight violations exist), so require the rule to have fired ON THE PROBE"_ —
which is [bug 0110](./fixed/0110-nonvacuity-gates-do-not-assert-which-rule-fired.md)'s
lesson. `gateBoardRewrite` and `gateProposalProbe`, two helpers in the same file
and used by most of the corpus rows, both use `firedOn(...)` for exactly this.

One fixture makes a global-baseline assertion load-bearing, in a file where its
siblings are documented not to.

## Fix

Assert the probe's own identity in both directions, not the global exit code.
The property under test is per-finding and already expressible with `firedOn`:

- **prose-only** — the `accepted-proposal-uncited` finding for proposal 9001
  **is** present.
- **declared** — that same finding for proposal 9001 **is not** present.

Neither statement mentions the rest of the corpus, so both survive a dirty
baseline; and the second is strictly stronger than `exit === 0`, because today a
green exit could come from the probe never having been read at all.

The `--format json` run that `gateBoardRewrite` uses is what makes the negative
half checkable — the current fixture only runs the terminal format.

## Break class

A fix must fail when:

1. The gate stops discriminating — a plan citing a proposal in prose is accepted
   as declaring it. (Mutate the `**Implements:**` parser to a loose prose regex;
   the fixture's own comment names `/[Ii]mplements[^\n]*?proposal\s+(\d+)/` as
   the demonstrated vulnerability, and the probe text is written to trip it.)
2. And it must NOT fail merely because some unrelated document in the corpus has
   a violation. Planting a stale pointer in an unrelated file must leave this
   fixture green.

(2) is what does not hold today, and it is the whole record.

## Verification

- [ ] Red test: a stale pointer planted in an unrelated corpus file leaves this
      fixture green. Fails today.
- [ ] The discrimination itself still reds when the parser is loosened to the
      prose regex named above.
- [ ] The fixture asserts `firedOn(...)` in both directions rather than a global
      exit code.
- [ ] `check:nonvacuity` green on a corpus with an unrelated violation present.

## Related

- [0110](./fixed/0110-nonvacuity-gates-do-not-assert-which-rule-fired.md) — the
  same lesson one level down: assert which rule fired, not that something did.
  This record is that lesson applied to the _clean_ direction rather than the
  dirty one.
- [0231](./fixed/0231-a-killed-nonvacuity-run-leaves-an-invisible-probe-that-reds-other-gates.md)
  — the same failure class in a different instrument: a finding that names a
  cause it has not established, sending the reader to the wrong fix.
- [0126](./0126-validate-cannot-say-it-stopped-short.md) — how this one was
  reached: `validate` stopped at `check:corpus`, and the steps behind it had to
  be run by hand.
