# Bug 0288: a four-backtick fence swallows a proposal's ruling, and `check:corpus` agrees the proposal was never reviewed

## Status

- **State:** Fixed — the script reads prose through eess-md's parser (PR #145); see "Fixed" below.
- **Severity:** **High** — a **live fail-open in a gate running on this repository
  today.** An accepted proposal can ship with no plan and `check:corpus` reports
  clean. Not a library defect an adopter might hit: this one is in eess's own CI.
- **Origin:** self-found · enforcement lens, branch review of 0285/0286/0287
- **Reported:** 2026-09-12

## Symptom

`scripts/lib/proposal-ruling.mjs` strips fenced code before reading a proposal's
`**Ruling:**` line, using the same `FENCE_RE` as three other copies
([0287](./0287-four-copies-of-one-fence-lexer-across-three-packages.md)). The
pattern is **run-length blind**: it matches the first three backticks of a
four-backtick fence as a delimiter. The closing four-run then mis-pairs with a later
real fence, and everything between is blanked — including the ruling.

**An earlier version of this record called the cause "an unpaired fence opener".
That was wrong, and wrong in a way that mattered.** Measured with the markdown
parser, the reproducing document is **CommonMark-valid and fully paired**: a
three-backtick run inside a four-backtick block is _content_, not a fence. The
record was describing the pattern's misperception as a property of the document —
and its preferred fix, reporting an unterminated fence, therefore could not fire on
its own reproduction.

Measured against the shipped module:

| document                                                                                                                  | `operativeRuling` | `hasUnparseableRuling` |
| ------------------------------------------------------------------------------------------------------------------------- | ----------------- | ---------------------- |
| a plain `**Ruling: Ship as-is**`                                                                                          | `"Ship as-is"`    | `false`                |
| the same, preceded by a four-backtick example containing a triple-backtick run, and followed by any ordinary fenced block | **`null`**        | **`false`**            |

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
construction, so it applies to all four copies: a triple-backtick run inside a longer fence is read as a delimiter, pairs with the next real fence, and blanks the **real** content between them. An earlier wording here still said an unpaired opener, which this record's own Symptom section retracts. Every consumer then
selects fewer elements and loses findings:

