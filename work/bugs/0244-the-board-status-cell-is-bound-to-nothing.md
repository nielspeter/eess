# Bug 0244: a board's status cell is bound to nothing, so the index can say Draft about work that shipped

## Status

- **State:** Draft — measured, **eight** wrong cells corrected by hand on the
  bugs board, no mechanism written. The mechanism is the fix and it is not
  built. (This bullet said "ten" until 2026-09-04; see the Symptom section, and
  note that the correction there had to be made twice before every copy of the
  number followed — which is the record's own argument for deriving it.)
- **Severity:** Medium — **a false green in the artifact a reader consults
  first.** Nothing about the code is wrong. What is wrong is the index: it said
  `🔴 Draft` about eight bugs that were fixed, merged and moved to `fixed/`.
  Every gate was green the whole time, because no gate reads the cell.
- **Origin:** self-found · closing
  [0242](./fixed/0242-a-waiver-on-a-non-anchor-file-silently-does-not-apply.md),
  when its own board row still read `🔴 Draft` after the record read `Fixed`.
- **Reported:** 2026-09-04

## Symptom

`work/bugs/BUGS.md` is the board — the one artifact a reader opens to ask "what
is outstanding". Each row carries a status cell. Measured **at `HEAD`**, before
this record's hand-correction, across the 56 rows whose link already pointed into
`fixed/`:

| status cell              | rows  |
| ------------------------ | ----- |
| ``✅ Fixed → `fixed/` `` | 41    |
| **`🔴 Draft`**           | **7** |
| _(empty)_                | 6     |
| `🟢 Fixed`               | 2     |

Seven rows said `🔴 Draft` beside a record whose own header said
`**State:** Fixed` and whose file already sat in `fixed/`: 0219, 0224, 0231,
0232, 0239, 0240 and 0241. Four of those were fixed and merged in the two days
before this was noticed.

0242 is the eighth. Its row said `Draft` for the same reason but does not appear
in the count above, because at `HEAD` its link still read `./0242-…` rather than
`./fixed/0242-…` — the record moved in the same working tree that found this.
**Eight cells corrected by hand**, because there is nothing to correct them with.
After the correction the board reads 49 / 0 / 6 / 2 over the same 57 rows.

**Both of the numbers in this section were wrong in the first draft**, which said
"ten cells" and gave a mid-correction snapshot as if it were a measurement.
Enforcement review re-derived them and found both. Recorded rather than edited
away: in a record whose whole subject is a status nothing checks, two unchecked
numbers in the record itself are the same defect one level down, and that is the
most useful thing this record has to say about itself.

## Why no gate saw it

`check:ledger` reads the records and **excludes the boards by construction.**
`boardFiles` is a skip list, not a check list — `notBoardFile`
(`packages/md/src/rules/ledger.ts:322`) filters board documents out of the scan,
and `ledgerStats` skips them again when computing its denominator
(`packages/md/src/rules/ledger.ts:626`).

That exclusion is correct on its own terms: a board is an index, not an item,
and scanning it as an item would report every row as a record missing a `State:`
line. The defect is that nothing was put in its place. So today:

- nothing binds the cell to the record's `**State:**` token,
- nothing binds the cell to which folder the file is in,
- nothing binds the strikethrough on the link to either, and
- the cell has **no fixed vocabulary at all** — `✅ Fixed → `fixed/``,
`🟢 Fixed`, `🔴 Draft`and empty are all in live use for records whose State
is`Fixed`.

`check:corpus` resolves the link, so a row can point at a real file, in the right
folder, and describe its state as the opposite of the truth. The link being valid
is exactly what makes the wrong cell credible.

## Why it matters

This is the honesty-at-close principle applied one level up, and the level that
gets read. A record in `fixed/` marked `Fixed` is honest; a board row saying that
same work is `Draft` is the index lying about it. The direction is the bad one —
**work that shipped reads as outstanding** — so a reader (or an agent picking up
"what's open") is sent to re-do finished work, and the count of open bugs anyone
quotes from this board is wrong.

It is also the shape this repo keeps catching in its own instruments: an
exclusion added for a good reason (`boardFiles`), never revisited, and the thing
it excluded left unchecked by anything else. Same as
[0189](./fixed/0189-adr-008s-preset-default-row-is-gated-over-a-changed-engine.md)
and [0238](./0238-the-kernels-reason-free-waiver-promotion-is-untested.md):
the check moved and the coverage did not follow.

## Reproduction

At `HEAD`, before any correction:

```
$ git show HEAD:work/bugs/BUGS.md > /tmp/bugs_head.md
$ awk -F'|' '/\(\.\/fixed\// && $5 ~ /Draft/' /tmp/bugs_head.md | wc -l
7
$ npm run check:ledger
✓ honesty at close — … 0 findings
```

Seven rows contradicting their own records, and the gate that owns close-out
honesty green beside them. That is the finding stated as an experiment.

The command reports 7 and not 8 because it can only see rows whose link already
points into `fixed/`, and 0242's did not yet. A row that is wrong in **two** ways
at once — stale cell and stale link — is invisible to a filter keyed on either
one. Worth stating, because it is the reason a hand-written probe is not a
substitute for the mechanism this record asks for.

## Fix (not built)

**This repo already built it — for one lane out of three.** `check:corpus`
resolves each `work/proposals/` row against its file and prints
`board agrees with each file`, with ADR-010 vacuity guards at three levels: a
missing board, an unreadable board, and zero rows are each their own finding
(`scripts/check-corpus.mjs:423`). So the fix is not to invent a mechanism. It is
to ask why the proposals lane got one and the other two did not.

A board row is a **correspondence**: `board row ↔ record`, which is the kernel's
existing two-sided join (`correspondence()`), not a new mechanism. The clauses:

1. Every board row's status cell is drawn from a fixed per-lane vocabulary.
2. A row whose record carries a terminal `State:` token, or whose file sits in
   the lane's done folder, must say so — and the converse.
3. Neither side may be missing: a record with no row, and a row naming no record,
   are both findings. (`check:corpus` catches half of the second one today by
   resolving the link.)

**Clause 2 is blocked, and architecture review found the blocker.** Written as a
correspondence with `direction: 'both'`, clause 2's "and the converse" would not
be checked: `relations()` carries only the `direction !== 'right-to-left'` arm
(`packages/core/src/correspondence.ts:254`), so `'both'` silently checks one
direction. That is [bug 0084](./0084-preserve-relations-right-to-left.md), still
open. Shipping clause 2 on top of it would produce a gate reading green over the
converse it promises in its own name — this record's complaint about
`boardFiles`, one level up and self-inflicted. Sequence behind 0084, or scope
clause 2 to left-to-right and say so in the rule's own description.

Also inherited, and worth knowing before this is built: `correspondence()`
findings set no `relatedFiles`, so a "row disagrees with record" finding will be
invisible under `--changed` from the record side — the same class as
[0239](./fixed/0239-a-cluster-finding-carries-one-file-so-diff-aware-drops-the-rest.md),
in the kernel.

Open, and genuinely open — not to be settled by whoever picks this up without
saying so:

- **Is the strikethrough part of the contract or decoration?** 47 rows strike the
  link and some closed rows do not. Binding it is defensible; so is declaring it
  cosmetic and binding only the cell.
- **Where does it live?** Two homes have a claim and they pull opposite ways.
  `honestyAtClose` already takes `boardFiles` and knows each lane's vocabulary,
  so it has every input and would keep one owner for close-out honesty. But the
  working implementation is in `check:corpus`, hand-written for proposals, and
  the cheap move is to generalise that over three lanes rather than write a
  second one. Generalising it also raises whether the proposals version should
  then move, which is a larger change than this record's severity justifies.

## Verification

- [ ] Red first: a fixture board with a closed record marked `Draft` must fail.
- [ ] The vocabulary clause fails on a cell outside the lane's set.
- [ ] A `check:nonvacuity` row, so an emptied implementation cannot stay green.
- [ ] The eight cells corrected by hand here are re-derived by the mechanism rather
      than assumed — a gate that passes only because someone already fixed the
      data proves nothing.

## Related

- [0242](./fixed/0242-a-waiver-on-a-non-anchor-file-silently-does-not-apply.md) —
  the close-out that surfaced this; its own row was one of the eight.
- [0118](./fixed/0118-ledger-gate-skips-the-bug-lane.md) — the same class in the same
  gate: a lane was silently unscanned, and an unrecognised token disabled half the
  check rather than reporting.
- [0084](./0084-preserve-relations-right-to-left.md) — the blocker for clause 2
  above: `direction: 'both'` checks one direction. This record must sequence
  behind it or narrow its own promise.
- [0233](./0233-an-exclusion-that-suppresses-every-violation-is-silent.md) — an
  exclusion that turns a check off while the denominator still reads full. Here
  the exclusion is `boardFiles` and the denominator never counted boards at all.
