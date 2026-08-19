# Bug 0154: A `// eess-exclude` directive inside a string literal or block comment suppresses a real violation

## Status

- **State:** Draft — surfaced by plan 0150 Phase 4's three-persona review
  (enforcement, architect, testing all converged on it independently), then
  reproduced end-to-end against the built dist. No red test yet.
- **Severity:** High — a silent hole in the enforcement path. A live violation
  is waived by text nobody wrote as a waiver, and nothing reports it. This is
  the failure class the product exists to prevent, in the kernel's own
  suppression machinery.
- **Shipped in:** the published `@nielspeter/eess` (`0.2.2`) and
  `@nielspeter/eess-ts` (`0.2.1`). **The defect predates plan 0088's fold** —
  `git show 810808b:packages/core/src/exclusion-comments.ts` (the `v0.2.3`
  release commit) carries the identical `SINGLE_LINE_RE` and
  `sourceText.split('\n')`. The fold did not introduce it; the fold's failure
  was **not bringing ts-archunit's 0043 fix across with the engine it copied**.
  That distinction matters for scope — see "A wider question" below.
- **Origin:** self-found · `/review` of plan 0150 Phase 4 (`orphanExclusions()`)
- **Reported:** 2026-08-18

## Symptom

`parseExclusionComments` (`packages/core/src/exclusion-comments.ts:203`) scans
raw source **line by line** with a bare regex. It has no notion of where a line
sits in the syntax: a string literal, a template literal, a JSDoc block, or
ordinary prose inside a `//` comment are all indistinguishable from a real
directive.

Two consequences, one severe and one noisy:

1. **Severe — a real violation is silently suppressed.** Directive text that
   exists only inside a string literal waives a genuine finding on the next
   line.
2. **Noisy — the parser reports its own documentation as directives.** Every
   `<rule-id>` placeholder in the file that documents the directive grammar
   (`packages/core/src/exclusion-comments.ts:43-55, 196-200`) parses as a live
   exclusion naming a rule id of `<rule-id>`, and the user-facing string in
   `packages/core/src/comment-suppression.ts:82` parses as two more.

Consequence 2 was inert until plan 0150 built `orphanExclusions()` — a garbage
id simply never equals a real violation's `ruleId`, so nothing downstream ever
looked. That plan is the first consumer to surface the parse, and it turns the
garbage into user-facing findings whose stated remedy is to **delete the
comment** — pointed at the parser's own documentation.

## Reproduction

Severe form, verified end-to-end against the built dist:

```ts
// src/victim.ts — the eval() on the last line is a REAL violation
export function danger(): unknown {
  const doc = 'example: // eess-exclude demo/no-eval: how to waive'
  return eval('1+1')
}
```

```js
modules(project('./tsconfig.json'))
  .that()
  .resideInFile('**/*.ts')
  .should()
  .notContain(call('eval'))
  .rule({ id: 'demo/no-eval' })
  .violations()
// → 0
```

Delete the `const doc = …` line and the same rule reports 1 violation. No
waiver was authored; a sentence describing how to write one waived it.

Noisy form, against this repo — **run the parser directly**, which works today:

```js
import { parseExclusionComments } from '@nielspeter/eess'
import fs from 'node:fs'
const f = 'packages/core/src/exclusion-comments.ts'
parseExclusionComments(fs.readFileSync(f, 'utf8'), f).exclusions.length
// → 12   (ids '<rule-id>', '<rule-id>[', '<rule-id>]', '<rule-a>', '<rule-b>'
//         at lines 43, 44, 47, 55, 196-200 — the file's own grammar docs)
```

plus **2** more from `packages/core/src/comment-suppression.ts:82`
(`'comments. They are exemptions'`, `'not passes'`) — a template literal.
**12 + 2 = the 14.** Twelve come from `//` prose, two from a string literal;
that split is why the Fix below treats prose as an open sub-question.

> An earlier draft gave this as `npx eess-ts doctor arch.rules.ts
arch.internal.rules.ts`. **That does not reproduce on `main`** — it prints
> "No rules that cannot enforce anything", because `orphanExclusions()` was
> reverted with plan 0150 Phase 4 and exists in no `src/`. A reader running it
> would conclude this record is stale. The parser call above is the
> reproduction; the `doctor` framing returns once Phase 4 lands.

## Root cause

`packages/core/src/exclusion-comments.ts:203-232` is a per-line
`SINGLE_LINE_RE.exec(line)` over `sourceText.split('\n')`. There is no
literal-blanking pass and no comment-position check, so any line whose raw text
contains `// eess-exclude <something>` is read as a directive regardless of
what that line actually _is_.

