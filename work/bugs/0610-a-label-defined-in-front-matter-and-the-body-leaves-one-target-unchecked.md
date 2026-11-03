# Bug 0610: a label defined in front matter and in the body leaves one target unchecked

## Status

- **State:** Draft — measured 2026-11-03 on PR #302's branch, from its enforcement review; no red
  test yet.
- **Severity:** High — a false green, narrow: a broken target a reader can follow passes.
- **Origin:** self-found · PR #302's enforcement review of [bug 0572](./fixed/0572-a-definition-in-front-matter-hides-a-reference-in-the-body.md).
- **Reported:** 2026-11-03

## Symptom

A line-1 `---` block holds `[g]: ./gone.md` (on an indented continuation line of a valid YAML
value), and the body holds `See [g].` and `[g]: https://example.com`. Two readers disagree about
the reference:

- A renderer that drops front matter (GitHub, VitePress) uses the body's definition.
- A reader of the whole document as Markdown uses the first definition, the block's `./gone.md`.

eess-md keeps the block front matter here ([bug 0572](./fixed/0572-a-definition-in-front-matter-hides-a-reference-in-the-body.md)'s fix counts a block definition only
when the body does not also define its label), so it checks the body's definition and never the
block's. The block's broken `./gone.md` passes. Reading the block as Markdown instead would hide the
body's definition the same way: measured on the branch before the rule was narrowed, a body
`[g]: ./gone.md` behind a block `[g]: ./b.md` passed.

## Root cause

`links()` gives a reference one definition, the first of its label (`definitionsOf`,
`packages/md/src/model/definitions.ts:48`), and the front-matter guard picks one reading of the
document. With a label defined on both sides of the block's edge, each reading uses a different
definition, and one of them is never resolved.

## Fix

Not designed. Options: check both definitions when a label is defined on both sides of the edge; or
report the doubly defined label as a finding this rule cannot judge, naming both lines
([ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)'s class).

## Verification

- [ ] Red first: the block's broken `./gone.md` above is reported, or the label is reported as
      doubly defined.
- [ ] [Bug 0572](./fixed/0572-a-definition-in-front-matter-hides-a-reference-in-the-body.md)'s two rows for this shape (`packages/md/tests/front-matter-guard.test.ts`) are
      updated to the new verdict.
- [ ] A changeset naming `@nielspeter/eess-md`.
- [ ] `npm run validate` green.

Deferred: none
