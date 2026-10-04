---
'@nielspeter/eess-ts': patch
---

A dead-glob finding states its scope once, and no longer chooses your fix for you

Fixes [bug 0372](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0372-the-file-not-folder-sentence-says-it-can-never-match-twice.md).
Message text only — no rule changes verdict, and these findings never enter a baseline.

For a glob naming a **file** where a directory is read (`resideInFolder('**/docs/readme**')`), the
finding in 0.11.0 had three problems in one line:

- **It claimed its scope twice.** The headline said "can never match anything in this project" —
  correct, since the same text matches fine where that name is a directory — and the cause then
  said "so it can never match", unqualified. The cause now makes no scope claim; the headline owns
  it.
- **It named `resideInFile()` twice**, once in the cause and once in the remedy.
- **Its last sentence leaned toward one fix.** The cause offers two edits — `resideInFile()` for a
  file, or append `/**` for a directory — and the remedy is the last sentence, where an agent acts.
  For a `.notExist()` rule meaning a file is the common case, and widening the glob to the parent
  folder changes what the rule asserts. The remedy now defers to the cause:

> this matches a FILE but is used where a directory is read — use resideInFile() for a file, or
> append "/\*\*" to name the files inside a directory. Apply whichever of those two fixes you meant
> — this rule has not been enforcing anything. Do not delete it.

**If you match on this text,** it moved in both tools: `check`'s message and `Fix:` line, and
`eess-ts doctor`'s advice, which reads the same table. `docs/migrating-to-0.11.md` is updated to
quote it.
