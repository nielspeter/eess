---
'@nielspeter/eess-ts': patch
---

A dead-glob finding states its scope once, and names the fix once

Fixes [bug 0372](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0372-the-file-not-folder-sentence-says-it-can-never-match-twice.md).
Message text only — no rule changes verdict, and these findings never enter a baseline.

For a glob naming a file where a directory is read, the finding said two things of different
strength in one sentence: the headline scoped the fault to "in this project" (correct — the same
text matches fine where that name is a directory) while the cause clause said "so it can never
match", unqualified. It now reads **"so it can never match as a folder glob"**.

And `resideInFile()` was named twice in the same `Fix:` line, because that line is cause-then-remedy
and both halves offered it. The **cause** keeps it — a non-cardinality rule's remedy is "correct the
glob, or remove the rule" and names no edit, so stripping the cause would leave that author with
nothing concrete — and the remedy drops it:

> Correct the selector to name the DIRECTORY you mean — this rule has not been enforcing anything.
> Do not delete it.

**If you match on this text**, both strings moved. The advice is unchanged in substance.
