# Bug 0253: the frozen contract promises drift is "reported"; nothing reports it

## Status

- **State:** Draft — the false claim is corrected where it is printed; the
  missing behaviour is not built.
- **Severity:** Low — **an over-claim, not a false green.** Nothing is wrongly
  passing: frozen pointers are meant not to fail, and they do not. What is untrue
  is the second half of the promise — a reader is told drift in history is
  surfaced for them, and it never is. Low survives review, which measured the
  gating half working in both directions. What review changed is the _scope_:
  three of the six copies were in the published packages, so this was never only
  an internal-map problem.
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

**This section was wrong when first written, and the way it was wrong is the
record's own subject.** It scoped the false sentence to three internal places.
Review grepped and found six live copies, **three of them in the published
packages** — the surface an adopter reads, not this repo's internal map. A record
about a claim outrunning its mechanism had not measured its own claim's
footprint.

Corrected in the change that found it (all in one commit):

- the gate's summary line, now `N frozen (history — links gated, pointers not
examined)`;
- the comment 0249's fix had added repeating the old wording verbatim;
- `packages/md/src/corpus.ts` — the JSDoc on the public `CorpusOptions.frozen`,
  which is what an adopter hovers in an IDE;
- `packages/md/src/model/document.ts` — the JSDoc on `MdDocument.frozen`;
- `packages/md/README.md` — where the promise and its refutation sat four lines
  apart in one copy-pasteable block;
- `docs/markdown.md` — both instances, in the published dialect guide.

**Not corrected: `work/README.md:51`, and this record owns it.** An earlier
version of this section deferred that line to
[0108](./0108-work-readme-lanes-table-lists-one-lane.md) and
[0251](./0251-the-corpus-map-teaches-a-close-vocabulary-the-gate-rejects.md) on
the grounds that they own the document. Review checked: **neither record mentions
the frozen contract at all.** Fix 0108 and 0251 exactly as written and the
sentence still stands, with nothing open on it — a deferral to a home that does
not hold it, which is the silent-deferral failure `/close` exists to prevent. It
is listed under this record's own Fix instead, below. The reason to leave it
uncorrected for now is unchanged and narrow: whichever fix option is chosen
decides what the sentence should say.

## Fix (not built) — two options, and option 1 is one line

1. **Make the promise true.** An earlier version of this record said this "needs
   a second selection (`.areFrozen()`, or the inverse filter) and a report
   channel that does not touch the exit code," and closed with "choosing is the
   work." **Both halves already ship.** `.areFrozen()` is a public predicate on
   the pointer builder and `.warn()` is a terminal on every builder. The whole of
   option 1 is:

   ```typescript
   pointers(c).that().areFrozen().should().resolve().warn()
   ```

   **Measured 2026-09-04:** that line selects 197 frozen pointers and reports
   **3** real findings — a citation into a patched dependency's `validator.js`
   that no longer exists, and two pointers into
   `packages/ts/src/graphql/resolver-rule-builder.ts` naming a line past its end
   — with the exit code untouched. So the report the contract promised is
   available today and would have said something true on its first run.

   That reframes this record from a design choice into a ten-minute job, and
   relocates the finding: **the capability is exported, JSDoc'd and
   undiscoverable.** `.areFrozen()` appears zero times in `packages/md/README.md`
   and zero times in `docs/` — which is exactly why a shipped primitive read as
   missing API to the person who filed this. The docs gap is the defect worth
   carrying forward.

2. **Drop the promise.** Say frozen folders' pointers are not checked, and delete
   the expectation. Cheaper, and defensible — nobody has missed the report in the
   time it has been absent — but it is now the strictly worse option, since the
   thing being dropped costs one line and finds three real defects.

Also owed either way: **`work/README.md:51`**, the last uncorrected copy of the
sentence (see above — it is this record's, not 0108's or 0251's), and a
`docs/markdown.md` mention of `.areFrozen()` so the primitive is findable.

## Verification

- [ ] Whichever option: no document or summary line claims a behaviour the gate
      does not have.
- [ ] If option 1: a stale pointer in a frozen folder appears in the output and
      the exit code stays 0 — both asserted, since the pair is the whole point.
- [ ] If option 1: a `check:nonvacuity` row, or the report is a claim again.
- [ ] `work/README.md:51` says what the gate does — this record's, not deferred
      to a home that never held it.
- [ ] `.areFrozen()` appears in `packages/md/README.md` or `docs/markdown.md`, so
      the next person to want this report finds it instead of filing for it.

## Related

- [0249](./fixed/0249-most-of-work-is-outside-every-corpus-root.md) — freezes
  `work/spikes/**` and depends on the gating half of this contract, which holds.
- [0251](./0251-the-corpus-map-teaches-a-close-vocabulary-the-gate-rejects.md) ·
  [0108](./0108-work-readme-lanes-table-lists-one-lane.md) — the other two
  defects in `work/README.md`, which own the sentence this record leaves in place.
