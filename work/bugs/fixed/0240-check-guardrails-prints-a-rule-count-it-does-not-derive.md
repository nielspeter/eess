# Bug 0240: `check:guardrails` prints a rule count it does not derive, and three of its four rules have no fixture

## Status

- **State:** Fixed — the denominator is derived, all four rules have fixtures,
  and each was sabotage-verified. `Deferred: none`.
- **Severity:** High — the gate this repo added to dogfood the preset written
  for AI coding agents cannot be shown to fire for three of the four rules it
  runs, and its green line states a denominator that is a literal. CLAUDE.md's
  own contract for these summaries is that a fast green is _provably_
  non-vacuous; this one is provably nothing.
- **Origin:** self-found · enforcement review of the guardrails arc after it
  merged (PR #91, 2026-09-03). The arc shipped without a panel because an API
  outage killed every reviewer spawn.
- **Reported:** 2026-09-03

## Symptom

**The denominator is hard-coded, and it is wrong.**
`scripts/check-guardrails.mjs:110`:

```js
;`  ✓ guardrails (agentGuardrails) — 5 rules across ${String(filesScanned)} source files · …`
```

The call passes four flags — `noGenericErrors`, `noStubs`, `noEmptyBodies`,
`noCopyPaste` — and not `noInlineLogic`, so **four** rules are constructed. The
line says five. Delete a flag and it still says five. The number a reader uses to
tell a real run from a no-op is the one number in that line that no run produced.

**Three of the four rules have no non-vacuity fixture.**
`scripts/check-nonvacuity.mjs:1605`:

```js
'check:guardrails': ['guardrails/generic-error'],
```

One row for a four-rule gate. The doctrine written directly above `GATE_FOR`
says a single row over-claims, and `check:integrity` was split into four rows for
exactly this reason during this same branch. `no-stubs`, `no-empty-bodies` and
`no-copy-paste` are covered by nothing. The first two find zero today, so an
emptied `noStubComments()` is indistinguishable from a clean repo.

**And the rule the arc is actually about ships at `warn`, excluded from the exit
code.** `no-copy-paste` findings do not fail the build
(`scripts/check-guardrails.mjs:104` filters to errors for the exit), nothing
asserts a floor on the count, and no fixture plants a duplicate pair. The
extraction series' declared goal was to take that count from 84 to 30 — so a
detector that started returning `[]` would look exactly like the series
finishing successfully.

## Why the third one is the sharp edge

The script's comment at `:88-100` is honest that "a warning nobody acts on is
barely dogfooding". That is honesty about warnings **nobody acts on**. It is not
honesty about warnings that **stopped being produced**, and the two are
indistinguishable from the green side — which is the manifesto's own sentence
about a rule that never fires being either a solved problem or a vacuous check.

Bug 0239 is the live instance of that risk in the same detector: `clusterRank`
and `peakSimilarity` can both be neutered with the whole suite staying green.

## Fix

1. Derive the count: `agentGuardrails(p, { ...opts, report: 'builders' }).length`,
   which is the preset's own answer and cannot drift from the flags.
2. Three more rows in `GATE_FOR['check:guardrails']`, with fixtures in the
   `bad-waived-gates.mjs` family, one per rule id, asserting the **id** and not
   the exit code — the harness's own doctrine.
3. For `no-copy-paste` specifically, a fixture that plants a genuine duplicate
   pair and asserts the finding is produced, so "the count went to zero" and "the
   detector went silent" stop being the same observation. Whether the gate should
   also block on it is a separate decision and is **not** proposed here: bug 0169
   settled that the detector's weight is advisory.

## Verification

- [x] The denominator responds: turning off one flag takes the summary from
      `4 rules` to `3 rules`. Before the fix it said `5 rules` whatever the call
      constructed — a number no run produced, in the one line a reader uses to
      tell a real run from a no-op.
- [x] Each of the four rule ids has its own row, and each reds when its own rule
      is disabled — measured one at a time, so a row cannot be satisfied by a
      sibling rule firing on the same probe.
- [x] A planted duplicate pair produces a `no-copy-paste` finding, asserted by
      **rule id and probe name**. That row deliberately does **not** assert a
      non-zero exit: the rule warns, so the gate does not fail on it, and
      asserting an exit would assert the opposite of what the gate does. The
      output is the only signal separating "the count went to zero" from "the
      detector went silent".
- [x] The copy-paste probe needed eight distinct identifiers to be seen at all —
      the detector's default `minDistinctVocabulary` is 8, and a first attempt
      with four was rejected before similarity was ever scored. Measured while
      writing the fixture, and recorded in it, because a probe that silently
      fails to trigger is a fixture that proves nothing.
- [x] Which assertion discriminates is stated per row, because it differs. This
      repo carries real copy-paste warnings of its own, so that rule id appears
      in the gate's output on every clean run — in that row the id check is
      always true and only the probe NAME can fail. `no-stubs` and
      `no-empty-bodies` find nothing on a clean run, so for them both halves are
      load-bearing. Found while reviewing my own fixture; the sabotage had
      already proved the row works, but the comment implied a conjunct was
      carrying weight it was not.
- [x] The three new probes are in the fixture's self-heal sweep list. Found by
      review, and it was a real omission: a `SIGKILL` mid-scenario would have
      left a probe behind that the next run no longer cleared. `check:integrity`
      would still NAME it — its scan is prefix-based, not a list — so the
      misattribution half of bug 0231 was never at risk; what was lost was the
      auto-recovery the list's own comment promises. Verified by planting two
      probes by hand and watching a run sweep them.
- [x] Two stale pinned numbers removed while here, the same class of defect as
      this record's subject: the script claimed "the 84 copy-paste warnings
      below" where the run prints 30, and a fixture comment said the gate had
      "four other rules". The live count is the run's to print, per CLAUDE.md's
      own lesson about pinning numbers that drift.
- [x] `npm run validate` green from a run that reached the last step. Ticked on
      the second pass, and the first pass is worth recording: `check:ledger`
      refused this record while **this very box** was open, because a record in
      `fixed/` with an undisposed box is finished work the board still counts as
      outstanding. The box asks whether validate is green and was the only thing
      stopping it. Resolved by running the chain twice rather than by disposing
      the box away — the first pass cleared every gate ahead of the ledger, this
      tick closed the box, and the second pass ran the whole chain to
      `check:surface`. Worth knowing for any record whose last box cites the run
      that the record itself blocks.

## Related

- [0231](./0231-a-killed-nonvacuity-run-leaves-an-invisible-probe-that-reds-other-gates.md)
  and 0232 — the same branch split `check:integrity` into four rows for the
  identical over-claim; this record is that lesson unapplied one gate over.
- [0169](../0169-computesimilarity-ignores-call-targets-so-opposite-functions-read-as-duplicates.md)
  — settled that `no-copy-paste` is advisory, which this record does not reopen.
- [0239](./0239-a-cluster-finding-carries-one-file-so-diff-aware-drops-the-rest.md)
  — the detector behind the warn half, with its own untested claims.
