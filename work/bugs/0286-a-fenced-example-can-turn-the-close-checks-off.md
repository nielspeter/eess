# Bug 0286: a fenced example of a `State:` line can turn the close checks off, and nothing tests the guard that should prevent it

## Status

- **State:** Draft — measured; no red test yet.
- **Severity:** **High** — a **fail-open**. A record that documents its own close
  convention, in the shape CommonMark provides for exactly that, loses every
  silently-open box the gate exists to catch. Measured: two findings become zero.
- **Origin:** self-found · surfaced while checking a claim in
  [rejected/0282](./rejected/0282-the-kit-teaches-a-state-vocabulary-its-own-gate-rejects.md);
  the fail-open direction was found by an adopter-lens reviewer who ran the kit
- **Reported:** 2026-09-12

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

### A second fail-open, by the opposite mechanism

Found by the testing lens and reproduced here. An **unclosed fence in the
preamble** produces a green by the mirror-image route:

| document                       | state read   | boxes found  | verdict   |
| ------------------------------ | ------------ | ------------ | --------- |
| plain                          | `Fixed`, l.5 | 1 undisposed | reports   |
| unclosed fence in the preamble | `Fixed`, l.8 | **none**     | **GREEN** |

Here `findState` reads the record's **own** state correctly and the record _is_
classified done. What vanishes is the box: `collectTaskItems` reaches fences
through **mdast**, which parses an unclosed fence as code to the end of the
document and swallows every `- [ ]` after it. Nothing is left to report.

**So the two halves of this one preset read the same document with two parsers
that disagree about where a fence ends** — a regex in `findState`, mdast in
`collectTaskItems` — and _either_ direction of disagreement yields a silent green:

- regex over-strips or misreads → the record is not classified done → boxes unchecked;
- mdast over-strips → the boxes are gone → nothing to check.

That disagreement is the root, and it is why
[0287](./0287-four-copies-of-one-fence-lexer-across-three-packages.md) is not
merely about duplication: the hand-rolled copy contradicts the parser the same
preset already runs.

`closeInPlace` is a documented option, and any lane whose folder is not in
`doneFolders` reaches the same branch, which is the situation
[0282](./rejected/0282-the-kit-teaches-a-state-vocabulary-its-own-gate-rejects.md)'s
successor territory and [0284](./0284-a-declared-vocabulary-disjoint-from-its-terminal-set-turns-the-gate-off.md)
are both about. The three records share one shape: **a configuration or a document
can make the close checks select nothing, and the gate reports a clean pass.**

## Nothing tests the guard, anywhere

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
different code path. **An earlier version of this record claimed that path handles
all seven shapes correctly. Measured, it is six of seven** — an unclosed fence
makes mdast swallow to end of document and lose the **real** box, which is this
record's own second route, and is why no fence-lexer change can repair it. No
fixture anywhere puts a `State:` line in a fence.

That combination is the finding: a documented behaviour, with a fail-open in it,
that no test can see.

## The corruption that must produce a violation

1. **The fail-open, both routes.** A record with a terminal state and an undisposed
   box must be reported, whether or not it also contains a fenced example of a
   state line (regex route) **and** whether or not an unclosed fence precedes the
   box (mdast route). Two fixtures, because the mechanisms are opposite and a fix
   for one does not touch the other.
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
2. **Own the unclosed fence directly** — report an unterminated fence as its own
   finding, per [0288](./0288-an-unpaired-fence-swallows-a-proposals-ruling-and-the-gate-agrees.md).
   **Route B needs this and nothing else reaches it.**
3. The fixtures — one per route, with the three conditions above.
4. The non-vacuity rows — **two, not one**: the routes are independent and a fix
   for one does not touch the other, so a single row leaves half the record
   unguarded.

**An earlier version said this record closes on (1)+(3)+(4) whichever way 0287 is
decided. That was false, and a reviewer proved it by building the fix.** Widening
the pattern repaired route A completely and left route B at zero findings, because
route B is the markdown parser never emitting the box — no lexer change restores a
node that was never produced. Routing the state scan through mdast instead does not
help either: mdast loses the state line the same way it loses the box. Item 2 is
therefore load-bearing, and without it this record's stated closing condition could
never be met.

## Verification ledger

- [x] Seven shapes probed; the three leaks reproduced.
- [x] Both direction branches measured on byte-identical records: 2→0 closed in
      place, 2→false-red in a done-folder.
- [x] Sabotage: markdown suite, whole-repo suite and all three real lanes are
      byte-identical with the guard gutted.
- [x] Confirmed zero corpus documents exercise the guard.
- [x] Confirmed the three existing fence tests cover the task-box path only.
- [x] **Falsified this record's own claim that mdast handles all seven shapes** —
      measured six of seven; an unclosed fence loses the real box.
- [x] Confirmed the ordering constraint by building the hollow fixture and
      watching it pass.
- [x] Reproduced the second fail-open: an unclosed fence in the preamble makes
      mdast swallow the boxes while `findState` reads the real state past it —
      green on a done record with an undisposed box.
- [x] Confirmed two call sites, `:175` and `:303`.
- [ ] Red first (1a): the regex route — a closed-in-place record with a
      four-backtick example and an undisposed box must still report.
- [ ] Red first (1b): the mdast route — a done record with a preamble unclosed
      fence and an undisposed box must still report.
- [ ] The `deferredNoneLieViolation` call site gets the same treatment.
- [ ] Red first (2): the guard fixture, with the illustrative token preceding the
      record's own.
- [x] **Falsified this record's own closing condition** — a reviewer applied fix (1)
      and route B stayed at zero findings, with `withReadableState` dropping to 0
      while `doneItems` stayed 1 by folder.
- [ ] The `check-nonvacuity.mjs` registry rows — one per route.

Deferred: none.

## Related

- [0287](./0287-four-copies-of-one-fence-lexer-across-three-packages.md) — who
  owns the lexer. Split out of this record: a decision, not a defect.
- [0284](./0284-a-declared-vocabulary-disjoint-from-its-terminal-set-turns-the-gate-off.md)
  — the same fail-open shape reached through configuration rather than content.
- [0283](./0283-ledger-findings-name-no-remedy-and-one-names-a-false-cause.md) —
  same file, same fixture, same non-vacuity gap.
- [0087](./0087-frontmatter-parsed-as-setext-heading.md) — the other open record
  where this dialect's hand-rolled markdown reading gets a CommonMark shape wrong.
  It also _contains_ a fenced `State:` example, so the shape is in this corpus.
- [rejected/0282](./rejected/0282-the-kit-teaches-a-state-vocabulary-its-own-gate-rejects.md)
  — the wrong turn that surfaced this, kept for that reason.
