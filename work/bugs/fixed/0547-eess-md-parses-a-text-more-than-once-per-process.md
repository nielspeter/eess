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

Count the calls to the parser during one run of each gate, as
[spike 0546](../../spikes/0546-where-a-corpus-check-spends-its-time.md) §2 does: calls far exceed
distinct texts. `packages/md/tests/parse-memo-wiring.test.ts` counts them at `fromMarkdown` through
the public entry points: two corpora and `findState` without its tree, over one text, parse it once.

## Root cause

`parseMarkdown` had no memory. Every `corpus()` parsed each file it read, and `proseText` and
`unclosedFences` (now `packages/md/src/model/prose.ts:210` and `packages/md/src/model/prose.ts:232`)
parsed whenever no tree was handed to them, which reaches adopters through the public `findState`
(`packages/md/src/rules/ledger.ts:297`). A second corpus over the same files, which an adopter with
several rule files builds, parsed them all again.

## Fix

As [spike 0546](../../spikes/0546-where-a-corpus-check-spends-its-time.md) decided, from the architect's
and the enforcement review:

- A memo, `packages/md/src/model/parse-memo.ts`, handed the parse; one instance, private to
  `packages/md/src/model/prose.ts`. On a miss it parses (after the front-matter fallback, the only
  parse it is handed), deep-freezes, and keeps the result as the master, which never leaves
  `prose.ts`.
- The readers called without a tree read the master; `parseMarkdown`
  (`packages/md/src/model/prose.ts:66`) returns a `structuredClone` of it, so every `MdDocument` owns
  its own mutable tree, as before.
- Key: a sha1 of the text, then the stored text compared exactly.
- Bound: total stored text length, 2^24 characters (about 210 MB of trees at the 12.5 bytes a
  character the code review measured), least recently used evicted first; a text over the bound is
  parsed and not stored; a parse that throws stores nothing. Reset registered with
  `registerCacheReset`.
- `scripts/lib/finished-not-closed.mjs:151` passes the tree it holds: the same defect, at its caller.
- A patch changeset for `@nielspeter/eess-md`: nothing an adopter can observe changes.

## Verification

Tests in `packages/md/tests/parse-memo.test.ts` and `packages/md/tests/parse-memo-wiring.test.ts`.
Red before the fix were the memo tests (no memo existed) and the wiring test (three parses where one
is expected); the isolation guards were green before and after, and exist to go red on a wrong memo.
Each test was run against its sabotage once, in the main checkout, each mutant applied to `src`
and the files restored and compared (`cmp`) after. M9–M18 are the code review's findings: the first
round of tests built their own memo, so the memo wired into `prose.ts` could be switched off with
every test green.

| sabotage                                             | red                                         |
| ---------------------------------------------------- | ------------------------------------------- |
| M1 the key is the text's length, no text compared    | T1, T2, the shared key, the bound           |
| M2 `corpus()` caches by path and length              | T2, the reset                               |
| M3 the memo is handed the parse before the fallback  | T3, the reader without a tree               |
| M4 the master handed out, unfrozen                   | T4, the frozen master, the bound, the reset |
| M5 a text over the bound gives an empty root         | T5                                          |
| M6 no bound                                          | the bound                                   |
| M7 the master not frozen                             | the frozen master                           |
| M8 the memo never hits                               | the wiring, the reset, the frozen master    |
| M9 the memo in `prose.ts` holds nothing (bound 0)    | the wiring, the reset                       |
| M10 `parseMarkdown` and the readers bypass the memo  | the wiring, the reset                       |
| M11 the reset not registered with the kernel         | the reset                                   |
| M12 an evicted text's length not subtracted          | the bound                                   |
| M13 a hit not refreshed (oldest first, not LRU)      | the bound                                   |
| M14 a reader's default tree is the first pass        | the wiring, the reader without a tree       |
| M15 the master frozen one level deep                 | the frozen master                           |
| M16 the bound off by one                             | the bound, the memo's reset                 |
| M17 a reset memo keeps its held length               | the memo's reset                            |
| M18 `corpus()` caches by path and mtime (real files) | T2                                          |

- [x] T1, the exact key: two texts of one length sharing a 5,000-character prefix get their own
      trees (a heading, a list).
- [x] T2, a changed file: a file rewritten to other text of the same length, with the same mtime
      set on both writes, is read anew by the next `corpus()`.
- [x] T3, after the fallback: two files holding `---\n- [ ] a\n---\n` both report their open box.
- [x] The reader without a tree: `findState` over a line-1 block that is not front matter reads it
      as the corpus does, with and without the tree.
- [x] T4, isolation: two documents of one text get distinct trees; editing one changes neither the
      other, nor a fresh corpus of the text, nor `proseText` of it.
- [x] T5, over the bound: a text longer than the bound still parses whole, and is not kept.
- [x] A collision: with a constant key, each text still gets its own tree.
- [x] The bound: texts up to it exactly are held, the least recently used is evicted, an evicted
      text reparses to an equal tree; a reset memo holds a full bound again.
- [x] A frozen master: every object in it frozen, and a write throws `TypeError`.
- [x] The wiring: two corpora and `findState` without its tree parse one text once; the kernel's
      `clearRegisteredCaches()` makes it parse again.
- [x] Each test red against its sabotage: the table above.
- [x] Measured after, on this machine against `main` at 62473535 (spike §2):

  | run            | parses before | parses after | time before | time after |
  | -------------- | ------------- | ------------ | ----------- | ---------- |
  | `check:corpus` | 1,148         | 593          | 9.71 s      | 5.9–6.1 s  |
  | `check:ledger` | 1,946         | 505          | 12.54 s     | 5.1 s      |

  Copies handed to `corpus()` documents: 602 and 1,481. The eess-md suite: 796 tests, green, in
  10 s, so no reader writes to a frozen master. On CI, the same 240 non-vacuity fixtures took 26.2
  minutes of row time against 37.8 on `main`; the corpus rows 13.6 against 23.2.

- [x] Code review (enforcement and testing lenses) of the PR: the code was judged correct and
      fail-closed (a 120,000-call fuzz against a reference found no wrong tree); both found the
      wiring untested, fixed by M9–M18 above.
- [x] A patch changeset for `@nielspeter/eess-md` (`.changeset/parse-each-text-once.md`); full
      `npm run validate` green before the commit, its exit code and time in the PR description.

## Residual, accepted

- A long-running process that uses eess-md without eess-ts has no public way to free the memo's
  trees (up to about 210 MB); only eess-ts's `resetProjectCache()` reaches the kernel's reset. Memory
  only, never a verdict.
- "A parse that throws keeps nothing" holds by construction and was confirmed by the review's fuzz;
  no test throws a parse.
