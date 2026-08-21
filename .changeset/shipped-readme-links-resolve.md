---
'@nielspeter/eess-ts': patch
---

The published README's links work from the published package, and the docs stop teaching deprecated API.

Two consumer-visible fixes, both found by pointing this package's own doc gates at
the real repository for the first time (bug 0179).

**README links.** `README.md` ships in the npm tarball; `../../README.md` and
`../../docs/agent-integration.md` did not, because `files` is
`['dist', 'README.md', 'LICENSE']`. Both links resolved to nothing for anyone
reading the package on npm or in `node_modules` — which is where an agent
inspecting an installed dependency looks. They are absolute now, and the same
class of link is repaired in the other four packages' READMEs.

**Scoped honestly:** this fixes the _relative_ links. The README also carries ten
`nielspeter.github.io/eess/*` URLs, including the three in its masthead, and those
currently 404 because no Pages deploy exists — tracked separately, not fixed here.

**Deprecated API in the documentation.** The docs presented eight deprecated
methods as the primary spelling, in "Available Conditions" tables rather than in a
migration note: `notImportFromCondition`, `notImportFromConditionWithOptions`,
`shouldExtend`, `shouldImplement`, `shouldHaveMethodNamed`,
`conditionHaveNameMatching`, `shouldResideInFile` and `shouldResideInFolder`. Each
is `@deprecated` in this package's own source, pointing at the replacement to use
after `.should()`. The docs now name the replacements. No API changed — if you
copied an example, your code still works, and the deprecation notice tells you what
to move to.
