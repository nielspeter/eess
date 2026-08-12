# Bug 0124: a rule-level `suggestion` is stamped onto all three correspondence branches, so one remedy is shown for opposite causes

## Status

- **State:** Draft — measured against a built branch; the behaviour is pinned by
  a test so it cannot change silently, and the remedy is a design call.
- **Severity:** Medium — a confidently wrong instruction is worse than none. Not
  live: no rule in this repo and no shipped preset sets a rule-level `suggestion`
  on a two-sided rule, so nothing in eess emits a wrong `Fix:` today. It is a
  trap in a capability [0122](./fixed/0122-violations-path-drops-because.md) just
  made reachable.
- **Origin:** self-found · enforcement review of 0122's fix
- **Reported:** 2026-08-12

## Symptom

`correspondence()` emits three distinct causes — `leftUnmatched`,
`leftAmbiguous`, `rightUnmatched` — and `applyFilters` stamps the rule's
`suggestion` onto all of them without regard to branch. Measured on a built
branch with `.beComplete({ direction: 'both' })` and
`.rule({ suggestion: 'remove the row from the index' })`:

```
[1 of 3]  GHOST         Fix: remove the row from the index   ← correct
[2 of 3]  DUP           Fix: remove the row from the index   ← remedy is "disambiguate"
[3 of 3]  ONLY-IN-CODE  Fix: remove the row from the index   ← there IS no row; remedy is "add one"
```

The third sends an author to delete something that does not exist.

## Root cause

Two mechanisms for one concept, with different reach:

- `suggest.left` / `suggest.right` — per-side, so the remedy can differ by cause.
  Appended to the violation's `message`.
- `.rule({ suggestion })` — one string for the whole rule, stamped onto every
  violation it produces.

0122 made the second render for the first time. The first is per-cause and
correct; the second is generic and now unconditional.

**This project already reasoned about the hazard and declined it in the other
direction.** [0113](./0113-correspondence-drops-rule-suggestion.md) refuses to
apply `suggest.left` to the ambiguous branch precisely because a remedy written
for the unmatched case mis-advises there. The same argument applies with more
force to a remedy written for the whole rule.

## Why it matters

CLAUDE.md's contract is that a violation "reads as an instruction, not just an
error". An instruction that is wrong for a third of the cases it is printed under
is worse than the error alone: it costs the reader the time to follow it and the
trust to believe the next one. The manifesto's own framing — a spelling drift
reported as an absent field sends the author to add a second field — is this
failure exactly.

## Fix

Preferred: **have `correspondence()` populate `v.suggestion` per branch** from
`suggest.left`/`suggest.right`, rather than appending to `message`. The
`v.suggestion === undefined` guard in `applyFilters` then does the right thing
with no further work — a per-cause remedy wins, a rule-level one fills the gap.

Its cost, measured: `hashViolation` is `rule::element::message`, so moving text
out of `message` changes the identity of every violation from a rule using
`suggest`. The shipped blast radius is one preset —
`packages/crossvalidate/src/md-ts.ts` is the only `suggest:` user under
`packages/*/src` — but an adopter baselining `adrCitationsResolve` violations
would see them resurface. That makes it a `minor` with a migration note, not a
patch, and 0100 Phase 1 reserves the next minor for the fold.

Cheaper alternatives, if that trade is refused:

1. Don't stamp `suggestion` onto `leftAmbiguous`, and don't stamp it on a
   `direction: 'both'` rule's non-primary side. Precise, but it makes the stamp
   branch-aware in the kernel for one builder's benefit.
2. Leave it and keep documenting it. The changeset already tells authors to
   prefer `suggest` when the remedy differs by cause.

Related, same area: `packages/core/src/format-github.ts` appends
`. Fix: ${v.suggestion}` to a `message` that may already contain the folded
`suggest` text, so a rule setting both emits two near-identical `Fix:` clauses in
one annotation. Nothing sets both today. Fixing `suggest` to use the field
resolves this too.

## Verification

- [ ] Red test written first: a `direction: 'both'` rule shows different remedies
      for the two directions. The **current** behaviour is already pinned by
      `packages/core/tests/correspondence.test.ts` ·
      `it('stamps one rule-level suggestion onto every branch, including opposite ones')`,
      which is written to fail when this is fixed.
- [ ] The ambiguous branch advises, or is documented as deliberately silent —
      this closes the open half of [0113](./0113-correspondence-drops-rule-suggestion.md).
- [ ] `--format github` emits one `Fix:` clause when both routes are set.
- [ ] If the message changes: a changeset saying baselines must be regenerated,
      and the bump raised accordingly.
- [ ] `npm run validate` green.

Deferred: none.
