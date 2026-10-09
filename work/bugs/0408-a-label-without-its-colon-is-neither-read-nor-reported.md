# Bug 0408: a label without its colon is neither read nor reported

## Status

- **State:** Draft — reproduced 2026-10-09 against this repository's build at `2b6f491`. No red
  test yet.
- **Severity:** Medium — an honesty gap between a stated claim and its mechanism (`BUGS.md`'s
  Medium row). `docs/markdown.md:240` promises that a rule built with `areLabelled()` "also reports
  what it cannot read", including a label "at a block's start in a form it does not read" (`:250`).
  `**Related to** [c](c.md)` is that case and is not reported, so a rule over the declared links
  passes while that relation goes unchecked. Not High: the rule does not claim to read the
  colon-less form, and every `**Label:**` declaration it does select is checked.
- **Origin:** self-found · enforcement and architect review of plan 0406, 2026-10-09.
- **Reported:** 2026-10-09

## Symptom

A corpus with a correctly spelt `**Related to:** [k](k.md)` and four other attempts at the same
declaration, run through `links(c).that().areLabelled('Related to').should().resolve()`:

| Line                          | Selected | Reported                           |
| ----------------------------- | -------- | ---------------------------------- |
| `**Related to:** [k](k.md)`   | yes      | —                                  |
| `- **Related to** [b](b.md)`  | no       | **nothing**                        |
| `**Related to** [c](c.md)`    | no       | **nothing**                        |
| `**Related:** [d](d.md)`      | no       | **nothing**                        |
| `- **related to:** [e](e.md)` | no       | near miss: `write it "Related to"` |

Only the case near miss is reported. The rule examines `k` and passes.

## Reproduction

```ts
import { corpus, links } from '@nielspeter/eess-md'
// docs/a.md holds the five lines above, each in its own block; k.md … e.md exist.
const r = links(corpus({ roots: ['docs/**'] }))
  .that()
  .areLabelled('Related to')
  .should()
  .resolve()
r.select({ label: 'l', identify: (l) => ({ name: l.url }) }).elements // ['k.md']
r.rule({ id: 'x' }).violations() // one finding: the `related to` near miss
```

## Root cause

Plan 0405's label grammar requires the colon in every form (`packages/md/src/model/label.ts:13`), so
a bold word with no colon is not a label to `wrappedLabelOf` (`:60`). Neither of the two scans that
report what the selector cannot read looks at it:

- the near-miss scan (`packages/md/src/builders/declaration-findings.ts:84`) runs only over what
  `wrappedLabelOf` returns, and `isNearMiss` (`label.ts:72`) compares case and inner spacing only, so
  a different spelling (`Related` for `Related to`) is not a near miss either;
- the unread-label scan (`declaration-findings.ts:152`), which reports a label at a block's start
  "written with formatting eess-md does not read", only sees a bold run whose text ends in a colon
  or is followed by one.

The colon is required on purpose: it stops prose that merely begins with the word — `Related to bug
0253, see …` — from reading as a declaration (plan 0405's decision). A bold run is weaker evidence of
prose, but not none. ADR-018's Status block opens a prose sentence with one:

```md
- **Extends** [ADR-009](…) (rule 1, and rule 3's corollary) and [ADR-010](…) to the strings a rule
  is written in. Applies [ADR-016](…) where the checker cannot see.
```

Reading that as a label would make ADR-016 a declared target. That line is the counter-example any
fix is measured against.

ADR-018 is outside plan 0406's ADR Extends rule because it is Proposed, and that plan keeps it out
until it is ruled; its missing colon means the rule could not read it in any case.

## Fix

Not designed. The grammar is plan 0405's, so the fix is a change to it, measured against this
repository's corpus — ADR-018's sentence above among it — for false positives before it is chosen.
To weigh: reporting, not selecting, a bold run that opens a block and matches the declared label but
for its colon (selecting it would re-open the prose false positive the colon exists to prevent); and
whether a different spelling (`Related` / `Extend`) is in scope, or a blind spot the documentation
names, as `docs/markdown.md:245` names the plain-form case one.

## Verification

- [ ] Red test first, through the public entry point (`links().…rule().violations()`, not
      `wrappedLabelOf`): `- **Related to** [b](b.md)` and `**Related to** [c](c.md)` are each
      reported on their own line, or the documentation names the form as unread — whichever the fix
      decides — and a sabotage row goes red when that is undone
- [ ] `Related to bug 0253, see [x](x.md)` (plain, no colon) stays unreported and unselected
- [ ] ADR-018's prose sentence is not read as a declaration of ADR-016
- [ ] a different spelling (`**Related:**`) is either reported or named as a blind spot in the
      documentation
- [ ] plan 0406's exclusion of ADR-018 is unchanged by the fix
- [ ] `npm run validate` green.

Deferred: none.
