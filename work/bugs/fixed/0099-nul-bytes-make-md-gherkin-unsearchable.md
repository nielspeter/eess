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

No changeset — the emitted string, the public surface, and the behaviour are all
identical.

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

**3. Building the guard found a third instance, live.**
`packages/gherkin/src/builder.ts:27` had carried a raw `0x00` since
2026-07-13 — six weeks, the whole `@nielspeter/eess-gherkin` builder invisible to
`grep`, through both filings and every review in between:

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
- [x] `git diff` on the gherkin fix renders line-level — the first readable diff
      that file has had since it was created.
- [x] The md↔gherkin tests pass unchanged: 9 files / 89 tests in
      `packages/crossvalidate`, 2 / 9 in `packages/gherkin`. The key separator is
      byte-identical (`\0` in a template literal IS `U+0000` — asserted in node).
- [x] `npm run validate` green.

Deferred: none.

## Scope this guard does NOT cover

Stated because an unstated limit reads as coverage, which is this record's own
lesson twice over:

- **`packages/\*/src/**/_.ts`only.** Not`scripts/`, not the rule files, not
`work/`. The survey discipline it protects is the one written down
(`review-proposal`Step 2: "grep`packages/_/src`, always"), and both incidents
landed there. A NUL planted in `scripts/` today is still invisible and still
  ungated.
- **Not the nonvacuity fixtures.** `scripts/nonvacuity/` holds deliberately
  corrupt payloads; a guard that reds on its own test data teaches people to
  disable it.
- **NUL only.** Other bytes that make `file(1)` say `data` — a stray `0x01`, an
  invalid UTF-8 sequence — are not checked. NUL is the one this repo has been
  bitten by three times, so it is the one with a measured failure behind it.

  Calling the rest speculation would be too easy, though, and it would be wrong:
  **prior art exists and is better reasoned than this guard.** An unmerged branch
  from 2026-08-08 (`fix/0086-nul-bytes-in-published-dist`, `36935f8`) carries a
  188-line `scripts/check-source-text.mjs` that checks control bytes AND invalid
  UTF-8 across all tracked source, and makes an argument this record did not:

  > NUL makes `file(1)` say `data` and grep say "Binary file … matches" — a
  > visible refusal. **Invalid UTF-8 is the silent one**: a stray latin-1 byte in
  > a UTF-8 locale makes grep exit 1 with no output and no warning at all.

  If that is right — and it reads right — then the loudest case is the one now
  gated and the quietest is not. That branch was never proposed for merge and its
  guard never landed, which is its own instance of this record's lesson. It is
  kept, not deleted, for exactly that reason.
