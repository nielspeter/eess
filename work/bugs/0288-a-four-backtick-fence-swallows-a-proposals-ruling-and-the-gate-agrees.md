# Bug 0288: a four-backtick fence swallows a proposal's ruling, and `check:corpus` agrees the proposal was never reviewed

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

**Genuinely unterminated fences are a separate, real shape** — 0286's second route,
where an opener with no closer makes the markdown parser swallow to end of document.
That needs its own handling and this record no longer claims to cover it. Reporting
it remains right _there_, per
[0120](./0120-no-state-and-cannot-find-it-are-the-same-answer.md)'s precedent that an
unreadable input is reported rather than guessed at.

## Non-vacuity

`scripts/check-nonvacuity.mjs` has no row for the ruling parser's fail-open,
because the failure is a finding that does not appear. A new row with its own
fixture — an accepted proposal with an unpaired fence and no plan — must red.

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
- [ ] Red first: an accepted proposal carrying a four-backtick example, with no plan
      declaring it, must fail `check:corpus`.
- [ ] The non-vacuity row and fixture.
- [ ] The run-length-aware pattern, decided once for all four consumers. **Bears on
      0286 and 0287.**

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
