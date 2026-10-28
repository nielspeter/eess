# Bug 0554: a ledger test named for a document with no State line reads one that has a State line

## Status

- **State:** Draft — found 2026-10-28 by the testing re-check of PR #274; read, not yet fixed.
- **Severity:** Low — a test that cannot fail for the reason its title gives; the behaviour it
  names may hold, but nothing checks it.
- **Origin:** self-found, 2026-10-28, while PR #274 translated the ledger fixtures out of Danish.
  Recorded rather than fixed there: the translation kept every fixture's meaning, and this test
  read the wrong fixture before it (since PR #45, 2026-08-12).
- **Reported:** 2026-10-28

## Symptom

`packages/md/tests/rules/ledger.test.ts:155` is titled
`it('says nothing about a document with no State line at all')`, and runs `honestyAtClose`
over `guard-blockquote.md`. That fixture's third line is a State line:

```text
**State:** Done — geliefert in PR #1002
```

So the test proves that a document with a readable terminal State raises no
`ledger/unknown-state`, which is true for a different reason. A change that made a stateless
document report `ledger/unknown-state` would leave it green.

The nearest real coverage is
`packages/md/tests/rules/ledger-reads-the-callers-label.test.ts`'s
`it('a call whose documents carry no state at all is one finding, with a remedy from the options')`,
which reads a lane where **every** document is stateless (`ledger/no-readable-state`). Nothing
reads one stateless document beside documents that carry a State.

## Fix

A fixture with no State line, read beside one that has a State, asserting no
`ledger/unknown-state` for it; then a sabotage that makes a missing State report
`ledger/unknown-state`, which must turn the row red.

## Verification

- [ ] The row reads a document with no State line, and the sabotage turns it red.
