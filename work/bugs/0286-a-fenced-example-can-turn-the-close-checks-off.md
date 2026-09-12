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

| shape                                   | guard |
| --------------------------------------- | ----- |
| plain triple-backtick fence             | holds |
| tilde fence                             | holds |
| fence indented inside a list item       | holds |
| tilde outer wrapping a backtick example | holds |
| **four-backtick outer fence**           | leaks |
| **unclosed triple-backtick fence**      | leaks |
| **four-space indented block, no fence** | leaks |

The four-backtick form is the one that matters. It is CommonMark's own way of
showing a fenced block inside a fenced block — what any markdown-tooling corpus
writes when documenting its own conventions. The pattern matches three of the four
opening backticks, closes on the inner opener, and leaves the example's `State:`
line standing.

## The direction that matters: this is a fail-open, not a false red

**An earlier version of this record called the leaks a false red.** That is true
only when the example shows a token _outside_ the vocabulary. The likely case is
the opposite — you illustrate a _closed_ record — and then `findState` returns a
**readable** state and the gate believes it.

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
different code path that handles all seven shapes above correctly. No fixture
anywhere puts a `State:` line in a fence.

That combination is the finding: a documented behaviour, with a fail-open in it,
that no test can see.

## The corruption that must produce a violation

1. **The fail-open.** A record with a terminal state and an undisposed box must be
   reported, whether or not it also contains a fenced example of a state line.
2. **The guard.** Gutting `stripFencedCode` must fail something.

**The fixture constraint, stated precisely.** An earlier version said the fence
must sit "inside the scanned region — before the second `##`". Necessary and
**not sufficient**: `findState` returns at the _first_ readable token, so the
illustrative token must also come **before the record's own `State:` line**. The
house template puts the real state immediately under `## Status`, so a fixture
written the natural way passes while testing nothing. Two reviewers and this
record's author each built the hollow fixture before noticing.

## Non-vacuity

`scripts/nonvacuity/bad-ledger.mjs:42-47` asserts the four `ledger/*` ids fire and
reads nothing else. It cannot see this: corruption 1 is a finding that fails to
appear. A new `scripts/check-nonvacuity.mjs` registry row is required, with a
`mustSay` token only this check can print.

## Fix

1. Handle the three leaking shapes, or stop hand-rolling the lexer — see
   [0287](./0287-four-copies-of-one-fence-lexer-across-three-packages.md), which
   owns that decision and has a fixed precedent.
2. The fixture, with the ordering constraint above.
3. The non-vacuity row.

This record closes on (1)+(2)+(3) whichever way 0287 is decided: if 0287 says
"consolidate", this record's fix is to call the consolidated one.

## Verification ledger

- [x] Seven shapes probed; the three leaks reproduced.
- [x] Both direction branches measured on byte-identical records: 2→0 closed in
      place, 2→false-red in a done-folder.
- [x] Sabotage: markdown suite, whole-repo suite and all three real lanes are
      byte-identical with the guard gutted.
- [x] Confirmed zero corpus documents exercise the guard.
- [x] Confirmed the three existing fence tests cover the task-box path only, and
      that mdast handles all seven shapes correctly.
- [x] Confirmed the ordering constraint by building the hollow fixture and
      watching it pass.
- [ ] Red first (1): the fail-open — a closed-in-place record with a four-backtick
      example and an undisposed box must still report.
- [ ] Red first (2): the guard fixture, with the illustrative token preceding the
      record's own.
- [ ] The `check-nonvacuity.mjs` registry row.

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
