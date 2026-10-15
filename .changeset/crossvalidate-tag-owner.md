---
'@nielspeter/eess-crossvalidate': minor
---

The Mermaid bindings take the tag comparison from eess-md

**Breaking (@nielspeter/eess-crossvalidate) — eess-crossvalidate now needs eess-md `>=0.11.0`.**
`embeddedDiagramsMatchCode` (`./md-mermaid`) and `tableErAgree` (`./md-mermaid-er`) read a fence's
tag with eess-md's comparison ([ADR-019](https://github.com/nielspeter/eess/blob/main/adr/019-a-code-blocks-language-tag-is-read-in-any-letter-case.md)),
which eess-md 0.11.0 adds; with an older eess-md those two entry points fail to load. What they
read is unchanged: a tag in any letter case, and no aliases (` ```mmd ` is not read as Mermaid).

The peer floor is the whole package's, so an adopter of any entry point who has eess-md installed
moves to 0.11.0 with this release. The other five entry points load nothing new from eess-md at
runtime, and `./mermaid-ts`, `./gherkin-ts`, `./md-ts` and `./files` still load without it.

**For the release commit:** raise `peerDependencies['@nielspeter/eess-md']` in
`packages/crossvalidate/package.json` from `>=0.10.0` to `>=0.11.0` there, beside the version bump
(RELEASING.md: never before the version exists). Nothing checks it (bug 0432).
