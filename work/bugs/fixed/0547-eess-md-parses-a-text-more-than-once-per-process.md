# Bug 0547: eess-md parses a text more than once per process

## Status

- **State:** Fixed — 2026-10-25, the memo in `packages/md/src/model/parse-memo.ts`, used by `packages/md/src/model/prose.ts`, designed by
  [spike 0546](../../spikes/0546-where-a-corpus-check-spends-its-time.md). Deferred: none.
- **Severity:** Medium — no verdict is wrong; the cost is time, and it reds a build:
  PR #260's `check:nonvacuity` shard 2 was cancelled at its 20-minute limit. Every adopter that
  builds two corpora over the same files, or calls `findState` without a tree, pays it too.
- **Origin:** self-found, 2026-10-25, from PR #260's CI timeout and the maintainer's observation that
  every project running eess-md pays for its corpus checks.
- **Reported:** 2026-10-25

## Symptom

One `check:corpus` run on `main` parses 1,148 times for 575 distinct texts; one `check:ledger` run
parses 1,946 times for 502, and parsing is 12.0 s of its 12.5 s. A text already parsed in the same
process is parsed again from scratch.

## Reproduction

Count the calls to `parseMarkdown` (`packages/md/src/model/prose.ts:64`) during one run of each
gate, as [spike 0546](../../spikes/0546-where-a-corpus-check-spends-its-time.md) §2 does: calls far
exceed distinct texts. The red tests below pin the memo's behaviour, not a count, since a count of
calls is a test of an implementation.

## Root cause

`parseMarkdown` has no memory. Every `corpus()` parses each file it reads, and `proseText` and
`unclosedFences` (`packages/md/src/model/prose.ts:198`, `packages/md/src/model/prose.ts:220`) parse
whenever no tree is handed to them, which reaches adopters through the public `findState`
(`packages/md/src/rules/ledger.ts:297`). A second corpus over the same files, which an adopter with
several rule files builds, parses them all again.

## Fix

As [spike 0546](../../spikes/0546-where-a-corpus-check-spends-its-time.md) decided, from the architect's
and the enforcement review:

- A memo private to `packages/md/src/model/prose.ts`: on a miss, parse (after the front-matter
  fallback), deep-freeze, and keep the result as the master, which never leaves the module.
- The readers called without a tree read the master; `parseMarkdown` returns a `structuredClone` of
  it, so every `MdDocument` owns its own mutable tree, as today.
- Key: a sha1 of the text, then the stored text compared exactly.
- Bound: total stored text length, 2^24 characters, least recently used evicted first; a text over the
  bound is parsed and not stored; a parse that throws stores nothing. Reset registered with
  `registerCacheReset`.
- `scripts/lib/finished-not-closed.mjs:151` passes the tree it holds: the same defect, at its caller.
- A patch changeset for `@nielspeter/eess-md`: nothing an adopter can observe changes.

## Verification

Tests in `packages/md/tests/parse-memo.test.ts`. The four memo tests were red before the fix (no
memo to call) and green after; the four isolation guards were green before and after, and exist to
go red against a wrong memo. The memo is its own module, handed the parse, so it can keep only the
tree after the fallback. Each test was run against its sabotage once, in the main checkout, each
mutant applied to `src` and the files restored and compared (`cmp`) after:

| sabotage                                            | red                                     |
| --------------------------------------------------- | --------------------------------------- |
| M1 the key is the text's length, no text compared   | T1, T2, the shared key, the eviction    |
| M2 `corpus()` caches by path and length             | T2                                      |
| M3 the memo is handed the parse before the fallback | T3                                      |
| M4 the master handed out, unfrozen                  | T4, the frozen master, the eviction, T5 |
| M5 a text over the bound gives an empty root        | T5                                      |
| M6 no bound                                         | the eviction                            |
| M7 the master not frozen                            | the frozen master                       |
| M8 no memo                                          | the frozen master, the eviction         |

- [x] T1, the exact key: two texts of one length sharing a 5,000-character prefix get their own
      trees (a heading, a list).
- [x] T2, a changed file: a file rewritten to other text of the same length, its mtime restored, is
      read anew by the next `corpus()`.
- [x] T3, after the fallback: two files holding `---\n- [ ] a\n---\n` both report their open box.
- [x] T4, isolation: two documents of one text get distinct trees; editing one changes neither the
      other, nor a fresh corpus of the text, nor `proseText` of it.
- [x] T5, over the bound: a text longer than the bound still parses whole, and is not kept.
- [x] A collision: with a constant key, each text still gets its own tree; an evicted text reparses
      to an equal tree.
- [x] A frozen master: a write to it throws `TypeError`.
- [x] Each test red against its sabotage: the table above.
- [x] Measured after, on this machine against `main` at 62473535 (spike §2):

  | run            | parses before | parses after | time before | time after |
  | -------------- | ------------- | ------------ | ----------- | ---------- |
  | `check:corpus` | 1,148         | 593          | 9.71 s      | 5.9–6.1 s  |
  | `check:ledger` | 1,946         | 505          | 12.54 s     | 5.1 s      |

  Copies handed to `corpus()` documents: 602 and 1,481. The eess-md suite: 796 tests, green, in
  10 s, so no reader writes to a frozen master.

- [x] A patch changeset for `@nielspeter/eess-md` (`.changeset/parse-each-text-once.md`); full
      `npm run validate` green before the commit, its exit code and time in the PR description.
