# Bug 0279: the barrel criterion has no memory and no adopter signal

## Status

- **State:** Draft — the cause behind three incidents, named after the third.
- **Severity:** Medium-to-high — each occurrence has broken a real adopter's
  build, and the mechanism guarantees a fourth.
- **Origin:** external · architecture review of the fix for
  [bug 0278](./fixed/0278-the-strict-family-barrel-kept-the-count-and-dropped-the-functions.md),
  which measured that this is the third pass, not the first.

## Symptom

The criterion for removing a symbol from a published barrel is: nothing outside
this package's own `src/` references it, and no `docs/` page or README teaches
it. It is a good criterion and it has removed a lot of genuine plumbing.

It is also measured **entirely inside this repository**, where no adopter is
visible, and it keeps no record of why a name is present. Both halves matter.

## Measured

Three passes, three regressions found by adopters rather than by a gate:

| pass        | outcome                                                                                                                                                                                        |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pre-`0.4.0` | dropped exports; **20 restored** in `0.4.0`, "found by an adopter review that diffed every subpath"                                                                                            |
| `0.5.0`     | dropped 54 from `eess-ts`; `isStrictFamily`/`resolveFlag` broke an adopter's rule file at ESM load ([0278](./fixed/0278-the-strict-family-barrel-kept-the-count-and-dropped-the-functions.md)) |
| —           | of the 20 restored in `0.4.0`, **8 were removed again in `0.5.0`**                                                                                                                             |

The eight:

```
buildDiskSet, emptyProjectAdvice, globSitesOf, isDeadGlobTree,
isDeadSite, isTypeOnlyReExport, loadedNothing, splitGlobArgs
```

Each was restored because somebody outside this repo needed it. Nothing recorded
that, so the next pass applied the same criterion to the same names and reached
the same conclusion.

## Why the obvious fixes are wrong

**"All exports of a module or none."** Measured against the `0.5.0` diff: six
modules were split, and the rule would force `buildDiskSet`,
`registerProjectRoots` and `collectCalls` back onto the published barrel. It
false-positives on most of the population. The removal changeset had already
considered and rejected this, stating the principle with an example.

**"Just be more careful."** Three passes say otherwise.

## The corruption that must produce a violation

A symbol that was previously restored to a barrel, removed again, with nothing
recording why it was restored.

That one is checkable today and is the narrow, honest first step — a restored
name is visible in the changelog history, so a pass that removes one could be
made to say so rather than proceeding silently.

## The harder half

A signal from outside the repo. Options worth weighing rather than assuming:

- **A published-surface snapshot per release**, diffed automatically, so a
  removal is reported as a break in the release notes by name rather than by
  category. `0.5.0` shipped its list only after an adopter hit it.
- **A deprecation pass before removal** — one release where the export remains
  and warns. Nothing in this family does that today.
- **Deciding that the barrel is frozen** and additions are the only change.

Each is a decision about how the public surface evolves, which belongs in
ADR-011 rather than in a bug fix.

## Verification ledger

- [ ] The prior question answered and recorded: is the published barrel allowed
      to shrink at all, and if so on what signal?
- [ ] If removals continue: the restored-then-removed-again case made to fail,
      red test first, using the changelog history that already records it.
- [ ] A decision on the deprecation pass, either way, so the next removal is
      deliberate rather than defaulted.
