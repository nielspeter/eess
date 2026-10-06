---
'@nielspeter/eess': patch
'@nielspeter/eess-ts': patch
---

A deferred warning's `accepted` list now holds across checkouts (bug 0389). `asSeverity('warn', { accepted })` compared each finding's raw subject. Producer identities carry the absolute path, so a list written on one machine matched nothing on another and every accepted finding escalated to error on CI. The advice text also printed the author's path for adopters to paste.

The subject is now compared, and printed, with the identity root scrubbed out. That is the form the baseline hash already used. The root is the identity root above the project's tsconfig, or above the finding's own file when the builder names no project. A finding whose `file` is not an absolute path gets no root.

The collision guard now compares the same scrubbed subject. If two findings under different roots scrub to one subject, every finding of that deferred warning escalates to error, and the advice names the cause and its remedy (one `.git` or workspace marker above both). Before, one accepted entry would have forgiven both.

A list pasted before this change, holding raw paths, still matches in the checkout it was written in. A list written elsewhere with a raw path still escalates to error, as before.

Kernel: `portableSubjectOf(violation, root?)` in `@nielspeter/eess/internal` is now the single definition that both baseline hashes and the `accepted` comparison use. Hash values are unchanged.
