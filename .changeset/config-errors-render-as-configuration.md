---
'@nielspeter/eess-ts': patch
---

**A misconfigured rule file no longer renders as a crash.**

`ArchConfigError` was added so that a rule author who mistyped an argument would
see something different from an unhandled failure. It shipped with 17 throw
sites and nothing reading it: every one landed in the same generic branch as a
syntax error or a missing dependency, which is the surface it was introduced to
fix.

The CLI now branches on it. A configuration fault names **what** was
misconfigured — `havePropertyNamed`, `requireGraphQL`, `workspace` — points at
the call rather than the file, and says plainly that editing the code under test
cannot clear it. The generic path is unchanged and still refuses to guess a
cause, which is why the two are worth telling apart.

It also surfaces `cause`, which nothing rendered before. That is the only thing
separating "the graphql package is not installed" from "it is installed but
failed to load" — the same distinction the loader's own code takes care to
preserve and which was being dropped on the way to the reader.
