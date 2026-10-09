# Bug 0408: a label without its colon is neither read nor reported

## Status

- **State:** Draft — reproduced 2026-10-09 against this repository's build at `2b6f491`. No red
  test yet.
- **Severity:** Medium — a false green the instrument does not disclose (ADR-016 rule 7). A
  declaration written `**Related to** [b](b.md)` is not selected by an `areLabelled()` rule for
  that label, and nothing reports it, so a rule over the declared links passes while that relation goes
  unchecked. Exposure: every `areLabelled()` rule; in this repository, ADR-018's
  `- **Extends** [ADR-009](…)` is outside the ADR Extends rule for this reason alone (plan 0406).
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

Plan 0405's label grammar requires the colon in every form (`packages/md/src/model/label.ts`), so
a bold word with no colon is not a label to `wrappedLabelOf`, and the near-miss scan only runs over
what `wrappedLabelOf` returns. `isNearMiss` compares case and inner spacing only, so a different
spelling (`Related` for `Related to`) is not a near miss either.

The colon is required on purpose: it stops prose that merely begins with the word — `Related to
bug 0253, see …` — from reading as a declaration (plan 0405's decision). That reason holds for
plain text. It is weaker for a **bold** word that opens a block and is followed by a link, which an
author writes only as a label.

## Fix

Not designed. The decision is plan 0405's grammar, so the fix is a change to it, measured against
this repository's corpus for false positives before it is chosen. Directions to weigh:

- report a bold run that opens a block and matches the declared label except for its missing
  colon, as a near miss with the remedy "add the colon";
- whether a different spelling (`Related` / `Extend`) is in scope at all, or stays the documented
  blind spot it is now (plan 0406's dogfood rule states it).

Selecting the colon-less form, rather than reporting it, would re-open the prose false positive the
colon exists to prevent.

## Verification

- [ ] Red test written first: `- **Related to** [b](b.md)` and `**Related to** [c](c.md)` are
      each reported, on their own line, with a remedy that clears the finding
- [ ] `Related to bug 0253, see [x](x.md)` (plain, no colon) stays unreported and unselected
- [ ] ADR-018 is decided either way: given its colon (and answered by ADR-009 and ADR-010), or
      left out on purpose with the reason stated
- [ ] `npm run validate` green.

Deferred: none.
