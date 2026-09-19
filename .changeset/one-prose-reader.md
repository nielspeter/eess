---
'@nielspeter/eess-md': minor
'@nielspeter/eess-crossvalidate': minor
---

**Breaking (@nielspeter/eess-md, @nielspeter/eess-crossvalidate):** `terms()` and
`scenarioCitationsResolve` set fenced examples aside with the markdown parser instead of a regex (bug
0287). The regex read a triple-backtick run inside a longer fence as a closer, so it blanked the real
reference or citation below such an example and read the ones written inside it. Both are corrected, so a
green rule may report a reference it could not see, and a red one may lose a finding that was an example.

A fenced example inside an HTML block is set aside however far the block's body is indented, and whatever
the length of its fence — where the regex set aside a simple one and mis-read a longer one; an indented
example outside an HTML block is read, as before.
unclosed, or ended by its list item or blockquote — is read past\*\*, where the regex's behaviour depended
on whether a later fence happened to pair with it: for `terms()` and `scenarioCitationsResolve` that
means a reference or citation under such a fence is now checked rather than silently dropped, which can
add a finding.

`@nielspeter/eess-md/internal` is a new entry point: family plumbing for eess-crossvalidate and for
gate scripts, not public API, as the kernel's `/internal` is (ADR-011).

eess-crossvalidate's `md-gherkin` entry imports `@nielspeter/eess-md/internal` at runtime, so it needs
the eess-md release that ships it. Its peer floor on eess-md is raised to that release in the release
commit (`RELEASING.md` step 3a).
