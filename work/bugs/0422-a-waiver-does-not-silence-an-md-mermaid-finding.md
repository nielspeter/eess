# Bug 0422: a waiver does not silence an md-mermaid finding

## Status

- **State:** Draft — measured 2026-10-15 on `main` at `8fc69538`, while fixing [bug 0409](./fixed/0409-md-mermaid-blames-the-author-for-a-grammar-gap.md). No red test
  yet, and the cause is not traced.
- **Severity:** Medium — a missing capability (`BUGS.md`'s Medium row). Nothing passes that should
  fail; a finding an author has a reason to waive cannot be waived. `docs/dogfooding.md` calls
  `// eess-exclude` "the tool's own sanction mechanism" for inline exceptions, without a caveat for
  the crossvalidate presets.
- **Origin:** self-found · fixing [bug 0409](./fixed/0409-md-mermaid-blames-the-author-for-a-grammar-gap.md), 2026-10-15. [Bug 0409](./fixed/0409-md-mermaid-blames-the-author-for-a-grammar-gap.md)'s remedy was going to say "waive it
  with a reason"; the probe showed that would not work, so the remedy says to narrow the corpus globs
  instead.
- **Reported:** 2026-10-15

## Symptom

A Markdown document holds a `classDiagram` fence eess-mermaid cannot read (`direction RL`), with
`<!-- eess-exclude crossval/embedded-diagram: valid Mermaid eess-mermaid does not model -->` on the
line above it. `embeddedDiagramsMatchCode` reports the parse finding either way:

| document           | `report: 'return'` | default (throws)             |
| ------------------ | ------------------ | ---------------------------- |
| with the waiver    | 1 parse finding    | throws, with 1 parse finding |
| without the waiver | 1 parse finding    | throws, with 1 parse finding |

## Reproduction

````js
import { corpus } from '@nielspeter/eess-md'
import { embeddedDiagramsMatchCode } from '@nielspeter/eess-crossvalidate/md-mermaid'
import { project } from '@nielspeter/eess-ts'
// a.md:
//   # Doc
//
//   <!-- eess-exclude crossval/embedded-diagram: valid Mermaid eess-mermaid does not model -->
//   ```mermaid
//   classDiagram
//     direction RL
//     class A
//   ```
embeddedDiagramsMatchCode(corpus({ roots: ['a.md'] }), project('tsconfig.json'), {
  report: 'return',
})
// → one finding whose message contains "does not parse"
````

**Wider than the table, measured by PR #213's review:** the `eess-exclude-start` / `-end` block form is
ignored too. The kernel's only caller of `parseExclusionComments` is its rule execution
(`packages/core/src/execute-rule.ts:151`), which the hand-built crossvalidate presets do not pass
through, so this likely holds for every crossvalidate preset, not only md-mermaid.

## Root cause

Not traced. The crossvalidate presets build their findings by hand and hand them to `finishPreset`;
exclusion comments are applied in the kernel's rule execution, which a hand-built preset may never
pass through. [Bug 0097](./0097-crossval-presets-bypass-caller-owns-reporting.md) records related gaps in how these presets report.

## Fix

Not designed. Either the presets apply exclusion comments like a builder's rules do, or the docs
name these presets as ones a comment cannot waive. If waivers come to work here, [bug 0409](./fixed/0409-md-mermaid-blames-the-author-for-a-grammar-gap.md)'s remedy
(`grammarGapRemedy` in `packages/crossvalidate/src/shared.ts`) should switch from "isolate the fence in
its own document" to a per-finding waiver.

## Verification

- [ ] Red test first: the document above, through `embeddedDiagramsMatchCode`, reports nothing
      with the waiver and one finding without it.
- [ ] `npm run validate` green.

Deferred: none
