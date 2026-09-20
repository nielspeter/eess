# Bug 0332: the callback conditions carry no callback-level denominator

## Status

- **State:** Draft — measured on PR #147's build. The fix is a decision about ADR-010's unit, not a
  patch.
- **Severity:** Medium — **a pass constructed from the wrong denominator.** A rule whose callbacks
  are all in shapes the shared definition cannot read reports `examined: 1` — the call — and goes
  green. `within()`, given the same file, reports `examined: 0` and an ADR-010 configuration
  finding that cannot be suppressed. Same blindness, two verdicts: the reader that can say "I
  enforced nothing" says it, and the reader that cannot stays silent.
- **Origin:** the enforcement review of PR #147, 2026-09-20. The Severity section of
  [0324](./fixed/0324-the-callback-conditions-read-a-direct-callback-only.md) named this while that
  bug was open; it is filed here so it does not close with it.
- **Reported:** 2026-09-20

## Symptom

Measured on PR #147's build, `call('legacy')` over `use([() => legacy(1)])` — a shape
[0331](./0331-the-callback-definition-reads-an-object-literal-and-nothing-else.md) records as unread:

| reader                      | verdict | `examined` | what it says                             |
| --------------------------- | ------- | ---------- | ---------------------------------------- |
| `notHaveCallbackContaining` | green   | 1          | nothing                                  |
| `within(...).functions()`   | red     | 0          | ADR-010: "this rule examined 0 subjects" |

`examined: 1` is honest at its declared unit — one call WAS selected and examined. The number that
answers vacuity for these conditions is how many callbacks were searched, and nothing carries it.

## Root cause

ADR-010 requires a pass to be constructed from evidence — `{ violations, examined }` — and the unit
of `examined` is the rule's subject. For `calls()` the subject is the call, so a condition that
searches _inside_ a call has a denominator one level coarser than the thing it reads. `within()`
escapes it by making the callback the subject: its subjects are the extracted functions, so an empty
extraction is an empty selection and ADR-010 fires.

Every condition that searches below its subject has this shape —
`notHaveArgumentContaining` over arguments, `searchClassBody` over members — so a fix is a decision
about the model, not about `call.ts`. It is the other half of
[0174](./0174-eess-ts-reports-a-clean-gate-with-no-denominator.md): that record is about a gate
printing no denominator, this one is about a rule carrying the wrong one.

## Fix

Not decided. Three directions, in rising order of cost:

- **Report it where it is already known.** The callback conditions could emit an ADR-010
  configuration finding when a selected call yields zero callbacks and the rule is a prohibition —
  the same finding `within()` produces, from the reader that currently stays silent.
- **A second denominator.** Carry `examinedBelow` beside `examined` for conditions that search below
  their subject, and let the emitters read it. Touches ADR-010 and ADR-014.
- **Nothing, declared.** Say that `examined` is per-subject by design and that vacuity below the
  subject is `within()`'s job, then document it in `docs/calls.md` so an adopter knows which reader
  to use when the question is "did this rule look at anything".

The first is the smallest thing that removes the silent half, and it is the one an adopter would
notice.

## Related

- [0331](./0331-the-callback-definition-reads-an-object-literal-and-nothing-else.md) — the shapes
  that make this reachable.
- [0174](./0174-eess-ts-reports-a-clean-gate-with-no-denominator.md) — the gate-level half.

## Verification

- [ ] reproduced by a test that pins both verdicts on one file
- [ ] a ruling on ADR-010's unit for a condition that searches below its subject
- [ ] the fix, and the ADR amended if the unit changes
- [ ] `npm run validate` green.

Deferred: none.
