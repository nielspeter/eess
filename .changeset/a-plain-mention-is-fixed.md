---
'@nielspeter/eess-md': minor
---

`beLinked({ fix })` fixes a plain mention (plan 0550): when exactly one record, across every source you declare, holds the mention's key, the finding carries a fix linking it there, which `eess-ts check --fix` lists and `--fix --apply` writes. Anything else is refused, and the finding says why: no record or several, an undefined key, inline code, a `!` or `]` before it, a target no link destination can hold or outside the repository, a mention whose source text is not as written, or `foreign`, your pattern for another project's name, matching in the text around it. `foreign` is required and checked when `beLinked()` is called. Two configuration findings, `md/mention-fix-config`, report a fix that could link nothing. New exports: `MentionFix`, `BeLinkedOptions`, `MENTION_FIX_CONFIG`, and `MdMentionSpan` for a mention's new `span`, its place in the source; the kernel's `Selection` type is re-exported.
