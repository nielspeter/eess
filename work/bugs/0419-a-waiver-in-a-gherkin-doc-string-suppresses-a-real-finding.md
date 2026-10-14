# Bug 0419: a waiver in a Gherkin doc string suppresses a real finding

## Status

- **State:** Draft — reproduced 2026-10-15 against `main` at `247e6579`, through eess-gherkin's public
  entry points (built `dist`). No red test yet, and the fix is not designed.
- **Severity:** High — a false green (`BUGS.md`'s High row). Text inside a Gherkin doc string, which
  is data, not a comment, suppresses a real violation. Meanwhile the comment form Gherkin actually
  has, `#`, is never read as a waiver.
- **Origin:** self-found · second review of proposal 016, 2026-10-15. The architect lens found that
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
  (`packages/core/src/exclusion-comments.ts:391`). Code files and every other non-Markdown type get
  the JavaScript one. It treats `"""` as string delimiters, not as a Gherkin doc string, so the
  doc string's lines reach the directive scan as if they were code. The comment beside that choice
  (`packages/core/src/exclusion-comments.ts:388-390`) calls it the conservative one: "over-masking
  hides a directive (loud), under-masking invents one (silent)". For a `.feature` file it
  under-masks: it invents a directive from a doc string, the silent case.
- **Which forms are read.** The scan reads `//` and `<!-- -->` forms only. So a `//` line that
  survives masking is a directive, and Gherkin's own `#` comment never is.
- **Where it is reached.** The kernel's rule execution reads the file of every violation and applies
  these exclusions (`packages/core/src/execute-rule.ts:150-151`). It passes no dialect masker, so a
  `.feature` file's findings get the JavaScript reading.

## Fix

Not designed. ADR-012 makes the lexer a capability a dialect supplies, and the kernel's default the
conservative one. The fix belongs in that frame. Each candidate needs a decision:

- **A Gherkin masker.** eess-gherkin supplies one, and the kernel's execution accepts it. Doc
  strings are blanked, and `#` is the comment introducer.
- **No directives at all** in a file type no masker can lex, with that said, rather than reading it
  as JavaScript.
- **Whether `#` waivers are wanted for `.feature` and `.yml`.** That is the same question proposal
  016's change 2 raises for Python.

## Verification

- [ ] Red test first: the fixture above, through `scenarios(…).violations()`, must report the
      duplicate title.
- [ ] A sabotage row: restoring the JavaScript reading for `.feature` turns it green again.
- [ ] `npm run validate` green.

Deferred: none
