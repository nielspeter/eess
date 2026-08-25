# Bug 0144 (fixed on filing): `md-gherkin.ts` carried raw NUL bytes, making `grep` silently treat it as binary

## Status

- **State:** Fixed — found, fixed, and verified the same session it was found.
- **Duplicate of [0099](./0099-nul-bytes-make-md-gherkin-unsearchable.md)**, filed
  two days earlier for the same two bytes in the same file. Neither filing knew
  about the other, and neither left a guard — so a THIRD instance
  (`packages/gherkin/src/builder.ts`) survived both and stayed binary for six
  weeks. Recorded here on 2026-08-24, when closing 0099 built the check. The
  duplication is the finding: two correct write-ups are not a mechanism.
- **Severity:** Medium — not a runtime defect (the NUL bytes were a working key
  separator, functionally correct), but a verification-methodology hole: this
  repo's own review discipline is "grep `packages/*/src`, always" (the
  `review-proposal` skill's own Step 2 guard), and one real source file was
  silently invisible to that discipline. It produced a live false negative in
  a real review this same session — see Reproduction.
- **Origin:** self-found · architect reviewer of proposal 005's third review
  round caught it while independently verifying a citation the coordinator's
  own grep-based survey had gotten wrong
- **Reported:** 2026-08-14

## Symptom

`packages/crossvalidate/src/md-gherkin.ts` used a raw `0x00` byte (not the
two-character escape sequence `\0`) as a key separator inside two template
literals:

```ts
const scenarioKeys = new Set(set.scenarios().map((s) => `${s.relPath}${NUL}${s.title}`))
...
if (c.title !== undefined && rel !== undefined && !scenarioKeys.has(`${rel}${NUL}${c.title}`)) {
```

`file packages/crossvalidate/src/md-gherkin.ts` reported `data`, not text —
standard `grep` treats a file containing a NUL byte as binary and silently
excludes it from a search entirely, no warning, no error.

## Reproduction

While surveying `packages/crossvalidate/src/*.ts` for a review of proposal
005's Rewrite v2 (the coordinator's own Step 2 existing-code survey, per the
`review-proposal` skill), `grep -n "ExtractedCitation" packages/crossvalidate/src/md-gherkin.ts`
returned zero hits. `ExtractedCitation` is in fact exported from that exact
file, at (pre-fix) line 18. The false negative was used as evidence in a
review finding, and only caught because an architect reviewer, asked to
independently re-verify the same claim, ran `file` on the path first and
found `data` instead of `ASCII text`, then confirmed with a byte-level dump
(`xxd`) that the file contained `0x00` at two positions.

```
$ file packages/crossvalidate/src/md-gherkin.ts
packages/crossvalidate/src/md-gherkin.ts: data   # before the fix
```

## Root cause

Some prior edit to this file (git blame: plan 0069 Phase 2, `fbd4d4b`) wrote
a literal NUL character into the source text instead of the two-character
escape sequence `\0` inside a template literal. TypeScript/JS handle a raw
NUL character in a string identically to the escape sequence at compile and
run time, so nothing in the type system, the test suite, or `check:docs-code`
could have caught this — it is invisible to every tool that reads the file as
a valid program and visible only to tools (`grep`, some diff/editor
configurations) that read it as text first.

## Why it matters

This repo's whole review and survey discipline — the `review-proposal`
skill's Step 2 ("grep `packages/*/src`, always"), every reviewer persona's
own instructions, and this session's own repeated "verify it yourself,
don't trust the finding" practice — assumes `grep` sees every source file.
One file didn't. The failure mode is silent: a missed hit reads as "does not
exist" rather than "not searched," which is exactly the corruption class this
whole project exists to catch, now found in the process that catches it.

## Fix

Replaced both raw `0x00` bytes with the literal two-character escape
sequence `\0` (functionally identical at runtime — verified: `tsc --noEmit`
clean, all 10 test files / 71 tests in `packages/crossvalidate` still pass).
`file` now reports `Unicode text, UTF-8 text`; `grep -n "ExtractedCitation"
packages/crossvalidate/src/md-gherkin.ts` now returns 6 real hits.

## Verification

- [x] Red test written first: n/a — this is a text-encoding defect with no
      behavioral test surface; the red state was `file` reporting `data` and
      `grep` returning a false negative, both reproduced above before the fix
      and confirmed gone after.
- [x] `npm run validate` green — confirmed via targeted typecheck + full
      `packages/crossvalidate` test run; full `npm run validate` to be run
      before this lands with the rest of this session's work.

Deferred: none.
