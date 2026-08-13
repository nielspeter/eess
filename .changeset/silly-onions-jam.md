---
'@nielspeter/eess-md': minor
---

`resolve()` can now resolve a link naming a real directory, even with no index
file: `LinkResolveOptions.resolveDirectories` (default `false`).

A link to `./fixed/` (or `./fixed`, no trailing slash — both forms resolve)
was always reported broken if `fixed/` had no `tryIndex` file inside it, even
though the directory genuinely exists and GitHub/GitLab render it fine as a
listing. There was no resolvable shape for "this is a directory" at all —
`tryIndex` only covers "this directory's page is its index file," a different,
narrower claim.

```ts
links(c).that().areInternal().should().resolve({ resolveDirectories: true })
```

Directory existence is derived from the corpus's own file index — every
indexed file's ancestors are known directories — so this costs no new
filesystem access.

**Off by default, deliberately.** Widening what "resolves" means is a false
green waiting to happen: correct for a repo-hosted corpus (GitHub, GitLab
render any real directory), wrong for a static-site corpus where a bare
directory with no index is not a page the site would actually serve. Existing
callers see no behaviour change unless they opt in.
