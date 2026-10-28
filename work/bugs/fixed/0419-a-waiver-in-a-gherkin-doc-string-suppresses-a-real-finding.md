# Bug 0419: a waiver in a Gherkin doc string suppresses a real finding

## Status

- **State:** Fixed — 2026-10-15 on branch `fix/0419-gherkin-doc-string-waiver`, in the same PR
  that closes it. Reproduced 2026-10-15 against `main` at `247e6579`, through eess-gherkin's public
  entry points.
- **Severity:** High — a false green (`BUGS.md`'s High row). Text inside a Gherkin doc string, which
  is data, not a comment, suppresses a real violation. Meanwhile the comment form Gherkin actually
  has, `#`, is never read as a waiver.
- **Origin:** self-found · second review of [proposal 016](../../proposals/016-eess-py-a-python-dialect.md), 2026-10-15. The architect lens found that
  the kernel's default comment scanner treats every non-Markdown file as JavaScript, and asked that
  shipped file types be checked. This record is that check.
- **Reported:** 2026-10-15

## Symptom

A feature file with two scenarios titled `same`, and an `eess-exclude-start … eess-exclude-end`
pair written with `//` inside two Gherkin doc strings:

| file                                        | `violations()`                        | `check()` |
| ------------------------------------------- | ------------------------------------- | --------- |
| with the `//` text inside the doc strings   | 0                                     | passes    |
| the same file with plain prose in its place | 1 (`duplicate scenario title "same"`) | throws    |

A real Gherkin comment, `# eess-exclude gherkin/unique-titles: …`, is not read as a waiver at all.
The kernel's parser reads the same text the same way in a `.yml` file: `parseExclusionComments`
returned the block exclusion, lines 5 to 9, for both `features/a.feature` and `config/a.yml`.

## Reproduction

```gherkin
Feature: x
  Scenario: same
    Given a doc string
      """
      // eess-exclude-start gherkin/unique-titles: prose inside a doc string
      """
  Scenario: same
    Given b
      """
      // eess-exclude-end
      """
```

```js
import { features, scenarios } from '@nielspeter/eess-gherkin'
const set = features({ roots: ['f/**'] })
scenarios(set).should().haveUniqueTitles().rule({ id: 'gherkin/unique-titles' }).violations()
// [] — and with plain prose in the doc strings: one duplicate-title violation at line 7
```

The kernel's parser alone, on the same text as a `.feature` and as a `.yml` file:

```js
// Node, from the repository root, against the built kernel
import { parseExclusionComments } from './packages/core/dist/exclusion-comments.js'
const text = [
  'Feature: x',
  '  Scenario: y',
  '    Given a doc string',
  '      """',
  '      // eess-exclude-start some/rule: prose inside a doc string',
  '      """',
  '    Then z',
  '      """',
  '      // eess-exclude-end',
  '      """',
  '  # eess-exclude some/rule: a real gherkin comment',
].join('\n')
for (const file of ['features/a.feature', 'config/a.yml']) {
  const { exclusions } = parseExclusionComments(text, file)
  console.log(
    file,
    exclusions.map((e) => [e.ruleId, e.line, e.endLine]),
  )
}
// features/a.feature [ [ 'some/rule', 5, 9 ] ]
// config/a.yml [ [ 'some/rule', 5, 9 ] ]
```

The block from the doc strings is read in both. The `#` comment on line 11 is read in neither.

## Root cause

- **Which masker runs.** `parseExclusionComments` picks a default masker by file type
  (`exclusion-comments.ts` line 391 at `247e6579`, before the fix; now `packages/core/src/exclusion-comments.ts:396`). Code files and every other non-Markdown type get
  the JavaScript one. It treats `"""` as string delimiters, not as a Gherkin doc string, so the
  doc string's lines reach the directive scan as if they were code. The comment beside that choice
  (lines 388-390 at `247e6579`, rewritten by the fix) called it the conservative one: "over-masking
  hides a directive (loud), under-masking invents one (silent)". For a `.feature` file it
  under-masks: it invents a directive from a doc string, the silent case.
- **Which forms are read.** The scan reads `//` and `<!-- -->` forms only. So a `//` line that
  survives masking is a directive, and Gherkin's own `#` comment never is.
- **Where it is reached.** The kernel's rule execution reads the file of every violation and applies
  these exclusions (`packages/core/src/execute-rule.ts:150-151`). It passes no dialect masker, so a
  `.feature` file's findings get the JavaScript reading.

## Fix

**Decided from [ADR-012](../../../adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md), overrulable: a file the kernel cannot lex yields no directive.** [ADR-012](../../../adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md)'s
second property already says it: "when it cannot prove a span is a comment, it does not treat it as
one. A directive is dropped rather than a violation silently suppressed." For a file that is neither
code nor Markdown, the kernel cannot prove any span is a comment. So the default masker for such a
file now blanks every character but line breaks (`maskEverything`,
`packages/core/src/exclusion-comments.ts`), and the comment that called the old choice conservative
is corrected.

- **Why not a Gherkin masker in eess-gherkin.** Under [ADR-012](../../../adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md)'s third property the kernel's default
  runs over any masker a dialect injects, so a dialect cannot widen what is read. A Gherkin masker
  would need that property amended, which is [proposal 016](../../proposals/016-eess-py-a-python-dialect.md)'s change 2 (for Python's `#`). Enabling
  waivers in other file types is that amendment's work, not this bug's.
- **What changes for adopters.** A `//` waiver in a `.feature`, `.yml`, `.py`, `.mmd`, `.graphql` or
  other non-code, non-Markdown file no longer applies, and its finding reports again. That is a
  break, marked in `.changeset/waiver-only-where-the-kernel-can-lex.md` with every dependent dialect
  at `minor`. Nothing in this repository's docs promised waivers in those files.

## Verification

- [x] Red test first: `packages/gherkin/tests/waiver-in-doc-string.test.ts` drives
      `scenarios(…).violations()` over `tests/fixtures/waiver-in-doc-string.feature`. It failed before
      the fix (0 violations) and reports the duplicate title at line 7 after.
- [x] A kernel test, `packages/core/tests/exclusion-unlexable-file-types.test.ts`, reads no directive
      in `.feature`, `.yml`, `.yaml`, `.py`, `.mmd`, `.graphql` or `.txt`, for the `//` and `<!-- -->`
      forms, with no masker and with an injected one, and still reads one in `.ts` and `.md`. Seven of
      its first eight cases failed before the fix; a default that blanks only `//` fails nine of ten.
- [x] A sabotage row: restoring the JavaScript reading for these files turned both tests red again (7
      failed, and 1 failed), and they went green once restored.
- [x] `npm run validate` green on this branch, locally. The fixture count in
      `packages/gherkin/tests/load.test.ts` went from 5 to 6 for the new fixture.

- [ ] Saying so when a directive in such a file is ignored, as the draft's second option asked
      ("with that said"): `deferred→`[bug 0421](../0421-a-waiver-in-a-file-the-kernel-cannot-lex-is-ignored-in-silence.md). The docs
      now state where directives are read.
- [x] [ADR-012](../../../adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md) updated in the same PR, as the fix's review asked: a dated section applying property 2
      to these files, and a `gated` Enforcement row citing the kernel test.

Deferred: [bug 0421](../0421-a-waiver-in-a-file-the-kernel-cannot-lex-is-ignored-in-silence.md)
