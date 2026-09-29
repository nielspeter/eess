---
'@nielspeter/eess-ts': patch
---

`doctor` and `check` agree about a healthy ratchet

Fixes [bug 0357](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0357-doctor-reports-a-healthy-ratchet-as-a-dead-glob.md).
`doctor` reported every healthy `.notExist()` rule as a dead glob. A rule asserting
cardinality matches nothing _because that is what it asserts_, and `diagnose()` applied that
exemption only in its zero-subjects branch — never on the dead-glob path a ratchet actually
takes. So a rule doing its job was previewed as broken, and the natural response is to delete
or "fix" it.

`check` was already right, which is what made this worth fixing now rather than later: the
companion release tells you to go and inspect your `.notExist()` rules, and `doctor` is what
you would reach for first.

Both tools now share one predicate — a dead selector on a cardinality rule is a fault only
when the path it names **holds TypeScript on disk**. The code being asserted away is right
there and the rule did not see it. A genuinely absent path stays silent in both tools, which
is the ratchet working.

**No rule changes verdict.** This is `doctor` output only; `check` is untouched, and a
`patch` rather than a break for that reason.
