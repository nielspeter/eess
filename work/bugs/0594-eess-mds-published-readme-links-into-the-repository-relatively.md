# Bug 0594: eess-md's published README links into the repository relatively

## Status

- **State:** Draft — measured 2026-11-01; no red test yet.
- **Severity:** Low — documentation drift on a published surface: an adopter reading the package on
  npm, or in `node_modules`, follows six links that go nowhere. No verdict is wrong.
- **Origin:** self-found · [proposal 024](../proposals/024-md-an-images-file-exists.md)'s review,
  2026-11-01, measured while checking a claim about the root README, which did not reproduce.
- **Reported:** 2026-11-01

## Symptom

`@nielspeter/eess-md` publishes its `README.md` (`files` in `packages/md/package.json`: `dist`,
`README.md`, `LICENSE`). Six of its links are relative links into the repository's `docs/`, which
is not published:

```text
packages/md/README.md:162  ](../../docs/markdown.md#a-documents-shape-built-from-blocks)
packages/md/README.md:566  ](../../docs/markdown.md#unique-values-beuniqueby)
packages/md/README.md:588  ](../../docs/markdown.md#a-labelled-value-fields)
packages/md/README.md:619  ](../../docs/markdown.md#a-value-agrees-with-its-folder-agreewithfolder)
packages/md/README.md:631  ](../../docs/markdown.md#a-value-agrees-with-the-documents-own-path-agreewithpath)
packages/md/README.md:665  ](../../docs/markdown.md#code-blocks-that-parse)
```

On npm and in an installed `node_modules/@nielspeter/eess-md/README.md`, each resolves to a path
that does not exist. The other five packages' READMEs hold no `../` link (measured 2026-11-01).

## Root cause

`packages/ts/tests/docs/shipped-links.test.ts` asserts that a shipped README holds no relative link,
"because the directories they point at are not published", but it reads eess-ts's own `README.md`
only (`const SHIPPED = ['README.md']`, line 39). No test reads the other packages' shipped Markdown,
so eess-md's six links went unseen.

## Fix

Write the six links as absolute links to the repository on GitHub, as eess-ts's README does, and
widen the shipped-links test to every package's `files`, so a relative link in any published
Markdown is red.

## Verification

- [ ] Red test written first: the widened test reds on `packages/md/README.md`'s six links.
- [ ] The six links are absolute and resolve to their headings on GitHub.
- [ ] A changeset naming `@nielspeter/eess-md` (its published README changes).
- [ ] `npm run validate` green.

Deferred: none
