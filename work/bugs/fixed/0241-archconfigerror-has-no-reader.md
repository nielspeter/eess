# Bug 0241: `ArchConfigError` was minted and nothing branches on it, so the surface it exists to fix is unchanged

## Status

- **State:** Fixed — red first, then the branch, each direction
  sabotage-verified. `Deferred: the exported-symbol-with-no-call-site question
below, which is the maintainer's to answer and is not this fix's to settle.`
- **Severity:** Medium — not a false green. Nothing is suppressed and nothing
  reports wrongly; a misconfigured rule still fails loudly. What is false is the
  **claim**: the type shipped to make a misconfiguration distinguishable from a
  crash, and at every reader it still is not. An exported symbol with no
  consumer that reads as coverage — bug 0190's shape, and bug 0178's.
- **Origin:** self-found · enforcement review of the guardrails arc after it
  merged (PR #91, 2026-09-03).
- **Reported:** 2026-09-03

## Symptom

`e82c27d` added `ArchConfigError` and `isArchConfigError`
(`packages/core/src/errors.ts:116`), and moved 17 sites from a bare `Error` to
it. That half shipped and is right.

`isArchConfigError` has **no consumer**. Every reference is a definition or a
barrel re-export: `packages/ts/src/index.ts:36`, the kernel's own export, and one
entry in the vacuity census. Nothing imports it to branch on.

The reader it was written for is unchanged.
`packages/ts/src/cli/rule-file-findings.ts:108`:

```ts
return isArchRuleError(error) ? error.violations : [ruleFileFailure(file, error, rule)]
```

So an `ArchConfigError` still falls into the same `else` as an unhandled crash,
which is verbatim what `.changeset/dogfood-agent-guardrails.md` says the type
fixes:

> a rule author who mistyped an argument saw the same surface as an unhandled
> crash

They still do. The changeset describes an outcome the diff does not produce.

## Why it matters, stated precisely

The audience is an AI coding agent reading a failure and deciding what to do
next. "Your rule file is misconfigured — fix the argument" and "eess crashed" ask
for opposite actions, and today they render identically. ADR-009 rule 2 is about
exactly this: the message must state what to do, and a message whose stated fix
is wrong for the path that produced it is worse than none.

## Fix

Branch on it where the two cases diverge — at minimum
`packages/ts/src/cli/rule-file-findings.ts:108`, so a config error renders with
its `subject` and its own remedy rather than the generic rule-file failure. Then
assert it: a rule file that throws `ArchConfigError` produces a finding naming
the subject, and one that throws anything else does not.

Worth deciding at the same time, and the reason this is one record rather than
two: **the general question is whether an exported symbol may ship with no call
site at all.** Three records now describe that shape — 0178, 0190 and this one.
`check:surface` verifies export-to-doc, not export-to-use. Either that is a gate
worth having or the answer is "no, and review catches it"; a third instance is
enough evidence to decide rather than keep filing.

## Verification

- [x] Red first: three of the new tests failed before the branch existed, and
      the two pinning existing behaviour passed — so the red was in exactly the
      places the defect lived.
- [x] The discrimination is asserted in both directions, and the second
      direction is the one that matters. Sabotage table:

      | sabotage                                                        | reds                                                                                 |
      | --------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
      | remove the config branch                                        | `names what was misconfigured`, `says the fault is the configuration`, `the remedy remediates`, `surfaces the cause` |
      | route plain errors down the specific branch, config errors left alone | `CONTROL — a plain Error still takes the generic path`                          |
      | drop the `cause`                                                | `surfaces the cause`                                                                 |

      Named, not counted — comparing identities rather than integers is ADR-009
      rule 5's own corollary, and it is what makes this table reproducible.

      The middle row is the point: over-claiming a cause for errors that do not
      know theirs fails the CONTROL and nothing else, which is exactly the
      property that row exists to pin. `ruleFileFailure`'s own comment records
      why naming one cause for every error is the defect; the CONTROL is the only
      thing stopping this fix from committing it.

      **This table was wrong when first published, and the reason is this
      record's own subject one level up.** It gave counts of 3, 4 and 1. They
      were true when measured and stale by the time they were written down: the
      remedy-remediates test was added afterwards, to satisfy the config-finding
      census, and the sabotages were never re-run. A number measured once and
      then pinned beside code that moved is the same defect
      [0240](./0240-check-guardrails-prints-a-rule-count-it-does-not-derive.md)
      was filed for, committed hours later by the person who fixed it. The
      middle row was also wrong on its own terms: the first sabotage changed two
      things at once (routing AND the subject), so it reded the specific-content
      tests as well and told me nothing about the control. Found by review.

- [x] `isArchConfigError` has a consumer, exercised by tests.
- [x] `cause` is surfaced. Nothing rendered it before, so the loader's careful
      distinction between "graphql is missing" and "graphql failed to load" was
      being preserved right up to the reader and then dropped.
- [x] The fix did not reproduce the defect it repairs. `check:arch`'s
      no-unused-exports rule refused the new helper for being exported and
      called by nothing outside its own module — a fourth instance of this
      record's exact shape, inside the fix for it. It is internal now, and the
      seam the tests drive is `failureOrViolations`. Worth stating because it is
      the strongest argument available for the open question below: the rule
      that caught it exists, works, and covers `packages/*/src` — the gap is
      that nothing asks the same question of an entry-point export.
- [x] The remedy is **proven**, not merely stated. `check:vacuity`'s
      config-finding census refused the new producer for being unclassified and
      asked whether its remedy had been shown to remediate. Rather than classify
      it `stated-only`, the test now drives the real thrower, asserts the finding
      names its subject, then applies the stated fix and asserts it no longer
      raises — ADR-009 rule 2's behavioural corollary. This producer can make
      that claim precisely because it knows its cause; its sibling
      `ruleFileFailure` is honestly `stated-only` for the opposite reason.
- [x] Writing that test surfaced a name collision worth knowing: the entry point
      exports a `havePropertyNamed` **predicate** and a `havePropertyNamed`
      **condition**, and only the condition validates its arguments. The first
      version imported the predicate and failed for that reason alone. The test
      now imports the condition from its own module and says why.
- [x] **The general question is answerable, and this record was wrong to defer
      it as policy.** Investigated 2026-09-04 after the framing was challenged.

      `eess/no-unused-exports` already exists (`arch.internal.rules.ts:134`) and
      already covers `packages/*/src`. It missed all three instances for one
      precise reason: **a barrel re-export counts as a use.**
      `presetConstructsNothingViolation` is referenced by exactly one file,
      `packages/core/src/internal.ts`, which re-exports it — so the rule sees a
      reference and passes, while nothing calls it.

      That makes the question decidable, and the answer differs by entry point:

      | surface | decidable? | why |
      | --- | --- | --- |
      | `@nielspeter/eess/internal` | **yes** | ADR-011 clause 2 makes the dialects its only legitimate consumers, all in this repo. Measured: `presetConstructsNothingViolation` and `deadGlobViolation` have **0** callers across all five dialects; `isArchConfigError` now has 3. |
      | the public root `index.ts` | **no** | strangers call it; "no caller here" proves nothing. `check:surface`'s export-to-doc is the right instrument there, and bug 0220 owns its gap. |

      So this is a writable rule with a precise scope — a symbol whose only
      reference is the `/internal` barrel — not a question about what the
      project gates. An adopter *can* reach `/internal` (the ADR-011 changeset
      tells them how), so this is the boundary's own definition of dead rather
      than proof of no caller anywhere; removing one is a break the changeset
      names, which is the existing process.

      **Owed:** a bug for that rule. Filing it is the next step, not a decision.

- [x] Filed as [0243](../0243-a-barrel-re-export-counts-as-a-use.md) — the
      shared predicate, with the census: of 89 `/internal` exports, 70 are used
      by a dialect, 8 only inside core, 7 only by tests, and 4 by nothing at all.
      The test-only seven are why the rule is harder than it looks: reddening
      them would delete the seam `preset-dispatch.test.ts` uses to exercise the
      very constructor bug 0190 is about.

## Related

- [0190](./0190-the-preset-constructs-nothing-finding-cannot-fire.md) — a
  finding constructor with no call site; the same shape, already High.
- [0178](../0178-the-kernels-dead-glob-finding-cannot-fire.md) — the same shape
  again, in the kernel.
