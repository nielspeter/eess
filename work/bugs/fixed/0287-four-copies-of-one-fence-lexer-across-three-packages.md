# Bug 0287: one fence lexer, four byte-identical copies, two packages and a script, and a precedent that already settled this

## Status

- **State:** Fixed — every copy reads prose through one owner in eess-md, and a check stops a fifth (see
  "Fixed" below). The ledger's copy moved in PR #144, the other three in PR #145.
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

| copy                                                              | used for                          |
| ----------------------------------------------------------------- | --------------------------------- |
| `packages/md/src/rules/ledger.ts:153` (0.6.0; deleted in PR #144) | `State:` and `Deferred:` scanning |
| `packages/md/src/builders/vocabulary.ts:97`                       | `terms()` label collection        |
| `packages/crossvalidate/src/md-gherkin.ts:64`                     | markdown-to-Gherkin binding       |
| `scripts/lib/proposal-ruling.mjs:107`                             | `**Ruling:**` parsing             |

Two packages plus a gate script. An earlier version said three packages. All four carry
`/(```|~~~)[\s\S]*?\1/g`, so all four carry the same behaviour on the same input
class.

**An earlier version of this record framed that behaviour as leaks letting
_illustrative_ content through. That is the safer direction and it is not the one
that matters.** The pattern is non-greedy and unanchored, so a triple-backtick run inside a longer fence is read as a delimiter, pairs with the next real fence, and blanks the **real** content between them. An earlier wording called this an unpaired opener; [0288](./0288-a-four-backtick-fence-swallows-a-proposals-ruling-and-the-gate-agrees.md) measured the document as paired. Every
consumer then selects fewer elements and loses findings:

| consumer                                           | measured                                                                                                             |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `scripts/lib/proposal-ruling.mjs`                  | [0288](./0288-a-four-backtick-fence-swallows-a-proposals-ruling-and-the-gate-agrees.md) — the ruling vanishes, in CI |
| `packages/md/src/rules/ledger.ts`                  | measured on 0.6.0: the State line vanishes and nothing reports; the document is below. Fixed by PR #144              |
| `packages/md/src/builders/vocabulary.ts` `terms()` | measured on 0.6.0 when fixed: a real reference below the example is lost. Fixed by PR #145                           |
| `packages/crossvalidate/src/md-gherkin.ts`         | measured on 0.6.0 when fixed: a real citation below the example is lost. Fixed by PR #145                            |

The last two were marked unmeasured until the fix measured them; this record did not claim a defect it
had not run.

The `ledger.ts` row, measured on 0.6.0 (`72d629a`) with `closeInPlace: true`. Since PR #144 the same
document reports `ledger/silent-open-box` @11, with a readable state and one done item:

`````text
# 0001 x

````md
```
````

**State:** Done

## Tasks

- [ ] box

```text
later
```
`````

| document                                           | findings                    | readable state | done  |
| -------------------------------------------------- | --------------------------- | -------------- | ----- |
| the same without the four-backtick block (control) | `ledger/silent-open-box` @7 | 1              | 1     |
| with it                                            | **none**                    | **0**          | **0** |

By commonmark.js the State line and the box are outside code. An earlier version of this row cited [0286](./0286-a-fenced-example-can-turn-the-close-checks-off.md), which measured other mechanisms.

## Why this is not just 0286 repeated

**It inverts an open record.**
[0143](../0143-proposal-ruling-parser-duplicates-terms-vocabulary.md) files the
script copy as a duplicate of what the dialect "already ships", and points at
`builders/vocabulary.ts` and `rules/ledger.ts` as the shipped primitives to
consolidate onto. Those two are duplicates **of each other**, and of a third in
`crossvalidate`. Consolidating onto a shipped primitive is weaker advice when the
shipped primitive is one of four copies with no test.

0143 remains right that the script should not hand-roll it. It is wrong about
there being a canonical one to adopt.

## The precedent already exists, and it is Fixed

[0257](./0257-path-suffix-resolution-is-implemented-twice.md) is the same
shape: one algorithm, two dialects, two implementations. Its resolution was **one
owner in the kernel, called by both, the second copy deleted** — not the two kept
in sync. Its stated trigger was "the next dialect that needs the algorithm will be
the third". There are four here, and a fifth consumer is the script.

[0114](../0114-string-literal-lexis-lives-outside-the-engine.md) and
[0115](../0115-two-test-definition-readers.md) are the same class again in other
corners of the family.

## The question this record exists to put

**Should any of these own a fence lexer at all?**

