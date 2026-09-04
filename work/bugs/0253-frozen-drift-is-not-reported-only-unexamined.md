# Bug 0253: the frozen contract promises drift is "reported"; nothing reports it

## Status

- **State:** Draft — the false claim is corrected where it is printed; the
  missing behaviour is not built.
- **Severity:** Low — **an over-claim, not a false green.** Nothing is wrongly
  passing: frozen pointers are meant not to fail, and they do not. What is untrue
  is the second half of the promise — a reader is told drift in history is
  surfaced for them, and it never is.
- **Origin:** self-found · fixing [0249](./fixed/0249-most-of-work-is-outside-every-corpus-root.md),
  which freezes `work/spikes/**` and leans on the frozen contract to justify it.
  Verifying that the contract holds is what showed half of it does not.
- **Reported:** 2026-09-04

## Symptom

`work/README.md` states the contract:

> Terminal folders are **frozen**: their code pointers describe things as they
> were, so `check:corpus` reports drift in them but never fails on it (links must
> still resolve).

`check:corpus` printed the same promise on every run: `N frozen (history —
reported, never gated)`.

**Measured 2026-09-04.** A document under a frozen glob carrying a deliberately
stale pointer — a real file, a line far past its end — produces:

- **exit 0** ✓ (never fails: true)
- **links still gated** ✓ (a broken link in the same document does fail)
- **no output about the pointer at all** ✗ — not a warning, not a count, nothing

The pointer rule selects `.areLive()` (`scripts/check-corpus.mjs`), so a frozen
document's pointers are filtered out before evaluation. They are not reported
quietly; they are never examined.

## Why it matters, and why it is Low

The value of a frozen folder's drift report is real but modest: it tells a reader
which historical records have decayed, so a citation chased into `completed/` or
`fixed/` can be trusted or discounted. Without it, every frozen pointer is
equally suspect and the reader re-derives.

It is Low because nothing passes that should fail. The contract's _gating_ half —
the half that could hide a defect — is exactly right and is measured working.

The reason to file rather than shrug: **this is the claims-outrun-mechanism class
in the sentence that defines a contract**, and the gate printed it on every green
run. Bug 0250's whole subject is that this class had no owner.

## What is corrected already, and what is not

Corrected in the change that found it:

- the summary line now reads `N frozen (history — links gated, pointers not
examined)`;
- a comment added by 0249's fix had repeated the old wording verbatim and is
  fixed with it.

**Not corrected:** `work/README.md` still carries the original sentence. That is
deliberate — the document is the subject of
[0108](./0108-work-readme-lanes-table-lists-one-lane.md) and
[0251](./0251-the-corpus-map-teaches-a-close-vocabulary-the-gate-rejects.md),
both blocked, and editing one sentence of a map two records already own would
scatter the fix. Whoever takes those takes this line with them.

## Fix (not built) — two honest options

1. **Make the promise true.** Evaluate pointers in frozen documents and report
   them as informational, never as violations. The rule already exists; it needs
   a second selection (`.areFrozen()`, or the inverse filter) and a report
   channel that does not touch the exit code. This is the option that keeps the
   contract's words.
2. **Drop the promise.** Say frozen folders' pointers are not checked, in
   `work/README.md` and in the working-method doc, and delete the expectation.
   Cheaper, and defensible: nobody has missed the report in the time it has been
   absent.

Option 1 is more useful; option 2 is more honest about what anyone will actually
build. Choosing is the work.

## Verification

- [ ] Whichever option: no document or summary line claims a behaviour the gate
      does not have.
- [ ] If option 1: a stale pointer in a frozen folder appears in the output and
      the exit code stays 0 — both asserted, since the pair is the whole point.
- [ ] If option 1: a `check:nonvacuity` row, or the report is a claim again.

## Related

- [0249](./fixed/0249-most-of-work-is-outside-every-corpus-root.md) — freezes
  `work/spikes/**` and depends on the gating half of this contract, which holds.
- [0251](./0251-the-corpus-map-teaches-a-close-vocabulary-the-gate-rejects.md) ·
  [0108](./0108-work-readme-lanes-table-lists-one-lane.md) — the other two
  defects in `work/README.md`, which own the sentence this record leaves in place.
