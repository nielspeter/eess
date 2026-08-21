---
'@nielspeter/eess': patch
'@nielspeter/eess-ts': patch
---

`reportViolations` counts the violations it writes, exposed as
`violationsEmittedCount()`.

Purely additive: an internal counter and an accessor, no behaviour change. Nothing
about when or what `reportViolations` emits is different.

**Why it exists.** A caller that aggregates reporting — `eess-ts check` — needs to
know whether anything emitted while it was loading a rule file, so it can tell the
user their `--baseline` / `--changed` did not apply to output that was printed
before the CLI saw it.

The version of that check which shipped first counted the writes it **suppressed**
and read the absence of a suppression as "nothing was written". That is a double
negative and it is unsound: a rule file that silences one terminal while leaking
through another satisfies it _while leaking_. Measured — a `report: 'warn'` preset
beside a silenced `.check()` in one file leaked 7 violation blocks and the run said
nothing at all. A silence built on a stale signal is worse than the false claim it
replaced.

Counting emissions answers the question directly, at the site that does the
emitting. `eess-ts` counts its own second emitter the same way and reads the sum.

The accessor is kernel plumbing rather than a surface to write rules against, so
`eess-ts` does not re-export it.
