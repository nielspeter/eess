# Bug 0208: a preset spread without `report: 'builders'` loses its rules silently when other rules survive

## Status

- **State:** Draft — measured end-to-end from packed tarballs by an adopter walking
  the migration guide.
- **Deferred:** none
- **Found:** 2026-08-22, customer review of PR #78.

## Symptom

`export default [...recommended(p), ...myRules]` on a codebase with **no
violations**. The preset runs, finds nothing, returns an empty violations array, and
the spread contributes nothing. The hand-written rules still load.

Measured on a real migrated project — preset + two security rules + a
`crossProject`, identical code, only the `report` option differing:

```
without report: 'builders'   ✓ eess-ts — 3 rules across 1 file · 0 failing   exit 0
with    report: 'builders'   ✓ eess-ts — 7 rules across 1 file · 0 failing   exit 0
```

Four rules gone. Green tick. Exit 0. Nothing printed.

## Why the existing guard misses it

[Bug 0204](./fixed/0204-check-blessed-a-rule-file-that-enforced-nothing.md) made
`check` refuse a rule file that contributed **zero** rules. That fires only when the
preset was the file's _only_ source of rules. Beside any surviving rule the count is
non-zero and plausible, so nothing reports.

**And the migration guide's own detector missed it too**, which is how this was
found: the guide said to read the summary for `0 rules across N files`. The failing
run reads `3 rules across 1 file`. An adopter doing exactly what the page said, at
the moment it said to, concludes the migration succeeded. The guide now teaches a
before/after comparison instead (PR #78).

## Why this is hard, stated before anyone proposes the easy fix

At the point the CLI sees the array, **there is nothing wrong with it.** It is a
well-formed list of builders — just shorter than the author intended. The spread of
an empty array leaves no trace. No type error (`tsc` accepts a spread of the wrong
array type), no runtime error, no missing entry to detect.

So this cannot be caught by inspecting the rule file's export. If it is catchable at
all, it is at the **preset** end.

## Fix

Not decided. One candidate, which is why this is filed rather than declared
unfixable:

`deliver()` (`packages/ts/src/presets/shared.ts`) knows all three facts at the
moment they matter — it is under an aggregating caller (`callerAggregates()`), it is
returning a **violations array** rather than builders, and that array is **empty**.
That combination has no legitimate use: a preset called for its side effects under
the CLI, returning nothing, whose result is about to be discarded or spread. It could
report a configuration finding naming the file and the remedy.

Risks to weigh before building it:

- **False positives.** A preset called in `'throw'` mode whose result the author
  genuinely discards — `recommended(p)` as a bare statement, not spread — is
  legitimate and hits the same combination. The finding would need to distinguish
  "returned into a spread" from "returned into nothing", which the preset cannot see.
- It would fire on a **passing** codebase, which is where users trust green most.
- [Bug 0205](./0205-four-emitters-restate-the-suppression-rule-and-disagree.md) is
  already about `deliver()` and its siblings disagreeing on a contract; adding a
  fourth responsibility there wants sequencing against it.

## Verification

- [ ] Red test first: a rule file with a preset spread **and** a surviving rule, on a
      clean fixture project, must not report a plausible count with the preset's
      rules missing.
- [ ] The discriminator: a preset called for effect and legitimately discarded must
      not fire.
- [ ] `docs/migrating-from-ts-archunit.md` §1's before/after comparison remains the
      documented detector until a mechanism exists.