| consumer                                           | measured                                                                                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/lib/proposal-ruling.mjs`                  | this record — the ruling vanishes                                                                                                                 |
| `packages/md/src/rules/ledger.ts` `findState`      | measured: the State line vanishes and nothing reports; the document is in [0287](./0287-four-copies-of-one-fence-lexer-across-three-packages.md)  |
| `packages/md/src/builders/vocabulary.ts` `terms()` | measured on 0.6.0 when fixed: a real reference below the example is lost ([0287](./0287-four-copies-of-one-fence-lexer-across-three-packages.md)) |
| `packages/crossvalidate/src/md-gherkin.ts`         | measured on 0.6.0 when fixed: a real citation below the example is lost ([0287](./0287-four-copies-of-one-fence-lexer-across-three-packages.md))  |

The last two were stated as unmeasured until the fix measured them.

## The corruption that must produce a violation

**A fence delimiter is its whole backtick run, and pairs only with a run at least as
long.** That is the corruption: the contents of a four-backtick block must not be
readable as a delimiter.

**An earlier version specified the corruption as "an unterminated fence must not
silently extend to the next fence" and offered two fixes — report the unpaired
fence, or terminate at EOF. Neither repairs this record's own reproduction**,
because that document has no unterminated fence. Both were specified against a
mechanism this record had misnamed.

The fix is **run-length awareness**: an anchored pattern whose closer must be a run
at least as long as its opener. A reviewer built one while reviewing
[0286](./0286-a-fenced-example-can-turn-the-close-checks-off.md) and measured it
repairing that record's first route completely.

**Genuinely unterminated fences are a separate, real shape** — 0286's second route, where an opener with no closer makes the rest of the document code by CommonMark while the regex reads on.
That needs its own handling and this record no longer claims to cover it. Reporting
it remains right _there_, per
[0120](../0120-no-state-and-cannot-find-it-are-the-same-answer.md)'s precedent that an
unreadable input is reported rather than guessed at.

## Non-vacuity

`scripts/check-nonvacuity.mjs` has no row for the ruling parser's fail-open,
because the failure is a finding that does not appear. A new row with its own fixture must red: an accepted proposal whose `**Ruling:**` follows a four-backtick example holding a triple-backtick run, then an ordinary fenced block, with no plan declaring it.

**An earlier version specified an unpaired fence. That fixture is hollow either way.** Measured on `main`:

| fixture                                           | `operativeRuling` | commonmark.js          |
| ------------------------------------------------- | ----------------- | ---------------------- |
| the Ruling, then an unpaired fence                | `"Ship as-is"`    | Ruling outside code    |
| an unpaired fence, the Ruling, then a later fence | `null`            | **Ruling inside code** |
| this record's reproduction                        | `null`            | Ruling outside code    |

With no later fence, the Ruling is read and the gate reds for the ordinary missing-plan reason. With one, the regex agrees with CommonMark.

## Fixed

`scripts/lib/proposal-ruling.mjs` no longer hand-rolls a fence regex. It reads prose through
`proseText` from `@nielspeter/eess-md/internal`, the owner [0287](./0287-four-copies-of-one-fence-lexer-across-three-packages.md)
ruled, which pairs fences with the markdown parser: a fence closes only on a run at least as long as the
one that opened it, so the three-backtick run inside this record's four-backtick example is content.
Both the `**Ruling:**` and the `**Implements:**` readings go through it, once per document.

**A fence that never closes is read past, not reported here.** This module has no finding to report one
with, so it sets aside only fences that close and reads a ruling after an unclosed one, as the regex did.
`check:ledger` reports the unclosed fence itself on the proposals and plans lanes, as
`ledger/unterminated-fence`. The corruption this record names — the contents of a four-backtick block
read as a delimiter — is the one fixed.

Measured on 0.6.0 against the fix: this record's reproduction reads `null` on 0.6.0 and `"Ship as-is"` on
the fix; a ruling inside a four-backtick example is read on 0.6.0 and set aside on the fix. Over this
repo's 519 markdown documents, all six readings are identical on both.

## Verification ledger

- [x] Reproduced against the shipped `scripts/lib/proposal-ruling.mjs`: the ruling
      returns `null` and `hasUnparseableRuling` is `false`.
- [x] Confirmed the control returns the ruling correctly.
- [x] Confirmed the same `FENCE_RE` is shared by four consumers.
- [x] Confirmed with the markdown parser that the reproducing document is valid:
      one code block, the inner run treated as content.
- [x] **Falsified this record's own mechanism and both its fixes** — the document
      is CommonMark-paired, so "unterminated fence" names nothing in it and neither
      offered fix fires on it.
- [x] Red first: this record's reproduction, as an accepted proposal with no plan declaring it, must fail `check:corpus` — the non-vacuity row below plants it: with 0.6.0's script `check:corpus` exits 0 and reports nothing on it; on the fix it exits 1 with `corpus/accepted-proposal-uncited`.
- [x] The non-vacuity row and fixture: `corpus/proposal-ruling-behind-a-fence` in `scripts/check-nonvacuity.mjs`, running the production `check:corpus` on the planted proposal, and three parser-paired directions in `scripts/nonvacuity/bad-proposal-ruling.mjs`.
- [x] The run-length-aware pattern, decided once for all four consumers — done-otherwise: not a pattern.
      The fences are paired by the markdown parser, in one owner every consumer reads through
      ([0287](./0287-four-copies-of-one-fence-lexer-across-three-packages.md)).

Deferred: none.

## Related

- [0287](./0287-four-copies-of-one-fence-lexer-across-three-packages.md) — the four
  copies. This record is the measured consequence in the fourth, and corrects that
  record's severity rationale.
- [0286](./0286-a-fenced-example-can-turn-the-close-checks-off.md) — the same
  over-stripping direction in the ledger preset, plus a second route no lexer fix
  reaches.
- [0143](../0143-proposal-ruling-parser-duplicates-terms-vocabulary.md) — files this
  very script as hand-rolling a stripper the dialect ships. It is right that the
  duplication is wrong and wrong that there is a good copy to adopt.
- [0120](../0120-no-state-and-cannot-find-it-are-the-same-answer.md) — the precedent
  for reporting an unreadable input rather than guessing.
