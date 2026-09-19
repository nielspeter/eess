---
'@nielspeter/eess-md': minor
'@nielspeter/eess-crossvalidate': minor
---

**Breaking (@nielspeter/eess-md, @nielspeter/eess-crossvalidate):** `terms()` and
`scenarioCitationsResolve` set fenced examples aside with the markdown parser instead of a regex (bug
0287). The regex read a triple-backtick run inside a longer fence as a closer, so it blanked the real
reference or citation below such an example and read the ones written inside it. Both are corrected, so a
green rule may report a reference it could not see, and a red one may lose a finding that was an example.

What each shape does is unchanged from 0.6.0 otherwise: a fenced example inside an HTML block is set
aside, a fence with no closing line — left unclosed, or ended by its list item or blockquote — is read
past rather than dropping the rest of the document, and an indented example is read.

`@nielspeter/eess-md/internal` is a new entry point: family plumbing for eess-crossvalidate and for
gate scripts, not public API, as the kernel's `/internal` is (ADR-011).

eess-crossvalidate's `md-gherkin` entry imports `@nielspeter/eess-md/internal` at runtime, so it needs
the eess-md release that ships it. Its peer floor on eess-md is raised to that release in the release
commit (`RELEASING.md` step 3a).
