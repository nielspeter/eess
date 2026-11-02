# Bug 0590: a mention's absence finding does not name its match

## Status

- **State:** Draft — reproduced 2026-11-01 on `packages/md/dist`, built from the current tree; no
  red test yet.
- **Severity:** Low — fails closed: every match is reported, at the right line, but two findings on
  one line read the same, so the author cannot tell which text to fix.
- **Origin:** self-found ·
  [proposal 023](../proposals/023-md-a-footnote-reference-has-its-definition.md)'s review (the
  product and enforcement lenses, and the synthesis); reproduced before filing.
- **Reported:** 2026-11-01

## Symptom

`mentions(c, { pattern }).should().notExist()` reports each match as
`docs/guide.md:3 should not exist`. The finding names the document and the line, and never the
text that matched. When one line holds two matches, the two findings are identical, in
`violations()` and in `check()`'s output alike.

This is the shape [bug 0558](./0558-a-reference-style-or-raw-html-link-is-never-examined.md)'s
dangling-reference example ships (`examples/md/a-reference-with-no-definition-is-reported.test.ts`).
Its three violating fixtures pin the message `docs/guide.md:3 should not exist`
(`examples/md/a-reference-with-no-definition-is-reported.test.ts:52`). A reference whose
definition was renamed is reported without its label, so the author must find the brackets by eye.
[Proposal 023](../proposals/023-md-a-footnote-reference-has-its-definition.md)'s footnote
composition would inherit the same message.

## Reproduction

`docs/guide.md`, with two references whose labels are misspelt on line 3:

```markdown
# Guide

See [setup][setpu] and [reference][refrence].

[setup]: ./setup.md
[reference]: ./reference.md
```

The example's rule (`mentions()` with its `REFERENCE` pattern,
`.that().satisfy(not(areLinked())).should().notExist()`, its id and its `because`). Measured with a
throwaway script against `packages/md/dist`, 0.14 s:

```text
2 findings
{"element":"docs/guide.md:3","file":"docs/guide.md","line":3,"message":"docs/guide.md:3 should not exist"}
{"element":"docs/guide.md:3","file":"docs/guide.md","line":3,"message":"docs/guide.md:3 should not exist"}
--- check() output:
Architecture Violation [1 of 2]

  Rule: that not (are in a link) should not exist

  docs/guide.md:3 should not exist
  fx/docs/guide.md:3 — docs/guide.md:3
  Why: a reference whose definition is gone is not a link: GitHub shows its brackets

Architecture Violation [2 of 2]

  Rule: that not (are in a link) should not exist

  docs/guide.md:3 should not exist
  fx/docs/guide.md:3 — docs/guide.md:3
  Why: a reference whose definition is gone is not a link: GitHub shows its brackets
```

Neither finding contains `[setup][setpu]` or `[reference][refrence]`.

## Root cause

The kernel's `notExistCondition` writes `${name} should not exist`
(`packages/core/src/not-exist.ts:27`), where the dialect supplies the name. eess-md's
`MentionRuleBuilder.locate` returns `atLine(m)` (`packages/md/src/builders/mentions.ts:142`).
`atLine` names an element `relPath:line` (`packages/md/src/conditions/not-exist.ts:32`), so the
mention's matched text (`MdMentionMatch.text`, `packages/md/src/model/mentions.ts:24`) never reaches
the finding.

The links, sections, rows, pointers, task-items and vocabulary builders also name their elements
with `atLine`. Whether their findings need the same change is outside this record. This record
covers mentions, whose element is a caller's pattern and so has no other name.

## Fix

Not designed. The direction: a mention's `locate` names its matched text beside its location,
such as ``docs/guide.md:3 `[setup][setpu]` should not exist``. The example's three pinned
messages change with it.

## Verification

- [ ] Red test written first, through `mentions().should().notExist()`: two matches on one line
      give two findings, each naming its own matched text.
- [ ] A match that spans a soft break is named readably on one line.
- [ ] The dangling-reference example's pinned messages name the reference.
- [ ] A changeset naming `@nielspeter/eess-md`.
- [ ] `npm run validate` green.

Deferred: none
