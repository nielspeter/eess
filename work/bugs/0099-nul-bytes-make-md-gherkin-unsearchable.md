# Bug 0099: two raw NUL bytes make `md-gherkin.ts` binary — invisible to `grep`/`rg` and unreviewable in `git diff`

## Status

- **State:** Draft — reproduced with `file`, `grep`, `rg`, `git grep`, and
  `git show` on a real commit; root cause read from the bytes.
- **Reported:** 2026-08-12 — self-found while verifying the bug reports filed
  from the [plan 0096](../plans/0096-dogfood-missing-crossvalidate-bindings.md)
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
into a filed bug ([0097](./0097-crossval-presets-bypass-caller-owns-reporting.md),
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

## Verification

- [ ] Red test written first — a check that no file under `packages/*/src/**`
      contains a `U+0000` byte. It fails today on `md-gherkin.ts` and passes
      after the fix. (Natural home: `scripts/check-workspace-integrity.mjs`,
      which already walks every package's `src/` reading each file — see
      [0092](./0092-integrity-gate-misses-three-packages.md), which edits the
      same script.)
- [ ] `file packages/crossvalidate/src/md-gherkin.ts` reports text, not `data`.
- [ ] `rg -n "scenarioCitationsResolve" packages/crossvalidate/src/` lists the
      definition at `md-gherkin.ts:102`.
- [ ] `git diff` on the fix itself renders line-level — the fix's own commit is
      the first readable diff this file has had.
- [ ] The md↔gherkin tests pass unchanged (the key separator is byte-identical).
- [ ] `npm run validate` green.

Deferred: none.
