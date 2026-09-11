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

## The releaser has no diff either (measured 2026-09-11)

The criterion's blind spot has a second half: **nothing compares the
about-to-ship surface with the one already on npm.** `loadPublishedExports()` at
`packages/ts/tests/matrix/enumerate.ts:94` resolves the package by
self-reference — deliberate, so the exports map is under test — but it reads the
LOCAL build. Remove an export and its classification row in one commit and the
census passes at its new, smaller size. Measured: that is exactly the shape
`0.5.0` shipped.

The removal is also **not root-only**. Measured against the published `0.4.0`
barrel with a per-subpath diff:

| subpath     | published 0.4.0 | local | removed             |
| ----------- | --------------- | ----- | ------------------- |
| `.`         | 311             | 272   | 52                  |
| `./presets` | 8               | 8     | `throwIfViolations` |
| `./graphql` | 16              | 17    | none (gained one)   |
| other ten   | unchanged       | —     | none                |

A root-only check misses `./presets` entirely, and `eess-ts` publishes thirteen
subpaths while `eess-crossvalidate` publishes seven. The `0.4.0` restore was
found by an adopter "who diffed every subpath" for this reason.

A manual step now exists in `RELEASING.md` under "A removal from a published
barrel is invisible to every gate". It is a stopgap: it runs only if a human
remembers, and it is the step this bug should make unnecessary.

**A caution for whoever builds it.** The first version of that manual recipe
ended in `comm -23 old.txt new.txt`, which is wrong: `comm` compares adjacent
lines by locale collation while `Object.keys().sort()` is codepoint order.
Measured on the `0.4.0` → `0.5.0` root barrel under `en_US.UTF-8` it reported
**282** removals instead of 54 — exit 0, no warning, 228 of them names that never
left. A surface diff is a set difference and must be written as one.

## Two more of the split modules are defects, not judgment calls (measured 2026-09-11)

A customer review applied this bug's own criterion to the rest of the `0.5.0`
diff instead of assuming the remainder was clean. Two survive checking:

**`ObjectLiteralFunction` is a type nobody can obtain.** It is still exported at
`packages/ts/src/index.ts:156`. Its only producer, `collectObjectLiteralFunctions`,
and its only consumer, `fromObjectLiteralFunction`, were both removed in `0.5.0`
and are on no import path. Measured on the built barrel: `dist/index.d.ts`
mentions the name exactly once, on its own re-export line — no published
signature takes it or returns it. An adopter can write the annotation and can
never hold a value. The interface even carries an
`eess-exclude eess/no-unused-exports` comment justified as "re-exported from
`src/index.ts`", which is circular once the producer is gone.

**`collectCalls` left while both its siblings stayed.** `collectFunctions` and
`collectJsxElements` are still published, as are `ArchCall` and
`fromCallExpression`. Someone writing a predicate over call expressions reaches
for `collectCalls` exactly as they reached for `collectFunctions`. The value is
still obtainable by walking the AST by hand, so this is an ergonomic
inconsistency rather than an unobtainable type — weaker than the first, same
cause.

Neither is fixed here, and that is the point: whether the answer is to restore
the producer or to withdraw the orphaned type is an ADR-011 question about how
the surface may evolve, and deciding it inside a bug-fix branch is the reflex
that produced three incidents. They are recorded so the decision has its
evidence.

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
- [ ] The per-subpath published-surface diff automated, so it does not depend on
      a releaser remembering a manual step.
