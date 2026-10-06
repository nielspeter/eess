---
'@nielspeter/eess': patch
'@nielspeter/eess-ts': patch
---

A deferred warning's `accepted` list now holds across checkouts of the same repository, for a builder that names its project (bug 0389). `asSeverity('warn', { accepted })` compared each finding's raw subject. Producer identities carry the absolute path, so a list written on one machine matched nothing on another, and the advice text printed the author's path for adopters to paste.

The advice now prints a portable form: each path in the subject becomes `<root:NAME>/relative/path`, where the root is the nearest `.git` or workspace marker above the project's tsconfig and NAME is that root's `package.json` `name`. A finding matches an entry by its raw subject or by that form, so a list written before this change still matches in the checkout it was written in.

No portable form, and so the old behaviour, for a builder that names no project, a repository without a root `package.json` name, or a path written inside prose. A finding whose own subject already contains `<root:` turns portable matching off for its rule and escalates the rule's findings, with advice naming the cause. Two known residuals are stated and tested: two different repositories that share one `package.json` name, checked by one rule file with one list, share an entry for the same relative path; and an entry kept for a finding that spelled `<root:`, once that finding is fixed, can equal another finding's portable form.

Kernel: `discoverNamedRepository` and `portableTokens` in `@nielspeter/eess/internal`. `portableSubjectOf` is now the one definition both baseline hashes use. Hash values are unchanged.
