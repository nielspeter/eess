# Bug 0286: a fenced example of a `State:` line can turn the close checks off, and nothing tests the guard that should prevent it

## Status

- **State:** Fixed — the ledger reads a record's own `State:` and `Deferred:` lines through the markdown
  parser, and reports a fence that never closes. Red test first, both routes.
- **Severity:** **High** — a **fail-open**. A record that documents its own close
  convention, in the shape CommonMark provides for exactly that, loses every
  silently-open box the gate exists to catch. Measured: two findings become zero.
- **Origin:** self-found · surfaced while checking a claim in
  [rejected/0282](../rejected/0282-the-kit-teaches-a-state-vocabulary-its-own-gate-rejects.md);
  the fail-open direction was found by an adopter-lens reviewer who ran the kit
- **Reported:** 2026-09-12 · **Fixed:** 2026-09-19 (PR #144)

## Symptom

`findState` (`packages/md/src/rules/ledger.ts:166-197`) blanks fenced code first so
an illustrative `**State:** Done` inside an example is not mistaken for the
document's own state. `FENCE_RE` (`:153`) is `/(```|~~~)[\s\S]*?\1/g`, and three
shapes get past it.

Probed against `findState`, not read off the regex:

| shape                                     | guard |
| ----------------------------------------- | ----- |
| plain triple-backtick fence               | holds |
| tilde fence                               | holds |
| fence indented inside a list item         | holds |
| tilde outer wrapping a backtick example   | holds |
| four-backtick outer, **no** inner fence   | holds |
| **four-backtick wrapping an inner fence** | leaks |
| **unclosed triple-backtick fence**        | leaks |
| **four-space indented block, no fence**   | leaks |

The four-backtick form is the one that matters. It is CommonMark's own way of
showing a fenced block inside a fenced block — what any markdown-tooling corpus
writes when documenting its own conventions. The pattern matches three of the four
opening backticks, closes on the inner opener, and leaves the example's `State:`
line standing.

## The direction that matters: this is a fail-open, not a false red

**Two earlier versions of this record got the direction wrong, in opposite ways.**
The first called the leaks a false red. The second said the fail-open fires when
you illustrate a _closed_ record. **Both are false**, and the second names the case
that provably does _not_ fire. Measured, on byte-identical records carrying two
undisposed boxes, closed in place:

| record's own state | the example shows         | findings |
| ------------------ | ------------------------- | -------- |
| `Fixed`            | nothing                   | 2        |
| `Fixed`            | `Draft` (an open record)  | **0**    |
| `Fixed`            | `Fixed` (a closed record) | 2        |
| `Draft`            | `Fixed`                   | 2        |

The fail-open needs a **closed** record illustrating an **open** one. The cause is
an asymmetry: `isDoneItem` (`packages/md/src/rules/ledger.ts:200-208`) calls
`findState` with **`terminalStates`** alone, while `headerStateViolation` (`:238`)
calls it with the full vocabulary. So the illustrated token knocks the record out
of the done population only if it is **non-terminal**.

What follows depends on where the record sits, and both branches were measured on
otherwise byte-identical records carrying two undisposed boxes:

| record placement                                                | without example | with a four-backtick example              |
| --------------------------------------------------------------- | --------------- | ----------------------------------------- |
| in a declared done-folder                                       | 2 findings      | false RED added (`state-folder-mismatch`) |
| **closed in place, or a folder `doneFolders` does not declare** | **2 findings**  | **0 findings**                            |

The second row is this record. `isDoneItem`
(`packages/md/src/rules/ledger.ts:200-208`) classifies by folder **or** terminal
state; with the folder path unavailable, the misread state is the only input, and
the boxes are never selected. `ledgerStats` corroborates rather than exposes it —
it reports a readable state, because it read the example's.

### A second fail-open, after an unclosed fence

Found by the testing lens and reproduced here. An **unclosed fence in the
preamble** produces a green by the mirror-image route:

````text
# 0001 x

```md
an example with no closer

**State:** Fixed

## Tasks

- [ ] box
````

Measured on `main` with `states: ['Draft', 'Fixed']`, `terminalStates: ['Fixed']` and `closeInPlace: true`. The control drops the fence and example lines.

| document       | findings                    | readable state | done | commonmark.js                  |
| -------------- | --------------------------- | -------------- | ---- | ------------------------------ |
| control        | `ledger/silent-open-box` @7 | 1              | 1    | 1 list item, 0 code blocks     |
| unclosed fence | **none**                    | 1              | 1    | **0 list items, 1 code block** |

By CommonMark, an unclosed fence runs to the end of the document, so the State line and the box are both code. `collectTaskItems` reaches boxes through **mdast**, which agrees and finds no box. `findState`'s regex finds no closer, strips nothing, and reads the State line out of the code, so the record _is_ classified done. Nothing is left to report on a record the gate believes is done.

**An earlier version of this section said `findState` reads the record's own state correctly, and blamed mdast for swallowing the box. The attribution was inverted:** mdast is right, and the regex is the reader that departs from CommonMark.

**So the two halves of this one preset read the same document with two parsers
that disagree about where a fence ends** — a regex in `findState`, mdast in `collectTaskItems` — and in both routes the regex is the one that departs from CommonMark:

- route A: the regex reads an example State line inside a fence as prose, so the record is not classified done and its boxes go unchecked;
- route B: the regex reads a State line after an unclosed fence as prose, so a record whose box is code is classified done with nothing to check.

That disagreement is the root, and it is why
[0287](./0287-four-copies-of-one-fence-lexer-across-three-packages.md) is not
merely about duplication: the hand-rolled copy contradicts the parser the same
preset already runs.

`closeInPlace` is a documented option, and any lane whose folder is not in
`doneFolders` reaches the same branch, which is the situation
[0282](../rejected/0282-the-kit-teaches-a-state-vocabulary-its-own-gate-rejects.md)'s
successor territory and [0284](../0284-a-declared-vocabulary-disjoint-from-its-terminal-set-turns-the-gate-off.md)
are both about. The three records share one shape: **a configuration or a document
can make the close checks select nothing, and the gate reports a clean pass.**

## Nothing tests the guard, anywhere

_As of 0.6.0. Since the fix, the test file and `scripts/nonvacuity/bad-ledger-fences/` put a `State:` line
in a fence, and gutting the reading turns them red._

Gut `stripFencedCode` to `return s` and:

- the markdown package suite passes — 12 files, 119 tests;
- the whole repository suite is byte-identical before and after;
- all three real lanes produce zero findings either way.

Zero of the corpus's documents carry a fenced `State:` or `Deferred:` line inside
the scanned header region, so **the guard has never done work in this repo**. An
earlier version of this record called the behaviour "load-bearing"; it is
load-bearing by design intent and exercised by nothing.

The three existing fence tests (`packages/md/tests/rules/ledger.test.ts:46`, `:53`,
`:82`) cover the **task-box** path, which reaches fences through mdast — a
different code path. That path handles all seven shapes as CommonMark does. **A later version of this record retracted that as "six of seven", saying mdast loses the real box after an unclosed fence. The retraction was wrong:** by CommonMark that box is code, as measured above. No
fixture anywhere puts a `State:` line in a fence.

That combination is the finding: a documented behaviour, with a fail-open in it,
that no test can see.

## The corruption that must produce a violation

1. **The fail-open, both routes.** A record with a terminal state and an undisposed box must be reported whether or not it also contains a fenced example of a state line (route A). A record whose State line and box follow an unclosed fence must not pass silently (route B); by CommonMark both are code, so the finding is about the document, not the box. Two fixtures, because a fix for one does not touch the other.
2. **The guard.** Gutting `stripFencedCode` must fail something.

**Both call sites, not one.** `stripFencedCode` is called twice in this file —
`packages/md/src/rules/ledger.ts:175` in `findState` and `:303` in
`deferredNoneLieViolation`, whose own comment names an illustrative
`Deferred: none` as the thing it guards against. An earlier version of this record
specified a fixture for the first only.

**The fixture constraint, stated precisely — third attempt.** Three conditions, all
required. Each earlier version of this record stated a strict subset:

1. a **leaking shape** — four-backtick _wrapping an inner fence_, unclosed, or
   four-space indented. A plain fence is stripped correctly.
2. the illustrative token must precede the record's **own `State:` line**, because
   `findState` returns at the first readable token.
3. the illustrative token must be **non-terminal** under `terminalStates`, per the
   asymmetry above.

A fixture meeting (1) and (2) while showing a terminal token yields two findings
with the guard and two without. **Four hollow fixtures were built against this
record's successive specifications** — by two reviewers, by this record's author,
and by a third reviewer against the corrected version — before (3) was stated.

**The shape that reaches this in the wild is this repo's own board.** `BUGS.md`
publishes a template state line leading with a non-terminal token; copying it into
a record as documentation supplies condition (3) for free:

| the house template line, carried in…        | findings |
| ------------------------------------------- | -------- |
| a plain fence                               | 2        |
| a four-backtick fence wrapping an inner one | **0**    |
| a four-space indented block                 | **0**    |

## Non-vacuity

`scripts/nonvacuity/bad-ledger.mjs:42-47` asserts the four `ledger/*` ids fire and
reads nothing else. It cannot see this: corruption 1 is a finding that fails to
appear. A new `scripts/check-nonvacuity.mjs` registry row is required, with a
`mustSay` token only this check can print.

## Fix

1. Handle the leaking shapes, or stop hand-rolling the lexer — see
   [0287](./0287-four-copies-of-one-fence-lexer-across-three-packages.md), which
   owns that decision and has a fixed precedent. **Repairs route A only.**
2. **Own the unclosed fence directly** — report an unterminated fence as its own finding. **This record owns that fix.** [0288](./0288-a-four-backtick-fence-swallows-a-proposals-ruling-and-the-gate-agrees.md) once proposed it for its own reproduction and retracted it there, and [0287](./0287-four-copies-of-one-fence-lexer-across-three-packages.md)'s option (4) is the same finding.
3. The fixtures — one per route, with the three conditions above.
4. The non-vacuity rows — **two, not one**: the routes are independent and a fix
   for one does not touch the other, so a single row leaves half the record
   unguarded.

**An earlier version said this record closes on (1)+(3)+(4) whichever way 0287 is
decided. That was false, and a reviewer proved it by building the fix.** Widening
the pattern repaired route A completely and left route B at zero findings. Route B's box is code by CommonMark, so no correct reader produces it, and the same run left the document with no readable state and still no finding. Item 2 is
therefore load-bearing, and without it this record's stated closing condition could
never be met.

## Fixed

[0287](./0287-four-copies-of-one-fence-lexer-across-three-packages.md) was ruled on 2026-09-19 by the
library author: one owner, in the dialect, reading prose on the markdown parser it already runs, and a
finding for an unterminated fence. This record's half is built; the line numbers elsewhere in this
record, the ledger's included, cite 0.6.0 (`72d629a`):

- `packages/md/src/model/prose.ts` owns the reading. `proseText` blanks every **code block** by mdast —
  fenced with any run of backticks or tildes, or indented — and keeps the line count.
- **HTML blocks are read as before.** An HTML block can hold a record's real claim as well as an example
  of one: setting them aside made a real `State:` line inside a `<div>` or `<details>` unreadable, and the
  record passed with nothing checked — measured, and caught by both reviews of the first version of this
  fix. Which HTML to set aside is [0293](../0293-an-example-inside-an-html-block-is-read-as-prose.md)'s
  question, and this fix leaves it open.
- Both ledger call sites read through it — `findState` and `deferredNoneLieViolation` — so the `State:` scan
  and the task-box pass read code blocks with one parser. `findState` takes the parsed tree as an optional
  third argument; its two-argument form is unchanged.
- **Route B, for fences:** `ledger/unterminated-fence` reports a fenced block that has no closing fence and
  runs to the end of the document, at its opening line. Whether a fence closed is read off the parser: a
  closed fence spans its opener, its content and its closer. A closer CommonMark does not accept — behind a
  tab, four spaces or `>` — does not close it, and a fence its container closes is not reported. The finding
  names where to close it, in its `Fix:` line.
- **Not covered:** an HTML block that never closes, such as an `<!--` running to the end, still hides a
  State line or boxes silently, as it did on 0.6.0; 0293 records it.
- **A State line that is itself code — beyond the ruling.** Four spaces of indent make a code block, so a
  record whose own `State:` line is indented that way was read on 0.6.0 and states nothing by CommonMark.
  Rather than pass it with nothing checked — a silence the review of this fix's second version found —
  `ledger/state-in-code` reports a document whose header has a `State:` line only inside a code block,
  at the first such line. 0287's ruling named one new finding, the fence; this second one is the
  builder's, for the library author to accept or refuse at merge.
  - The header ends at the prose's second heading. The first build counted a `##` comment in a code block
    as a heading, which ended the search above an indented State line and turned the record green where
    0.6.0 reported its box — found by the second round of review, measured, and pinned.
  - It also reports a document that is not a record — a guide in the lane showing the template in a code
    block, green on 0.6.0 — since the gate cannot tell the two apart. The `Fix:` line names each case:
    un-indent or un-fence the record's own line, keep an example and add the real line, or name a
    non-record in `boardFiles`.
  - A fence that never closes is reported alone; a State line still in code once it is closed is reported
    on the next run.

Measured on 0.6.0 against the fix, a closed-in-place record with one silent box and an example of the
house template's `Draft` State line before its own:

| example shape                        | 0.6.0 | fixed |
| ------------------------------------ | ----- | ----- |
| none (control)                       | 1     | 1     |
| four-backtick fence wrapping a fence | **0** | 1     |
| four-tilde fence wrapping a fence    | **0** | 1     |
| four-space indented block            | **0** | 1     |

A real State line inside `<div>` or `<details>` reports the box on 0.6.0 and on the fix. An indented
own State line reports the box on 0.6.0 and `ledger/state-in-code` on the fix, with or without a `##`
comment in a code block above it. Over this repo's
own corpus at the fix's head, 0.6.0's ledger and the fix's print the same: 126 done-items across 276
records, all 276 readable, 0 findings.

**Note, 2026-09-19 (PR #145).** This fix read a fence written **inside an HTML block** as prose: CommonMark
reads such a fence as raw HTML, so the parser has no code node for it, and 0.6.0's regex — which was
textual — blanked it. Measured in PR #145's enforcement review: a fenced `Draft` example inside
`<details>` or `<div>`, above a closed record's own State line, became the record's state, and its silent
box went unreported where 0.6.0 reported it. Fixed in PR #145: the owner sets aside a closed fence inside
an HTML block too, in both readings, and a test here pins it. eess-md had not shipped either version.

## Verification ledger

- [x] Seven shapes probed; the three leaks reproduced.
- [x] Both direction branches measured on byte-identical records: 2→0 closed in
      place, 2→false-red in a done-folder.
- [x] Sabotage: markdown suite, whole-repo suite and all three real lanes are
      byte-identical with the guard gutted.
- [x] Confirmed zero corpus documents exercise the guard.
- [x] Confirmed the three existing fence tests cover the task-box path only.
- [x] **Corrected a false retraction.** An earlier box here said mdast handles six of seven shapes. On the unclosed fence, mdast agrees with commonmark.js (0 list items, 1 code block); the regex is the reader that departs.
- [x] Confirmed the ordering constraint by building the hollow fixture and
      watching it pass.
- [x] Reproduced the second fail-open: after an unclosed fence in the preamble, `findState` reads a State line CommonMark calls code, and the record passes as done with no box found.
- [x] Confirmed two call sites, `:175` and `:303`.
- [x] Red first (1a): the regex route — a closed-in-place record with a
      four-backtick example and an undisposed box must still report —
      `packages/md/tests/rules/ledger-reads-prose-as-commonmark.test.ts` ·
      `it('a closed record reports its silent box whatever example of a State line it shows')`, red on
      0.6.0.
- [x] Red first (1b): route B — the document above must not pass silently —
      `it('a fence that never closes is reported, since the State line and box after it are code')`, red
      on 0.6.0, with `it('a fence its list item closes is not reported, and the record after it is read')`
      as its boundary.
- [x] The `deferredNoneLieViolation` call site gets the same treatment —
      ``it('an example of `Deferred: none` does not contradict a real deferral, and a real one still does')``,
      red on 0.6.0.
- [x] Red first (2): the guard fixture, with the illustrative token preceding the
      record's own — the shapes test above places each example before the record's State line, and it
      is red on 0.6.0 and green on the fix.
- [x] **Falsified this record's own closing condition** — a reviewer applied fix (1)
      and route B stayed at zero findings, with `withReadableState` dropping to 0
      while `doneItems` stayed 1 by folder.
- [x] The `check-nonvacuity.mjs` registry rows — one per route: `corpus/ledger/fenced-example`,
      `corpus/ledger/unterminated-fence` and `corpus/ledger/state-in-code`, each running
      `scripts/nonvacuity/bad-ledger-fences.mjs` for its own route alone; each route exits 0 (silent) on
      0.6.0's ledger and 1 on the fix.

- [x] Inline HTML and inline code on a State line stay prose, so the line is still read —
      `it('a State line carrying inline HTML or inline code is still the record’s own')`.
- [x] The review's pins: `it('an HTML block is read as it was, so a real State line inside one is still the record’s own')`,
      `it('a fence is closed only by a closer CommonMark accepts, at the end of the document too')` and
      `it('a fence its list item closes does not hide the list item after it')`, and
      `it('a record whose only State line is inside a code block is reported, not passed')` for
      `ledger/state-in-code`, with
      `it('a document that shows a State line only in code is reported, and naming it a board file clears it')`
      for a non-record and its remedy.
- [x] Sabotage matrix in the worktree, sources restored by sha256 and the tree unchanged, fourteen rows
      and an as-built control that fails nothing: prose
      blanking nothing turns the shapes and `Deferred` tests red; no fence finding, the fence and closer
      tests; a fence reported short of the end, the list-item boundary; `findState` or the `Deferred`
      check reading raw text, their tests; HTML blocks set aside, the HTML test; every fence at the end
      reported, the closer test; a block's end read as inclusive, the list-item-after-fence test; closing
      off by one, the closer test; no state-in-code finding, its test; a `##` line in code counted as a
      heading, the state-in-code test; an indented block checked for a closer, an empty fence counted as a
      line, or an opener read from column 1, the closer test.

Deferred: none.

## Related

- [0287](./0287-four-copies-of-one-fence-lexer-across-three-packages.md) — who
  owns the lexer. Split out of this record: a decision, not a defect.
- [0284](../0284-a-declared-vocabulary-disjoint-from-its-terminal-set-turns-the-gate-off.md)
  — the same fail-open shape reached through configuration rather than content.
- [0283](../0283-ledger-findings-name-no-remedy-and-one-names-a-false-cause.md) —
  same file, same fixture, same non-vacuity gap.
- [0087](../0087-frontmatter-parsed-as-setext-heading.md) — the other open record
  where this dialect's hand-rolled markdown reading gets a CommonMark shape wrong.
  It also _contains_ a fenced `State:` example, so the shape is in this corpus.
- [rejected/0282](../rejected/0282-the-kit-teaches-a-state-vocabulary-its-own-gate-rejects.md)
  — the wrong turn that surfaced this, kept for that reason.
