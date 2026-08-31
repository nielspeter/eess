# Bug 0227: eess-ts says nothing about a malformed `eess-exclude-start`, and misattributes the one it does report

## Status

- **State:** Draft — divergence measured against both engines, both directions;
  no fix attempted.
- **Severity:** Medium — nothing is wrongly suppressed (measured: `suppress=0` in
  every case below), so this is **not** a fail-open. It is a fail-**silent** and a
  misattribution, in the dialect adopters actually install.
- **Origin:** self-found · running `smells.duplicateBodies()` over eess itself
  after an adopter reported a false positive from it
  ([0169](./0169-computesimilarity-ignores-call-targets-so-opposite-functions-read-as-duplicates.md)).
  The detector's cross-package findings pointed at the duplicated engine, and
  the duplication had already bitten.
- **Reported:** 2026-08-31

## Symptom

`packages/core/src/exclusion-comments.ts` and
`packages/ts/src/core/exclusion-comments.ts` are two independent implementations
with an identical export surface (`parseExclusionComments`,
`isExcludedByComment`, `ExclusionComment`, `ExclusionWarning`, `ParseResult`),
each wired to its own `execute-rule.ts` and exported from its own package root.
Neither imports the other.

They disagree on two inputs. Measured by calling both parsers on the same source:

| input                                 | kernel                                                    | eess-ts                                         |
| ------------------------------------- | --------------------------------------------------------- | ----------------------------------------------- |
| A · bare `-start`, no rule id, no end | warns: _"names no rule id"_ + a `Fix:`                    | **silent — 0 warnings**                         |
| B · bare `-start` + `-end`            | warns: _"`eess-exclude-start` names no rule id"_ + `Fix:` | **"`eess-exclude-end` without matching start"** |

Cases that agree, so the divergence is narrow and not a general rot: a `-start`
with a rule id but no reason, a `-start` with both, a single-line `eess-exclude`
with no reason, and an orphan `-end` all produce identical output from both.

**Case A** is the one an author hits by accident. They write
`// eess-exclude-start`, expect a waiver, get none — and are told nothing. The
directive is inert and silent, which is the shape this repo files bugs about.

**Case B** is worse than silence: eess-ts sends the author to the `-end` line for
a fault that is on the `-start` line. A `Fix:` pointing at the wrong directive is
worse than no `Fix:` — that is [ADR-009](../../adr/009-agent-first-failure-surfaces.md)'s
own argument, and bug 0174 is filed about a status line naming the wrong fault.

## Root cause

The kernel copy carries the fix for
[0158](./fixed/0158-an-undocumented-exclusion-directive-suppresses-and-only-warns.md),
landed on PR #88 (a reason-free `-start` pushes an empty frame, so a bare
`-start` is reported as the fault it is). The eess-ts copy never received it.

The two copies cite disjoint bug fixes in their own comments, which is the
divergence made visible:

```
packages/core/src/exclusion-comments.ts   bug 0154, bug 0158
packages/ts/src/core/exclusion-comments.ts   bug 0039, bug 0043
```

This is exactly the hazard [plan 0188](../plans/0188-unify-the-duplicated-engine-modules.md)
is written about — _"A fix lands on one copy and nothing notices"_ — and it is now
that plan's **third** measured case, after bug 0156's kernel half and bug 0163.
It is also the freshest: the fix that did not travel landed nine days ago.

**A caution for whoever fixes this, learned while filing it.** The obvious way to
find the divergence — grepping each copy for the bug numbers and fix keywords —
gives a WRONG answer. It suggests eess-ts is also missing
[0154](./fixed/0154-a-directive-inside-a-string-literal-suppresses-a-real-violation.md)'s
protection (a directive inside a string literal must not suppress anything),
because the kernel's `CODE_LIKE`/`MARKDOWN_LIKE`/`maskMarkdownCodeSpans` machinery
appears in neither the ts copy nor its comments. Tested directly, **both copies
correctly refuse the string-literal directive**: eess-ts imports `ts-morph` and
uses the real TypeScript lexer, so it never needed the hand-rolled masking the
kernel had to build to stay ts-morph-free. Same protection, different mechanism,
no shared vocabulary. Compare these two files by BEHAVIOUR, never by text.

## Reproduction

```js
const core = await import('./packages/core/dist/exclusion-comments.js')
const ts = await import('./packages/ts/dist/core/exclusion-comments.js')
const src = '// eess-exclude-start\nconst a = 1\n'
core.parseExclusionComments(src, 'p.ts').warnings.length // 1 — names the fault
ts.parseExclusionComments(src, 'p.ts').warnings.length // 0 — silent
```

## Fix

Port 0158's empty-frame handling into `packages/ts/src/core/exclusion-comments.ts`
so a reason-free `-start` is reported against the `-start`. The change is
mechanical — the kernel copy is the reference — but it must be verified by
behaviour, per the caution above.

Whether these two files should exist at all is
[plan 0188](../plans/0188-unify-the-duplicated-engine-modules.md)'s question, and
that plan is Draft with two decisions unmade. This bug does not wait on it: the
dialect adopters install is silent today, and unification is a refactor with
unmade decisions behind it.

## Verification

- [ ] Red first — a test asserting eess-ts warns on a bare `-start`. It fails on
      the tree as it stands.
- [ ] Case B attributes the fault to the `-start` line, not the `-end` line.
- [ ] Cases C–F still agree between the two copies (they do today; the fix must
      not disturb them).
- [ ] A test that runs BOTH parsers over the same input table and asserts they
      agree — so the next fix that lands on one copy is caught by construction
      rather than by someone re-running a smell detector a week later.
- [ ] `npm run validate` green.

## Out of scope

- Unifying the two modules — [plan 0188](../plans/0188-unify-the-duplicated-engine-modules.md).
- The `smells.duplicateBodies()` false-positive rate that led here —
  [bug 0169](./0169-computesimilarity-ignores-call-targets-so-opposite-functions-read-as-duplicates.md).
