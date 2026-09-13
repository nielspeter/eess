# Bug 0287: one fence lexer, four byte-identical copies, three packages, and a precedent that already settled this

## Status

- **State:** Draft — measured; this is a decision, not a defect to patch, and it
  wants its own review.
- **Severity:** **High** — raised 2026-09-12. **The earlier rationale ("nothing is
  wrong that 0286 does not already file") was measured false.** A fourth consumer
  has its own live fail-open in a CI gate on this repo, filed as
  [0288](./0288-a-four-backtick-fence-swallows-a-proposals-ruling-and-the-gate-agrees.md).
  What remains true is that 0286's and 0288's fixes have four places to land and no
  owner, so copies will keep the bug after one is fixed.
- **Origin:** self-found · split out of 0286 on review, which found the record was
  two items: a closable defect and an unanswered ownership question
- **Reported:** 2026-09-12

## Symptom

The same fence-stripper is hand-rolled four times. Byte-identical pattern,
byte-identical body:

| copy                                          | used for                          |
| --------------------------------------------- | --------------------------------- |
| `packages/md/src/rules/ledger.ts:153`         | `State:` and `Deferred:` scanning |
| `packages/md/src/builders/vocabulary.ts:97`   | `terms()` label collection        |
| `packages/crossvalidate/src/md-gherkin.ts:64` | markdown-to-Gherkin binding       |
| `scripts/lib/proposal-ruling.mjs:107`         | `**Ruling:**` parsing             |

Three packages plus a gate script. All four carry
`/(```|~~~)[\s\S]*?\1/g`, so all four carry the same behaviour on the same input
class.

**An earlier version of this record framed that behaviour as leaks letting
_illustrative_ content through. That is the safer direction and it is not the one
that matters.** The pattern is non-greedy and unanchored, so an **unpaired** opener
pairs with the next real fence and blanks the **real** content between them. Every
consumer then selects fewer elements and loses findings:

| consumer                                           | measured                                                                                                             |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `scripts/lib/proposal-ruling.mjs`                  | [0288](./0288-a-four-backtick-fence-swallows-a-proposals-ruling-and-the-gate-agrees.md) — the ruling vanishes, in CI |
| `packages/md/src/rules/ledger.ts`                  | [0286](./0286-a-fenced-example-can-turn-the-close-checks-off.md) — boxes lost                                        |
| `packages/md/src/builders/vocabulary.ts` `terms()` | follows by construction; **not measured**                                                                            |
| `packages/crossvalidate/src/md-gherkin.ts`         | follows by construction; **not measured**                                                                            |

The last two are marked unmeasured deliberately. Same function, same input class,
but this record does not claim a defect it did not run.

## Why this is not just 0286 repeated

**It inverts an open record.**
[0143](./0143-proposal-ruling-parser-duplicates-terms-vocabulary.md) files the
script copy as a duplicate of what the dialect "already ships", and points at
`builders/vocabulary.ts` and `rules/ledger.ts` as the shipped primitives to
consolidate onto. Those two are duplicates **of each other**, and of a third in
`crossvalidate`. Consolidating onto a shipped primitive is weaker advice when the
shipped primitive is one of four copies with no test.

0143 remains right that the script should not hand-roll it. It is wrong about
there being a canonical one to adopt.

## The precedent already exists, and it is Fixed

[0257](./fixed/0257-path-suffix-resolution-is-implemented-twice.md) is the same
shape: one algorithm, two dialects, two implementations. Its resolution was **one
owner in the kernel, called by both, the second copy deleted** — not the two kept
in sync. Its stated trigger was "the next dialect that needs the algorithm will be
the third". There are four here, and a fifth consumer is the script.

[0114](./0114-string-literal-lexis-lives-outside-the-engine.md) and
[0115](./0115-two-test-definition-readers.md) are the same class again in other
corners of the family.

## The question this record exists to put

**Should any of these own a fence lexer at all?**

The markdown dialect already parses markdown properly for its task-box path, and
mdast handles all seven shapes 0286 probed correctly by construction.

**And the two disagree inside one preset, which is how a record goes green.**
`honestyAtClose` reads one document with both: the hand-rolled regex in
`findState`, and mdast in `collectTaskItems`. 0286 measures a silent green from
_each_ direction of that disagreement. So this is not only four copies of one
function — it is a copy that contradicts the parser shipping beside it. So the
options are not "widen the regex" versus "leave it":

1. **One owner, kernel or dialect-internal**, four callers, three copies deleted —
   0257's resolution applied.
2. **Stop hand-rolling**: route the `State:`/`Deferred:`/`Ruling:` scans through the
   mdast pass the dialect already runs. This is ADR-012's shape — the kernel borrows
   a lexer it cannot own — one level down. **It does not remove the leak class**:
   measured, mdast handles six of the seven shapes and loses real content on the
   unclosed fence, so this relocates the defect rather than closing it. Needs
   option (4) beside it.
3. **Widen the regex in one place and consolidate**, which is (1) plus a patch.

4. **Report an unterminated fence** as its own finding, whoever owns the lexer. This
   is the only option that reaches the shape _both_ parsers get wrong, and it is
   [0288](./0288-a-four-backtick-fence-swallows-a-proposals-ruling-and-the-gate-agrees.md)'s
   preferred fix for the same reason.

(1) is the smallest thing that stops the defect recurring across four files. (4) is
the one that actually closes the dangerous shape. They compose; (2) does not
substitute for (4). **Not settled here** — it is
a placement decision across three packages, and 0257 says the answer has precedent
rather than saying what it is for this case.

## The corruption that must produce a violation

A second implementation of the fence stripper must not be able to appear silently.
Once there is one owner, the check is the one this repo already uses for
duplication: an architecture rule that no module outside the owner declares a
`FENCE_RE`-shaped constant or a `stripFencedCode` function. `arch.rules.ts` is the
home and `0257`'s fix is the model.

Until the ownership question is answered there is nothing to gate, which is why
this is a `Draft` record putting a question and not a fix.

## Verification ledger

- [x] Four copies located. **Pattern** byte-identical across all four — the
      load-bearing half. **Body** byte-identical across three;
      `scripts/lib/proposal-ruling.mjs:115` names its parameter `text` rather than
      `s`. An earlier version of this box said all four bodies matched.
- [x] Confirmed all four share the leaks 0286 measured, since the pattern is the
      same.
- [x] Confirmed 0143 points at two of these copies as canonical, which they are
      not.
- [x] Confirmed 0257 is Fixed, with one-owner-in-the-kernel as its resolution.
- [x] **Falsified this record's own claim that mdast handles the leaking shapes.**
      Measured six of seven: an unclosed fence makes mdast swallow to end of
      document and lose the real content. So option (2) below does not remove the
      leak class — it relocates it.
- [ ] The ownership question answered — **the library author's.** This record puts
      it and does not settle it.
- [ ] Once answered: the copies removed, and the architecture rule that stops a
      fifth.

Deferred: none — the open box above is this record's own subject, not work handed
elsewhere.

## Related

- [0286](./0286-a-fenced-example-can-turn-the-close-checks-off.md) — the defect
  that made this worth asking. It closes whichever way this is decided.
- [0143](./0143-proposal-ruling-parser-duplicates-terms-vocabulary.md) — open, and
  partly inverted by this record's measurement.
- [0257](./fixed/0257-path-suffix-resolution-is-implemented-twice.md) — the
  precedent, with its resolution.
- [0114](./0114-string-literal-lexis-lives-outside-the-engine.md) ·
  [0115](./0115-two-test-definition-readers.md) — the same class elsewhere.
