# Bug 0288: an unpaired fence swallows a proposal's ruling, and `check:corpus` agrees the proposal was never reviewed

## Status

- **State:** Draft — reproduced against the shipped script; no red test yet.
- **Severity:** **High** — a **live fail-open in a gate running on this repository
  today.** An accepted proposal can ship with no plan and `check:corpus` reports
  clean. Not a library defect an adopter might hit: this one is in eess's own CI.
- **Origin:** self-found · enforcement lens, branch review of 0285/0286/0287
- **Reported:** 2026-09-12

## Symptom

`scripts/lib/proposal-ruling.mjs` strips fenced code before reading a proposal's
`**Ruling:**` line, using the same `FENCE_RE` as three other copies
([0287](./0287-four-copies-of-one-fence-lexer-across-three-packages.md)). An
**unpaired** fence opener anywhere before the ruling makes the stripper pair it
with a later, real fence and blank everything between — including the ruling.

Measured against the shipped module:

| document                                                                                                                       | `operativeRuling` | `hasUnparseableRuling` |
| ------------------------------------------------------------------------------------------------------------------------------ | ----------------- | ---------------------- |
| a plain `**Ruling: Ship as-is**`                                                                                               | `"Ship as-is"`    | `false`                |
| the same, preceded by a four-backtick example containing one unpaired triple opener, and followed by any ordinary fenced block | **`null`**        | **`false`**            |

## Why this is worse than a missed finding

The ruling does not land in the malformed bucket. `hasUnparseableRuling` exists so
that "reviewed but unreadable" is a **finding** rather than a silent
not-accepted — and it is `false` here, because the label was stripped along with
the value.

So the document reads as **never reviewed**, which is a legitimate state. The
corpus gate's "every accepted proposal has a plan" rule then selects nothing for
it and reports clean. An accepted proposal ships with no plan, and the gate agrees.

This is `check:corpus`, on this repo, now.

## The direction that matters, and it generalises

[0287](./0287-four-copies-of-one-fence-lexer-across-three-packages.md) framed the
shared lexer's defect as leaks letting **illustrative** content through. That is
one direction and it is the safer one.

**Over-stripping is the dangerous direction**, and it follows from the pattern by
construction, so it applies to all four copies: an unpaired opener pairs with the
next real fence and blanks the **real** content between them. Every consumer then
selects fewer elements and loses findings:

| consumer                                           | measured                                                         |
| -------------------------------------------------- | ---------------------------------------------------------------- |
| `scripts/lib/proposal-ruling.mjs`                  | this record — the ruling vanishes                                |
| `packages/md/src/rules/ledger.ts` `findState`      | [0286](./0286-a-fenced-example-can-turn-the-close-checks-off.md) |
| `packages/md/src/builders/vocabulary.ts` `terms()` | follows by construction; **not measured**                        |
| `packages/crossvalidate/src/md-gherkin.ts`         | follows by construction; **not measured**                        |

The last two are stated as unmeasured on purpose. They are the same function on
the same input class, but this record does not claim a defect it did not run.

## The corruption that must produce a violation

**An unterminated fence must not silently extend to the next fence.** Two shapes
of fix, and they are not equivalent:

1. **Report it.** An unpaired fence opener in a scanned document is itself a
   finding — the document is malformed and any answer derived from it is a guess.
   This is the fail-closed option and it is the only one that works for
   [0286](./0286-a-fenced-example-can-turn-the-close-checks-off.md)'s second route
   as well, where no lexer change can help.
2. **Terminate at end of document.** An unclosed fence closes at EOF rather than at
   the next opener. Repairs this record and 0286's first route; leaves 0286's
   second route untouched, because that one is the markdown parser losing nodes,
   not the regex.

(1) is the one to argue for. A document whose fences do not balance cannot be read
reliably by _either_ parser, and this family's own doctrine is that an unreadable
input is reported rather than guessed at — which is exactly what
[0120](./0120-no-state-and-cannot-find-it-are-the-same-answer.md) decided for an
unreadable `State:` token.

## Non-vacuity

`scripts/check-nonvacuity.mjs` has no row for the ruling parser's fail-open,
because the failure is a finding that does not appear. A new row with its own
fixture — an accepted proposal with an unpaired fence and no plan — must red.

## Verification ledger

- [x] Reproduced against the shipped `scripts/lib/proposal-ruling.mjs`: the ruling
      returns `null` and `hasUnparseableRuling` is `false`.
- [x] Confirmed the control returns the ruling correctly.
- [x] Confirmed the same `FENCE_RE` is shared by four consumers.
- [ ] Red first: an accepted proposal carrying an unpaired fence, with no plan
      declaring it, must fail `check:corpus`.
- [ ] The non-vacuity row and fixture.
- [ ] Which fix — report the unpaired fence, or terminate at EOF. **Bears on 0286
      and 0287 and should be decided once for all four consumers.**

Deferred: none.

## Related

- [0287](./0287-four-copies-of-one-fence-lexer-across-three-packages.md) — the four
  copies. This record is the measured consequence in the fourth, and corrects that
  record's severity rationale.
- [0286](./0286-a-fenced-example-can-turn-the-close-checks-off.md) — the same
  over-stripping direction in the ledger preset, plus a second route no lexer fix
  reaches.
- [0143](./0143-proposal-ruling-parser-duplicates-terms-vocabulary.md) — files this
  very script as hand-rolling a stripper the dialect ships. It is right that the
  duplication is wrong and wrong that there is a good copy to adopt.
- [0120](./0120-no-state-and-cannot-find-it-are-the-same-answer.md) — the precedent
  for reporting an unreadable input rather than guessing.
