# Bug 0286: the fence guard that keeps illustrative records honest has no test, and leaks two ways

## Status

- **State:** Draft — measured by sabotage and by probe; no red test yet.
- **Severity:** Medium — two halves. The **untested** half is a live vacuity gap:
  gut the guard and nothing in the repo notices. The **leaking** half is a false
  red on documentation that shows an example.
- **Origin:** self-found · surfaced while checking a claim in
  [rejected/0282](./rejected/0282-the-kit-teaches-a-state-vocabulary-its-own-gate-rejects.md),
  which reached a right verdict through this mechanism without the mechanism doing
  any work
- **Reported:** 2026-09-12

## Symptom

### 1. Nothing holds it

`stripFencedCode` (`packages/md/src/rules/ledger.ts:157-159`) blanks fenced code
before the state scan, so an illustrative `**State:** Done` inside a fenced example
is not mistaken for the document's own state. Its comment says exactly that
(`:155-156`), and `docs/markdown.md:466-468` sells fence handling as one of the
things `findState` gets right.

Measured. Replace its body with `return s` and run the whole markdown suite:

```
Test Files  12 passed (12)
      Tests  119 passed (119)
```

Nothing fails. The three fence tests that exist
(`packages/md/tests/rules/ledger.test.ts:46`, `:53`, `:82`) all cover the
**task-box** side, which reaches fences through mdast — a different code path.
**No fixture anywhere puts a `State:` line inside a fence.**

This is a documented, load-bearing behaviour with no ground truth. A rewrite that
dropped it would ship green.

### 2. It leaks on two shapes markdown actually uses

`FENCE_RE` (`packages/md/src/rules/ledger.ts:153`) is
`/(```|~~~)[\s\S]*?\1/g` — it requires a matching closer and knows nothing about
indented code blocks. Measured against `findState`, with the illustrative token in
the header region:

| example shape                 | illustrative token             |
| ----------------------------- | ------------------------------ |
| closed ` ``` ` fence          | ignored ✓                      |
| closed `~~~` fence            | ignored ✓                      |
| **unclosed ` ``` ` fence**    | **read as the record's state** |
| **four-space indented block** | **read as the record's state** |

Both leaks return a token with no recognised state, so the document reports
`ledger/unknown-state` — a false red, on a record whose only offence is showing an
example the way CommonMark permits.

## Why this surfaced now

A withdrawn record claimed two of this repo's own bug files stay green because
their out-of-vocabulary `State: Done` tokens sit inside fences. The verdict was
right and the mechanism was not: `findState` returns at the first readable token,
line 5 in both files, and breaks at the second `##`, so the fenced lines are never
reached. Deleting the fence markers changes nothing; sabotaging the stripper
changes nothing.

The reasoning was wrong in a way no gate could catch, because the thing it
reasoned about is untested. That is the finding, and it is why this record exists
rather than the exculpation being quietly corrected.

## The corruption that must produce a violation

Two, and they want different fixtures.

1. **Gutting the guard must fail something.** A record whose header region carries
   a fenced illustrative `**State:** <terminal token>` must be classified by its
   _own_ state, not the example's. Today that assertion exists nowhere. The fixture
   has to place the fence **inside the scanned region** — before the second `##` —
   or it passes for the wrong reason, which is exactly how the withdrawn record
   went wrong.
2. **A leak must be reported as a leak.** An unclosed fence and an indented block
   must either be stripped, or produce a finding that names the shape rather than
   the token. Silently reading the example is the failure.

## Fix

Item 1 is a fixture and costs nothing but care about where the fence sits.

Item 2 has a prior question the library author owns: **should the ledger preset
own a fence lexer at all?** `stripFencedCode` is duplicated verbatim in
`packages/md/src/builders/vocabulary.ts:98-100`, and the dialect already parses
markdown through mdast for the task-box path, which handles both leaking shapes
correctly by construction. So the options are to widen the regex, or to stop having
one. The second is the ADR-012 shape — the kernel borrows a lexer it cannot own —
applied one level down.

## Non-vacuity

`scripts/nonvacuity/bad-ledger.mjs:42-47` asserts the four `ledger/*` ids fire and
reads nothing else. It cannot see either half of this: item 1 is an absence of a
finding, item 2 is a finding on the wrong subject. A registry row with its own
fixture is owed for whichever half ships.

## Verification ledger

- [x] Sabotaged `stripFencedCode` to `return s`; the full markdown suite passes,
      12 files and 119 tests. Restored and confirmed clean.
- [x] Confirmed the three existing fence tests all cover the task-box path.
- [x] Confirmed no fixture in the package puts a `State:` line inside a fence.
- [x] Probed all four shapes; the two leaks in the table above are measured, not
      read off the regex.
- [x] Confirmed the duplicate lexer in `builders/vocabulary.ts`.
- [ ] Red first (1): the guard fixture, with the fence inside the scanned region.
- [ ] Red first (2): the leaking shapes, once the prior question is answered.
- [ ] The prior question: widen the regex, or stop owning a lexer — **the library
      author's, not this record's.**

Deferred: none.

## Related

- [rejected/0282](./rejected/0282-the-kit-teaches-a-state-vocabulary-its-own-gate-rejects.md)
  — the wrong turn that surfaced this, kept for that reason.
- [0283](./0283-ledger-findings-name-no-remedy-and-one-names-a-false-cause.md) —
  the same file, the same fixture, and the same non-vacuity gap.
- [0114](./0114-string-literal-lexis-lives-outside-the-engine.md) — the prior
  instance of a dialect hand-rolling lexing its engine already does.