This is a **known, fixed defect in the ancestor**. ts-archunit hit it as its own
bug 0043 and fixed it by parsing and blanking every string-like literal — and
block comments — before scanning (in that repo's own
`src/core/exclusion-comments.ts`, under the heading "Every string-like literal,
blanked"; as of 2026-08-18, a separate checkout, deliberately not cited as a
`path:line` pointer since it does not ground in this repo). Its own comment
records finding it the hard way: _"this very file's docstring
explains the bug, contains the directive text, and the moment comments started
being read correctly it declared a live exclusion"_). Plan 0088 folded
ts-archunit's engine into eess but this hardening did not come across with it —
the eess kernel's parser is the pre-0043 shape.

## Fix

Port bug 0043's hardening into `packages/core/src/exclusion-comments.ts`:

1. Blank every string, template, and regex literal before scanning, so a
   directive inside one cannot be read. A template literal is blanked whole,
   including its `${…}` interpolations.
2. Blank block comments (`/* … */`, JSDoc), so a grammar description inside one
   cannot be read.
3. Decide and record what happens to a directive in ordinary `//` prose
   (`// Single-line: // eess-exclude <rule-id>: <reason>`). ts-archunit does not
   blank these either, so this is a genuinely open sub-question rather than a
   settled port — the candidates are requiring the directive to start the
   comment, or validating the id's shape. **This must be answered before the fix
   lands**, since 12 of the 14 false positives measured above come from this
   case, not from literals.

The kernel is the right home: `parseExclusionComments` is dialect-independent
and ships HTML-comment forms explicitly for markdown corpora
(`packages/core/src/exclusion-comments.ts:53-58`), so eess-md carries the same
defect for `<!-- eess-exclude … -->` inside a fenced code block.

**ADR-002 note:** the fix needs syntax awareness. ts-archunit's uses the AST.
The kernel has no ts-morph dependency by design (`arch.rules.ts` gates
`eess/kernel-no-engine-deps`), so a literal-blanking pass here must be
hand-rolled over text, not delegated to a parser — or the blanking must live on
the dialect side of the boundary. This is a real design decision, not a
mechanical port, and is the reason this bug is filed rather than fixed inline.

## Verification

- [ ] Red test first: a directive inside a string literal does **not** suppress
      a real violation on the next line (the severe form above).
- [ ] Red test: a directive inside a block comment / JSDoc is not parsed.
- [ ] Red test: `parseExclusionComments` over
      `packages/core/src/exclusion-comments.ts` itself yields zero exclusions —
      the file that documents the grammar must not declare waivers. Asserted by
      identity, not by count.
- [ ] The `// ` prose case is decided and its ruling recorded here.
- [ ] **Deliberately not a box:** "`doctor …` reports zero orphan-exclusion
      findings." It is satisfied **today, before any fix**, by a capability
      that does not exist — a false floor. Checkbox 3 above (the parser over
      its own source, by identity, red today at 12) is the load-bearing one.
      Re-add a `doctor` box only once plan 0150 Phase 4 has landed, paired with
      a fixture carrying a genuine stale directive that must still report one.
- [ ] eess-md's HTML-comment form is covered in the same pass, or its exclusion
      from scope is stated.
- [ ] `npm run validate` green.

## A wider question this raises

ts-archunit fixed this as **its own bug 0043**, and the fix did not come across
in plan 0088's fold. That is not necessarily a one-off. ts-archunit has **72
fixed bugs**; **52 of them name a file `packages/core/src` also has**. Each is
a fix that either came across with the engine or did not, and nothing in the
fold's own record distinguishes the two — 0043 was found only because plan
0150 happened to build the one consumer that reads the parse.

This does **not** claim the other 51 are missing; it claims nobody has
checked, and that the one sample taken came back negative. The audit is
mechanical and bounded (for each, does eess's copy carry the fix?), and the
honest time to run it is **before [plan 0100](../plans/0100-publish-the-fold-retire-ts-archunit.md)
publishes the fold** — today `npm` still serves the pre-fold `0.2.2`/`0.2.1`,
so nothing folded has reached a user yet.

## Impact on plan 0150

Plan 0150 Phase 4 (`orphanExclusions()`) is **blocked** on this. Its port
carried ts-archunit's soundness claim — _"Sound because `parseExclusionComments`
only ever removes directives when blanking literals"_ — into a kernel that does
no blanking, so the claim is false here and the capability is unusable against
any real corpus. 0150 has been returned to Ready with Phase 4 unbuilt rather
than shipped with a 100% false-positive rate.

Deferred: none.
