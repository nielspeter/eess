---
'@nielspeter/eess': patch
'@nielspeter/eess-ts': patch
---

A deferred warning's `accepted` list now holds across checkouts (bug 0389). `asSeverity('warn', { accepted })` compared each finding's raw subject. Producer identities carry the absolute path, so a list written on one machine matched nothing on another and every accepted finding escalated to error on CI. The advice text also printed the author's path for adopters to paste.

The subject is now compared, and printed, with the identity root scrubbed out. That is the form the baseline hash already used. The root is the identity root above the project's tsconfig. A builder that names no project gets no root and keeps its raw subjects, as before: a root found per finding was measured to let an entry for one package forgive the same finding in another.

The collision guard now also compares the scrubbed subject. If two findings scrub to one subject in a run (the checkout path can appear inside a file path), every finding of that deferred warning escalates to error, and the advice names the cause.

A list pasted before this change, holding raw paths, still matches in the checkout it was written in. A list written elsewhere with a raw path still escalates to error, as before.

Kernel: `portableSubjectOf(violation, root?)` in `@nielspeter/eess/internal` is now the single definition that both baseline hashes and the `accepted` comparison use. Hash values are unchanged.
