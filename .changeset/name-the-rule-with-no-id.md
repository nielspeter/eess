---
'@nielspeter/eess': patch
'@nielspeter/eess-ts': patch
---

Name an id-less rule by its `.because()` reason in the "declares no id" diagnostic

A rule with no `.rule({ id })` cannot honour an exclusion comment, and eess says
so. But an id-less rule has no id to name, so several such chains over one file
printed byte-identical lines — three chains, three identical warnings, and no way
to tell which one needed the id without re-reading the rule file and counting.

`.because()` works without `.rule({ id })`, and its reason is already stamped
onto violations before the exclusion scan runs. So the message names the rule by
it when there is one:

```
[eess] This rule ("no eval in handlers") declares no id, so no exclusion
comment can apply to it — …
```

A rule with neither an id nor a reason is genuinely anonymous, and its message is
unchanged. Whitespace in the reason is collapsed, because the reason is prose and
may wrap while this report is deliberately one line per file.

Diagnostic text only — nothing is suppressed differently and no exit code moves.
Both copies of `applyFilters` changed together, which
`engine/applyfilters-parity` checks: landing it in the kernel alone makes the
copies diverge and fails the build.
