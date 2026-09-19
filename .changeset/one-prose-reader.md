---
'@nielspeter/eess-md': minor
'@nielspeter/eess-crossvalidate': minor
---

**Breaking (@nielspeter/eess-md, @nielspeter/eess-crossvalidate):** `terms()` and
`scenarioCitationsResolve` pair fenced code with the markdown parser instead of a regex (bug 0287). A
reference or citation below a four-backtick or four-tilde example holding a shorter run was blanked
before and is read now; one written inside such an example, or inside a fence its list item closes, was
read before and is set aside now. So a green rule may report a reference it could not see, and a red one
may lose a finding that was an example. A fence that never closes is read past, as before, and an
indented example is still read.

`@nielspeter/eess-md/internal` is a new entry point: family plumbing for eess-crossvalidate, not public
API, as the kernel's `/internal` is (ADR-011).

eess-crossvalidate's `md-gherkin` entry imports `@nielspeter/eess-md/internal` at runtime, so it needs
the eess-md release that ships it. Its peer floor on eess-md is raised to that release in the release
commit (`RELEASING.md` step 3a).
