# Bug 0610: a label defined in front matter and in the body leaves one target unchecked

## Status

- **State:** Draft — measured 2026-11-03 on PR #302's branch, from its enforcement review; no red
  test yet.
- **Severity:** High — a false green, narrow: a broken target a reader can follow passes.
- **Origin:** self-found · PR #302's enforcement review of [bug 0572](./0572-a-definition-in-front-matter-hides-a-reference-in-the-body.md).
- **Reported:** 2026-11-03

## Symptom

A line-1 `---` block holds `[g]: ./gone.md` (on an indented continuation line of a valid YAML
value), and the body holds `See [g].` and `[g]: https://example.com`. Two readers disagree about
the reference:

- A renderer that drops front matter (GitHub, VitePress) uses the body's definition.
- A reader of the whole document as Markdown uses the first definition, the block's `./gone.md`.

eess-md keeps the block front matter here (a definition is not something the guard counts,
[bug 0087](./fixed/0087-frontmatter-parsed-as-setext-heading.md)'s rule), so it checks the body's
definition and never the block's. The block's broken `./gone.md` passes.

**The other direction is live on main** (measured by PR #302's re-check, identical on main and the
branch). When the block is read as Markdown for another reason, the block's definition wins and a
body `[g]: ./gone.md` is never examined, while a renderer that drops front matter shows that broken
link. Each input below also holds `# A`, `[ok](./b.md)`, `See [g].` and `[g]: ./gone.md` in the
body, with `docs/b.md` present; each is green:

| Why the block is Markdown                                                                                                      | The block's lines                                                              |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| a task box                                                                                                                     | `a: \|`, `  - [ ] t`, `  [g]: ./b.md`, `b: c`                                  |
| a YAML error                                                                                                                   | `a: b`, `a: c`, `[g]: ./b.md`                                                  |
| an inline internal link                                                                                                        | `a: \|`, `  [t](./b.md)`, `  [g]: ./b.md`, `b: c`                              |
| a reference to a body definition (the [bug 0566](./fixed/0566-a-front-matter-reference-defined-in-the-body-is-hidden.md) path) | `a: \|`, `  See [h].`, `  [g]: ./b.md`, `b: c`, with `[h]: ./b.md` in the body |

[Bug 0572](./0572-a-definition-in-front-matter-hides-a-reference-in-the-body.md)'s withdrawn fix (PR #302) added cases to this list; the rows it left, which hold on
main, are pinned in `packages/md/tests/front-matter-guard.test.ts` ("as main reads it").

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
      doubly defined; and each row of the table, in the other direction.
- [ ] [Bug 0572](./0572-a-definition-in-front-matter-hides-a-reference-in-the-body.md)'s rows for this shape (`packages/md/tests/front-matter-guard.test.ts`, "as main
      reads it") still hold, or change with the fix and say why.
- [ ] A changeset naming `@nielspeter/eess-md`.
- [ ] `npm run validate` green.

Deferred: none
