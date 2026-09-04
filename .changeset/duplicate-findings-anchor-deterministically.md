---
'@nielspeter/eess-ts': minor
---

**Breaking: which file a duplicate finding is reported at no longer depends on
the filesystem.**

Marked breaking on purpose. An inline `// eess-exclude` you committed against a duplicate can stop
suppressing after this upgrade, with no change on your side — a green build goes
red. That the old location was never durable is the defect being fixed, not a
reason to ship the change quietly as a patch.

A duplicate concerns several bodies and is reported at one of them. That location
is where you put `// eess-exclude`. It was whichever member the source walk
reached first — so the same duplicate could report at `a.ts` on your machine and
`b.ts` in CI, and a waiver committed against the first would silently stop
suppressing.

The identity beside it was already sorted for exactly this reason. The location
now uses the same ordering, by path then line.

Baselines are unaffected: the identity has not changed. What can change is the
`file`, `line` and `element` printed for a duplicate whose members were
previously reported in a different order — and if you have an inline waiver that
was working, it was working against a location that could have moved anyway.

Five smaller things move with it, all of them the same defect further down the
same finding, and all of them output you may be reading or diffing:

- A cluster finding lists the members it shows in path-then-line order rather
  than walk order. `+N more` elides the rest, so which member you never saw used
  to be the filesystem's choice.
- The varying axes quoted as evidence come from a pair chosen the same way, and
  the `from -> to` direction follows the members rather than the walk — for pair
  findings as well as clusters. The same finding could read `'x' -> 'y'` locally
  and `'y' -> 'x'` in CI.
- `.groupByFolder()` groups by the folder a finding is REPORTED in. It grouped by
  the walk-order endpoint, which stopped agreeing with the reported location once
  the anchor moved.
- **The order findings are reported in** is now deterministic. Duplicate findings
  are ranked into four buckets and the sort is stable, so equal-ranked findings —
  the overwhelming majority — kept whatever order the filesystem produced. They
  now tie-break on the anchor path.
- Folder names are compared directly rather than with `localeCompare`, whose
  result depends on the runtime's ICU build and default locale. Same reason: a
  report should read the same on two machines.

If you diff eess-ts output between runs or machines, expect this release to be
the last one where those diffs are noise.
