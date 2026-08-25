# Bug 0099: two raw NUL bytes make `md-gherkin.ts` binary — invisible to `grep`/`rg` and unreviewable in `git diff`

## Status

- **State:** Fixed — the two bytes this record was filed for were fixed by
  [0144](./0144-md-gherkin-nul-bytes-break-grep.md), which re-found the
  same defect two days later and never knew this record existed. What was left
  open was the guard (box 1), and that is what closes it: `check:integrity`
  now reads every `packages/*/src/**/*.ts` as bytes and reds on a raw `0x00`.
- **Found on closing:** a THIRD instance, live in the tree — see _Closing_ below.
- **Fixed:** 2026-08-24 (PR #89)
- **Reported:** 2026-08-12 — self-found while verifying the bug reports filed
  from the [plan 0096](../../plans/completed/0096-dogfood-missing-crossvalidate-bindings.md)
  review, when repeated greps over the crossvalidate package returned nothing
  for a symbol that is plainly defined there.

## Symptom

`packages/crossvalidate/src/md-gherkin.ts` contains two literal `U+0000` bytes,
at lines 111 and 137. Every tool that classifies files by content therefore
treats a 168-line TypeScript source file as binary data:

```bash
$ file packages/crossvalidate/src/md-gherkin.ts
packages/crossvalidate/src/md-gherkin.ts: data

$ rg -n "scenarioCitationsResolve" packages/crossvalidate/src/
packages/crossvalidate/src/gherkin-ts.ts:104: * …the mirror image of `scenarioCitationsResolve`, whose
#  ← a passing mention in a comment in another file.
#    The definition, at md-gherkin.ts:102, is not listed.

$ git grep -n "scenarioCitationsResolve" -- packages/crossvalidate/src/
packages/crossvalidate/src/gherkin-ts.ts:104: * …the mirror image of …
Binary file packages/crossvalidate/src/md-gherkin.ts matches
#  ← knows there is a match; will not show it
```

The exported API of an entire dialect binding — `scenarioCitationsResolve`,
`scenarioCitationStats`, `ScenarioCitationsResolveOptions`, `ExtractedCitation`
— is unreachable by text search. `rg --text` finds it; nothing suggests to a
searcher that they need it.

The same classification makes the file's history unreviewable:

```bash
$ git show ae981b2 -- packages/crossvalidate/src/md-gherkin.ts
Binary files a/packages/crossvalidate/src/md-gherkin.ts and b/… differ

$ git show ae981b2 --stat -- packages/crossvalidate/src/
 packages/crossvalidate/src/md-gherkin.ts    | Bin 5912 -> 5983 bytes
 packages/crossvalidate/src/md-mermaid-er.ts |   8 ++++----
 packages/crossvalidate/src/md-mermaid.ts    |   9 +++++----
```

Its siblings show line-level diffs; this file shows a byte count. That commit is
plan 0070 Phase 2 — the ADR-008 migration — so the one change that most needed
review in this file was delivered as an opaque blob.

## Reproduction

```bash
python3 -c "
b = open('packages/crossvalidate/src/md-gherkin.ts','rb').read()
print('valid utf-8:', (lambda: (b.decode('utf-8'), True)[1])())
print('NUL bytes:', b.count(0))
"
# valid utf-8: True
# NUL bytes: 2
```

## Root cause

The NULs are deliberate and the idea behind them is sound — a `U+0000`
separator cannot collide with a file path or a scenario title, so it is a safe
composite-key delimiter:

```ts
// packages/crossvalidate/src/md-gherkin.ts:111
const scenarioKeys = new Set(set.scenarios().map((s) => `${s.relPath}\0${s.title}`))
// packages/crossvalidate/src/md-gherkin.ts:137
if (c.title !== undefined && rel !== undefined && !scenarioKeys.has(`${rel}\0${c.title}`)) {
```

What is wrong is the encoding: the separator was written as a **raw NUL byte in
the source file** rather than the `\0` escape sequence. Both produce the
identical runtime string; only one keeps the file text. The two lines render as
a plain space in most editors, so nothing on screen tells an author the file has
become binary.

No eess gate catches it, because nothing here is broken at runtime — the file is
valid UTF-8, `tsc` and ts-morph read it fine, and its tests pass. The damage is
entirely to the tools that read source _as text_.

## Why it matters

This repo's premise is that feedback should be agent-actionable. A source file
that returns **zero results with no error** is the worst possible failure mode
for that premise: an agent (or a developer) sweeping the package concludes the
symbol does not exist, rather than that the search was skipped.

It has already cost this repo accuracy. During the plan-0096 review, two grep
sweeps over `packages/crossvalidate/src/` silently omitted this file; the
resulting picture of the package's preset contract was wrong in a way that went
into a filed bug ([0097](../0097-crossval-presets-bypass-caller-owns-reporting.md),
since rewritten). The searches did not fail — they returned confidently
incomplete results.

## Fix

Replace the two raw bytes with the `\0` escape. The runtime value is unchanged
(`\0` in a template literal is `U+0000`), and `\0` is followed by `$` in both
occurrences, so there is no octal-escape ambiguity:

```ts
const scenarioKeys = new Set(set.scenarios().map((s) => `${s.relPath}\\0${s.title}`))
```

_(written above with a doubled backslash so this record stays plain text; the
source takes the single-backslash `\0`.)_

**This paragraph originally read "No changeset — the emitted string, the public
surface, and the behaviour are all identical." That was wrong, and it is left
here corrected rather than deleted because the same wrong call was actually
shipped once.** The emitted string is identical; the emitted FILE is not. `tsc`
copies a template literal's source bytes straight into the `.js`, and `dist/` is
what `files` publishes — so the byte reaches the registry and an adopter's
`grep` over `node_modules` silently skips the file. Measured: compiling the
pre-fix source emits a `.js` that `file(1)` calls `data`.

Bug [0144](./0144-md-gherkin-nul-bytes-break-grep.md) shipped its fix under
`'@nielspeter/eess-crossvalidate': none` with the words "ships nothing a consumer
can observe". It shipped a real, adopter-observable fix with no changelog line.
The rule this establishes: **a source-byte change is `patch`, not `none`, whenever
`tsc` carries the byte into `dist`.**

## Closing

Three things were true at closing time, and only the first was expected.

**1. The two bytes were already gone.** Bug
[0144](./0144-md-gherkin-nul-bytes-break-grep.md) fixed them on 2026-08-14,
two days after this record was filed. Its author found the defect independently —
an architect reviewer running `file` on a path whose grep result looked wrong —
and filed it fresh. Neither record cites the other. So the corpus carried the
same defect twice: once closed, once open, each reading as a complete account.

**2. Neither filing left a guard.** 0144 closed with `Red test written first:
n/a`, and box 1 here — the check — was never built. Two correct write-ups, zero
mechanism. That is the state ADR-009 calls worse than no check, because a record
that describes a class reads as coverage of it.

**3. Building the guard found the byte still live — and it was the FOURTH
finding of it, not the third.** This record originally claimed three. Review
found the miscount, and the filing it missed is the strongest one.

`fix/0086-nul-bytes-in-published-dist` (`36935f8`, **2026-08-08** — four days
_before_ this record was filed) had already found this exact byte, **fixed it**,
measured the consequence against the registry, and shipped a 188-line guard for
the whole class. It was never opened as a PR. Its commit body:

> Verified against the registry — `eess-gherkin@0.1.2`'s `dist/builder.js` carries
> 1 NUL, `eess-crossvalidate@0.1.2`'s `dist/md-gherkin.js` carries 2, both
> classified binary.

So the true account is worse than "two correct write-ups are not a mechanism": it
is **three correct write-ups and one complete, tested, unmerged fix**, and the
byte still sat in the tree. The crossvalidate half was later repaired by another
route; the gherkin half waited sixteen days for this PR to re-derive it, minus the
registry finding and with a narrower guard.

`packages/gherkin/src/builder.ts:27` had carried a raw `0x00` since
2026-07-13 — six weeks, the whole `@nielspeter/eess-gherkin` builder invisible to
`grep`, through every filing and every review in between:

```
$ file packages/gherkin/src/builder.ts
packages/gherkin/src/builder.ts: data
$ grep -n 'const key' packages/gherkin/src/builder.ts
$                      # ← no output, no error, no exit code
```

Same idea, same mistake: `` `${s.relPath}<NUL>${s.title}` `` as a composite key,
the raw byte written where the two-character `\0` escape belonged. Fixed here.

## Verification

- [x] Red test written first — planted a raw `0x00` in
      `packages/core/src/__nul_probe__.ts` and ran `npm run check:integrity`:
      **exit 0**, `Workspace integrity: OK`, on a file `file(1)` called `data`
      and `grep` returned nothing from. That is the red. The guard now lives in
      `scripts/check-workspace-integrity.mjs` as check 4, reading each file as a
      `Buffer` rather than as UTF-8 — a decode step is one more place for the
      thing being measured to be normalised away.
- [x] The guard carries its own denominator. Pointing its walk at a
      non-existent root makes it exit 1 saying it examined nothing, rather than
      printing OK over nothing (ADR-010). Verified by sabotage.
- [x] Non-vacuity coverage — scenario 6 of `scripts/nonvacuity/bad-waived-gates.mjs`.
      `check:integrity` runs four checks behind ONE `GATE_FOR` row, so a new
      check inside it is invisible to `gateCoverage()` by construction; without
      this scenario the guard could be deleted and `check:nonvacuity` would stay
      green. Verified by deleting the guard's `problems.push`: the fixture
      reports `never named the raw-NUL probe` and exits 0.
- [x] `file packages/crossvalidate/src/md-gherkin.ts` reports
      `Unicode text, UTF-8 text`. Also `packages/gherkin/src/builder.ts`, which
      this record's own fix is for.
- [x] `grep -n "scenarioCitationsResolve" packages/crossvalidate/src/md-gherkin.ts`
      lists the definition — at line 106 now, not the 102 written above; the
      file has moved on since this was filed.
- [x] `git diff` renders line-level **from the next change onward**. This box
      originally claimed the fix's own diff was "the first readable diff that
      file has had" — that was false, and review measured it: git classifies a
      diff as binary if EITHER side is, and the pre-image still carries the NUL,
      so `git show 890513c -- packages/gherkin/src/builder.ts` is still
      `Bin 2625 -> 2626 bytes` / `Binary files … differ`. It was also the one box
      that could not have been true when written, because the commit did not
      exist yet — which is the tell. The fix's own diff is the LAST unreadable
      one.
- [x] The md↔gherkin tests pass unchanged — 9 files / 89 tests in
      crossvalidate, 2 / 9 in gherkin, via `npx vitest run --root <pkg>`. The
      flag matters: `--dir` also collects a fixture project's own tests and
      reports 10 / 92, which review flagged as a reader being unable to
      reproduce the number. The key separator is
      byte-identical (`\0` in a template literal IS `U+0000` — asserted in node).
- [x] The composite key's SEPARATOR is now pinned by a test. Testing review
      measured that nothing constrained it: deleting `\0` from
      `packages/gherkin/src/builder.ts:27` outright left all nine gherkin tests
      green, so an agent "fixing" the raw byte could have dropped the composite
      key entirely with every gate still passing. The existing duplicate-title
      test cannot catch it — its `toHaveLength(1)` is satisfied by a key of
      `title` alone. Two fixtures now collide only when the separator is absent
      (`key-collision.feature` / `key-collision.feature.feature`), and deleting
      the separator reds exactly that one test.
- [x] `npm run validate` green.

Deferred: none.

## Scope this guard does NOT cover

Stated because an unstated limit reads as coverage — this record's own lesson,
now four times over. Review found three of these; the section as first written
missed all three, which is the section failing its own standard.

**Everything under a package's `src/`, whatever the extension.** The walk
originally filtered to `.ts`. Review measured the hole: the two Langium grammars
under `packages/mermaid/src/parser/grammar/` are source text inside the very
glob this check advertises, and a raw NUL planted in one left the gate green
_and the denominator unmoved_ — the file was never counted, so nothing looked
missing. The walk now reads every file under `src/`, which also covers
`.tsx`/`.mts`/`.cts` without a list that needs extending. Denominator moved
247 → 249.

**Per package, not per run.** The zero-files guard originally summed across all
packages and compared the total to zero, so one package's `src/` being renamed
dropped it silently while the headline count stayed healthy. Review measured
that too: gherkin contributing zero files gave exit 0 and
`243 source files free of raw NUL bytes`, with a `data`-classified file inside
a package the gate claimed to have scanned. Each package now has to contribute
at least one file or the check says it cannot speak for that package.

Still genuinely out of scope:

- **Not `scripts/`, the rule files, or `work/`.** The survey discipline this
  protects is the written one — `review-proposal` Step 2, "grep
  `packages/*/src`, always" — and every incident landed there. A NUL in
  `arch.rules.ts` today is still invisible and still ungated, and it would
  silently break every architecture survey this repo runs.
- **Not `scripts/nonvacuity/`** — but not for the reason first given here. The
  original wording said it "holds deliberately corrupt payloads", and testing
  review checked that against the disk: **zero tracked files in this repo carry a
  raw NUL**, the nonvacuity fixtures included. Scenario 6 builds its payload at
  runtime from a `\x00` escape, which is the correct form. A whole-repo scan
  would be green today. So the exclusion rests on the fixtures being _allowed_ to
  plant such a payload in future, not on one existing — a weaker reason, and the
  honest one.
- **Not what already shipped.** This is the limit that matters most to anyone
  but us, and the first version of this section did not mention it at all.
  `prebuild: rm -rf dist` plus `tsc -p` makes `dist/` a pure function of `src/`,
  so gating `src` protects every FUTURE tarball — and does nothing for the four
  already on the registry. Measured during review, against npm:

  ```
  PUBLISHED 0.1.0: dist/builder.js [1 NUL]
  PUBLISHED 0.1.1: dist/builder.js [1 NUL]
  PUBLISHED 0.1.2: dist/builder.js [1 NUL]
  PUBLISHED 0.3.0: dist/builder.js [1 NUL]   <- dist-tag: latest
  ```

  Every published `@nielspeter/eess-gherkin`, including `latest`, carries it
  right now. The rest of the family is clean. `RELEASING.md` has no practice for
  "a published version carries a defect" — no `npm deprecate`, nothing — and
  this is the second time a tarball has been found carrying this exact byte.
  That absence is now load-bearing.

- **NUL only.** Other bytes that make `file(1)` say `data` — a stray `0x01`, an
  invalid UTF-8 sequence — are not checked.

  The first version of this section justified that by saying NUL is the _loud_
  case, quoting the prior-art branch below: NUL makes grep say
  `Binary file … matches`, whereas invalid UTF-8 makes it exit 1 silently.
  **On this machine that is false**, and review measured it:

  | tool                                                | on a NUL-bearing file   | exit  |
  | --------------------------------------------------- | ----------------------- | ----- |
  | `/usr/bin/grep` (BSD)                               | `Binary file … matches` | 0     |
  | `grep` **on PATH** (ugrep 7.8.4, invoked with `-I`) | _no output at all_      | **1** |

  The `grep` a developer or an agent actually gets in this environment excludes
  binary files outright. So NUL is exactly as silent here as the case deferred
  on the grounds that NUL is louder. The deferral stands on cost, not on that
  argument — and the argument should not be repeated.

  **Prior art exists and is better reasoned than this guard.** The unmerged
  `fix/0086-nul-bytes-in-published-dist` (`36935f8`, 2026-08-08) carries a
  188-line `scripts/check-source-text.mjs` covering control bytes AND invalid
  UTF-8 across all git-tracked source, with its own gate, denominator, CI wiring
  and four non-vacuity probes. It is kept, not deleted, for that reason — but a
  paragraph inside a closed record is where things go to be forgotten, which is
  this record's lesson yet again. Its disposition needs an owner and a record of
  its own.