The markdown dialect already parses markdown properly for its task-box path, and
mdast handles all seven shapes 0286 probed correctly by construction. A later version of this record retracted that as six of seven; the retraction was wrong, since on the unclosed fence mdast agrees with CommonMark ([0286](./0286-a-fenced-example-can-turn-the-close-checks-off.md)).

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
   a lexer it cannot own — one level down. It removes the misreading, but not the silence on an unclosed fence: by CommonMark that document has no State line and no box outside code, and 0286 records a widened pattern leaving that document with no readable state and still no finding. Needs option (4) beside it. An earlier version said mdast loses real content here; it does not.
3. **Widen the regex in one place and consolidate**, which is (1) plus a patch.

4. **Report an unterminated fence** as its own finding, whoever owns the lexer. It reaches 0286's unclosed-fence document directly, which no choice of lexer does. [0286](./0286-a-fenced-example-can-turn-the-close-checks-off.md) owns it; [0288](./0288-a-four-backtick-fence-swallows-a-proposals-ruling-and-the-gate-agrees.md) once preferred it and retracted that.

(1) is the smallest thing that stops the defect recurring across four files. (4) is
the one that actually closes the dangerous shape. They compose; (2) does not
substitute for (4). **Not settled here** (settled 2026-09-19 — see "Ruled") — it is
a placement decision across two packages and a script, and 0257 says the answer has precedent
rather than saying what it is for this case.

## The corruption that must produce a violation

A second implementation of the fence stripper must not be able to appear silently.
Once there is one owner, the check is the one this repo already uses for
duplication: an architecture rule that no module outside the owner declares a
`FENCE_RE`-shaped constant or a `stripFencedCode` function. `arch.rules.ts` is the
home and `0257`'s fix is the model.

**What this rule cannot see.** Two fence readers already exist that are not `FENCE_RE`-shaped: the kernel's line loop `maskMarkdownCodeSpans` (`packages/core/src/mask-non-comment.ts:171`) and the mdast walk behind `pointers()` (`packages/md/src/model/pointers.ts:37`). A rule on a regex constant matches neither, so this break class covers the four copies only. _(As built, the check matches any regex alternating a backtick run and a tilde run, which includes the kernel's line loop; that one is a named home. The mdast walk is not a regex and stays out of reach.)_

Until the ownership question is answered there is nothing to gate, which is why this is a `Draft` record putting a question and not a fix. _(Answered 2026-09-19; the rule lands with the last copy.)_

## Ruled, 2026-09-19

**The library author ruled options (1), (2) and (4): one owner, in the dialect, reading prose on the
markdown parser it already runs, every copy moved onto it and a rule against a fifth, and a finding for an
unterminated fence.** The owner is `packages/md/src/model/prose.ts` in eess-md — `proseText` — not the
kernel: the kernel borrows a lexer it cannot own (ADR-012), and the markdown parser is the dialect's. A bug
record holds the ruling, as [0257](./0257-path-suffix-resolution-is-implemented-twice.md)'s did for the
same shape; no ADR is written for it.

Two things the ruling leaves to the next PR: how crossvalidate and the proposal script reach `proseText` —
a public export of eess-md or an internal entry point — and HTML. The first version of 0286's fix set HTML
blocks aside too, and silenced a real `State:` line inside a `<div>`; the fix sets aside code blocks only,
and HTML stays [0293](../0293-an-example-inside-an-html-block-is-read-as-prose.md)'s question.

Built so far, in 0286's PR (#144): the owner, and the `ledger.ts` copy deleted, both of its call sites reading
through the owner, and the unterminated-fence finding. Still to move onto it: `builders/vocabulary.ts`,
`packages/crossvalidate/src/md-gherkin.ts` and `scripts/lib/proposal-ruling.mjs` — and then the
architecture rule that stops a fifth copy.

## Fixed

**One owner, and two readings of it.** `packages/md/src/model/prose.ts`'s `proseText` pairs fences with
the markdown parser for every reader in the family, and takes which code to set aside:

- `'commonmark'` — every code block, as CommonMark reads it. The ledger reads this way and reports what it
  cannot read: a fence that never closes, and a `State:` line found only in code (bug 0286).
- `'closed-fences'` — only a fenced block that closes. `terms()`, the scenario-citation preset and the
  proposal-ruling script read this way: none of them can report an unclosed fence, so each reads past one
  rather than drop the rest of the document.

