# Bug 0583: a local link with a query string never resolves

## Status

- **State:** Draft — reproduced 2026-11-01 on the build of main at `bd78b962`; no red test yet.
- **Severity:** Medium — a false red. The file exists and the link works where the document is
  read, and `resolve()` calls it broken, with no fix.
- **Origin:** self-found · [proposal 024](../proposals/024-md-an-images-file-exists.md)'s and
  [proposal 022](../proposals/022-md-a-raw-html-link-is-resolved.md)'s reviews, 2026-11-01.
- **Reported:** 2026-11-01

## Symptom

`[q](./logo.png?raw=true)` and `[q](./a.md?plain=1)` are reported as broken links when
`logo.png` and `a.md` sit beside the document. GitHub reads the part after `?` as a query, not as
part of the file name: `?raw=true` serves the raw file and `?plain=1` shows a Markdown file's
source. Both are common in READMEs.

Every reader that calls `resolveLink` inherits it: `resolve()`
(`packages/md/src/conditions/resolve.ts:59`), `beLinkedBack()`
(`packages/md/src/conditions/linked-back.ts:19`, `:123`), the live-target predicate
(`packages/md/src/predicates/live-target.ts:19`) and a mention's link target
(`packages/md/src/builders/mentions.ts:102`). Only `resolve()` was measured.

This repository holds no such link today.

## Reproduction

A throwaway script against `packages/md/dist`, over a fixture holding `logo.png`, `a.md`
(`# A`) and `readme.md`:

```markdown
# R

[q](./logo.png?raw=true)

[q2](./a.md?plain=1)

[q3](./a.md?plain=1#a)

[control](./logo.png)
```

```js
const c = corpus({ cwd, roots: ['**/*.md'] })
const v = links(c).that().areInternal().should().resolve().violations()
```

Measured output (0.14 s):

```text
examined: 4
readme.md → ./logo.png?raw=true  broken link: "./logo.png?raw=true" does not resolve to a file in the repo
readme.md → ./a.md?plain=1  broken link: "./a.md?plain=1" does not resolve to a file in the repo
readme.md → ./a.md?plain=1#a  broken link: "./a.md?plain=1#a" does not resolve to a file in the repo
```

The control link with no query passes.

## Root cause

`linkTargets` (`packages/md/src/model/resolve-link.ts:135`) cuts the URL at `#` only
(`packages/md/src/model/resolve-link.ts:136`) and decodes the rest as the path. The query stays in
the path, so the candidate is `logo.png?raw=true`, which no file is named.

`movedLinkFix` cuts at `#` only too (`packages/md/src/model/resolve-link.ts:278`), so a moved
target linked with a query gets no fix: its basename is `logo.png?raw=true`, which no file has.

## Fix

- In `linkTargets`, after cutting the fragment, cut the path at its first `?` before decoding. A
  `?` that is part of a file name is written `%3F` and decodes after the cut, so it still resolves.
- A URL that is only a query, `[x](?plain=1)`, names the document itself, as a pure fragment does.
- In `movedLinkFix`, keep the query and the fragment together as the suffix it carries over, so
  `./old.png?raw=true` is rewritten to `./new.png?raw=true`.

## Verification

- [ ] Red test written first: the reproduction's three links resolve, and `./gone.png?raw=true`
      is still broken.
- [ ] `./a%3F.md` resolves to a file named `a?.md`.
- [ ] `[x](?plain=1)` resolves to the document itself.
- [ ] A moved target linked with `?raw=true#x` gets a fix that keeps `?raw=true#x`.
- [ ] A changeset naming `@nielspeter/eess-md`.
- [ ] `npm run validate` green.

Deferred: none
