# Bug 0116: an enforcement row marked `gated` resolves cleanly against `it.skip(…)` — a clause claiming CI blocks it, proven by a test that never runs

## Status

- **State:** Draft — the shape is confirmed against the fixture corpus and the
  ADR convention; no red test yet.
- **Severity:** Medium — an honesty gap between a stated claim and its actual
  mechanism. Nothing resolves that should not; what is missing is the check that
  the resolved test _runs_.
- **Origin:** self-found · architect review of
  [0105](./fixed/0105-md-ts-drops-modifier-forms.md)'s fix, which is what made
  the strong gate agree with the weak one here
- **Reported:** 2026-08-12

## Symptom

`CLAUDE.md`'s enforcement-table convention defines the Status vocabulary:

> `gated` (mechanism runs in CI, failing blocks) · … · `pending` (decided,
> mechanism known, not yet green/wired)

and the `eess-adr-author` skill is explicit that a not-yet-green rule ships as
`it.skip` and is marked **`pending`**, because "marking it `gated` when the code
still violates it is the exact lie" the convention exists to prevent.

Nothing checks the pairing. An ADR row can read

```markdown
| a rule | 1 | vitest · `it('a guarantee')` | gated |
```

against `it.skip('a guarantee', …)`, and `adrCitationsResolve` resolves it. The
clause claims CI blocks on it; the test never runs.

## Root cause

`TestDef` (`packages/crossvalidate/src/md-ts.ts`) carries `{ title, file }`. The
modifier is read — 0105's fix is precisely about reading it — and then discarded,
so the correspondence has no way to see that the matched definition is skipped.
The Status column is likewise never joined to anything: `adrEnforcement` validates
that Status is in the vocabulary, not that it is _true_.

Before 0105 this was masked in one direction and mis-signalled in the other: the
AST gate could not see `it.skip` at all, so a `gated` row citing one went red —
for the wrong reason (the test "did not exist"), and a _`pending`_ row citing one
went red too, which is the false red 0105 fixed. `eess-md`'s text-level check has
always accepted modifier forms, so `check:corpus` has always had this hole.

## Why it matters

This is the manifesto's own tier claim turned on itself. A `gated` row is the
strongest claim the convention can make, and the family's most-trusted gate now
confirms it against a test that is guaranteed not to execute. The failure is
silent and the artifact reads as verified.

The remedy is also unusually cheap right now, which is the argument for doing it:
0105 taught the reader to see the modifier, and [0115](./0115-two-test-definition-readers.md)
proposes carrying it on the record. One field and one comparison.

## Fix

Carry `modifier` (or `skipped: methodName === 'skip' || methodName === 'todo'`)
on `TestDef`, and cross-check it against the row's Status:

- Status `gated` resolving against a skipped/todo definition → **violation**.
  Message must name both halves: the row claims `gated`, the test is `it.skip`.
- Status `pending` resolving against a skipped definition → correct, and arguably
  worth asserting the _converse_ later (a `pending` row whose test is live is
  under-claiming — a lesser sin, and noisier to gate).

Requires the Status cell, which `adrCitationsResolve` does not currently read —
it selects only the Mechanism column. That is the real work: the correspondence
becomes row-scoped rather than citation-scoped.

Sequence after [0115](./0115-two-test-definition-readers.md), which puts the
modifier on the record.

## Verification

- [ ] Red test written first: a `gated` row citing a test defined as `it.skip`
      produces a violation naming both the claimed status and the modifier.
      Resolves green today.
- [ ] A `pending` row citing the same `it.skip` definition stays green.
- [ ] This repo's own ADRs are checked against the new rule and any row that has
      been over-claiming is corrected in the same PR.
- [ ] `npm run validate` green.

Deferred: whether a `pending` row whose cited test is **live** should also be
reported (under-claiming). Noisier, lesser sin, and it can follow.
