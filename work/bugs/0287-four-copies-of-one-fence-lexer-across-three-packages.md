# Bug 0287: one fence lexer, four byte-identical copies, three packages, and a precedent that already settled this

## Status

- **State:** Draft — measured; this is a decision, not a defect to patch, and it
  wants its own review.
- **Severity:** Medium — nothing is wrong that
  [0286](./0286-a-fenced-example-can-turn-the-close-checks-off.md) does not already
  file. What is wrong is that 0286's fix has four places to land and no owner, so
  three of them will keep the bug after the fourth is fixed.
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
`/(```|~~~)[\s\S]*?\1/g`, so **all four carry the three leaks 0286 measured** — a
four-backtick outer fence, an unclosed fence, and an indented block.

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
mdast handles all seven shapes 0286 probed correctly by construction. So the
options are not "widen the regex" versus "leave it":

1. **One owner, kernel or dialect-internal**, four callers, three copies deleted —
   0257's resolution applied.
2. **Stop hand-rolling**: route the `State:`/`Deferred:`/`Ruling:` scans through the
   mdast pass the dialect already runs, which removes the leak class rather than
   patching three shapes of it. This is ADR-012's shape — the kernel borrows a
   lexer it cannot own — one level down.
3. **Widen the regex in one place and consolidate**, which is (1) plus a patch.

(2) is what the evidence points at and is the largest change. (1) is the smallest
thing that stops 0286 recurring in three other files. **Not settled here** — it is
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

- [x] Four copies located; pattern and body confirmed byte-identical across all
      four.
- [x] Confirmed all four share the leaks 0286 measured, since the pattern is the
      same.
- [x] Confirmed 0143 points at two of these copies as canonical, which they are
      not.
- [x] Confirmed 0257 is Fixed, with one-owner-in-the-kernel as its resolution.
- [x] Confirmed mdast handles the leaking shapes correctly on the path the dialect
      already runs.
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
