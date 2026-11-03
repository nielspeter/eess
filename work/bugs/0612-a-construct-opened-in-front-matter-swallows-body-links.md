# Bug 0612: a construct opened in front matter swallows body links

## Status

- **State:** Draft — measured 2026-11-03 on main's front-matter guard; no red test yet.
- **Severity:** High — a false green: a broken body link a renderer that drops front matter shows
  is never examined.
- **Origin:** self-found · PR #302's third enforcement review round, on
  [bug 0572](./0572-a-definition-in-front-matter-hides-a-reference-in-the-body.md).
- **Reported:** 2026-11-03

## Symptom

`'---\na: |\n\n  [t](./b.md)\n\n  ```\nb: c\n---\n\n# A\n\n[bad](./gone.md)\n\n```\n'`, with
`docs/b.md` present: `links(c).that().areInternal().should().resolve()` examines 1 link and reports
nothing. The inline link `[t](./b.md)` makes the line-1 `---` block Markdown
([bug 0087](./fixed/0087-frontmatter-parsed-as-setext-heading.md)'s rule), and the fence the YAML
value opens then runs past the block's closing `---` and swallows the body up to the next fence,
`[bad](./gone.md)` included. GitHub and VitePress drop the front matter and show that broken link.
The reviewer measured the same with `<!--` and `<pre>` in place of the fence.

## Root cause

When the guard reads the block as Markdown, the document is parsed whole (`parseFresh`,
`packages/md/src/model/prose.ts:142`), so what the block opens is read as continuing into the body.
The guard decides from what the block holds, not from what the body loses.

## Fix

Not designed; [bug 0572](./0572-a-definition-in-front-matter-hides-a-reference-in-the-body.md)'s
spike measures the shared property: every link the front-matter reading examines outside the block
is still examined after the block is read as Markdown, or the document is a finding the guard cannot
judge.

## Verification

- [ ] Red first: the reproduction reports `./gone.md`, or names why the document cannot be judged.
- [ ] The `<!--` and `<pre>` forms, each pinned.
- [ ] A changeset naming `@nielspeter/eess-md`.
- [ ] `npm run validate` green.

Deferred: none