**The second reading is a design choice, made when the fix was built.** The ruling paired the parser (2)
with a finding for an unterminated fence (4), because by CommonMark everything after an unclosed fence is
code, and a reader that silently agrees drops it. Measured when fixing: the copies read a real line after
an unclosed fence, and `'commonmark'` alone dropped it for all three consumers. `terms()` is a builder
and cannot report one. The library author left the design to the builder. The rule chosen: a reader that
can report reads as CommonMark and reports (4); a reader that cannot sets aside only what is certainly an
example, so a malformed document errs toward a false red, never a silent pass. That is what the copies
meant to do, with the fences paired by the parser. The kernel's own masker takes the mirror of it for the
mirror reason: it looks for waivers, so it blanks to the end (`packages/core/src/mask-non-comment.ts:166-169`).
In this repo `check:ledger` reports an unclosed fence on the proposals and plans lanes, so the script's
readings are covered from the side that can report.

**Measured on 0.6.0 against the fix**, each consumer, a real line and an example line per shape:

| shape                                                  | 0.6.0                     | fixed                 |
| ------------------------------------------------------ | ------------------------- | --------------------- |
| a four-backtick or four-tilde example, lone inner run  | **real line lost**, all 3 | read                  |
| an inner fence paired inside a four-backtick/tilde one | **example read**, all 3   | set aside             |
| a fence its list item closes                           | **example read**, all 3   | set aside             |
| a fence that never closes                              | real and example read     | real and example read |
| an indented example                                    | read                      | read                  |

No shape loses a real line on the fix. Over this repo's 519 markdown documents the script's six readings
(ruling, ruling line, unparseable ruling, Implements, its line, unparseable Implements) are identical on
0.6.0 and the fix, and so is every document's citation count (57).

**Reached through `@nielspeter/eess-md/internal`**, the dialect's counterpart of the kernel's family
plumbing (ADR-011): not public API, not re-exported by the barrel, and skipped by the public-surface
census like the kernel's. `eess-crossvalidate` imports it at runtime from `md-gherkin`, so its peer floor
on eess-md must reach the release that ships it — raised in that release's `changeset version` commit,
as `RELEASING.md` step 3a says, not before.

**The check against a fifth copy is a source scan, not an eess-ts rule.** `arch.rules.ts` sees the
packages' TypeScript only, and one of the four copies was a script. `scripts/lib/one-fence-reader.test.mjs`
runs in `check:arch`: no file under `packages/*/src`, `scripts` or `kit` may read a markdown fence with
a regex alternating a backtick run and a tilde run, outside two named homes — the owner, and the kernel's
masker, which cannot depend on the dialect's parser (ADR-012). It fails on 0.6.0 naming the three copies
that were left. Its non-vacuity is its own: every home must still match, the copies' exact regex must
match, and every root must contribute files.

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
- [x] **Corrected a false retraction.** An earlier box said mdast handles six of seven shapes and loses real content on the unclosed fence. By commonmark.js that content is code ([0286](./0286-a-fenced-example-can-turn-the-close-checks-off.md)), so mdast is right on all seven.
- [x] Measured the over-strip shape in `ledger.ts`, the document above: no readable state and no finding.
- [x] The ownership question answered — **the library author's**, on 2026-09-19: see "Ruled". This record puts
      it and does not settle it.
- [x] Once answered: the copies removed, and the check that stops a fifth — done-otherwise: a source
      scan run by `check:arch`, `scripts/lib/one-fence-reader.test.mjs`, rather than a rule in
      `arch.rules.ts`, which cannot see a script; see "Fixed".
- [x] Red first: `packages/md/tests/builders/terms-reads-fences-through-the-parser.test.ts` ·
      `it('a reference below a longer fence holding a lone shorter run is read')` and
      `packages/crossvalidate/tests/md-gherkin-reads-fences-through-the-parser.test.ts` ·
      `it('a citation below a longer fence holding a lone shorter run is read')`, with their
      closed-fence examples, fail on 0.6.0's copies; the unclosed-fence tests pass on both, pinning what
      must not be lost.

Deferred: none — the open box above is this record's own subject, not work handed
elsewhere.

## Related

- [0286](./0286-a-fenced-example-can-turn-the-close-checks-off.md) — the defect
  that made this worth asking. It closes whichever way this is decided.
- [0143](../0143-proposal-ruling-parser-duplicates-terms-vocabulary.md) — open, and
  partly inverted by this record's measurement.
- [0257](./0257-path-suffix-resolution-is-implemented-twice.md) — the
  precedent, with its resolution.
- [0114](../0114-string-literal-lexis-lives-outside-the-engine.md) ·
  [0115](../0115-two-test-definition-readers.md) — the same class elsewhere.
