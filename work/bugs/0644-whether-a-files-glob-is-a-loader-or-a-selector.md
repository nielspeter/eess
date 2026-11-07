# Bug 0644: whether a `files()` glob is a loader or a selector

## Status

- **State:** Draft — split out of [bug 0642](./fixed/0642-other-doors-pass-over-an-input-that-loaded-nothing.md) at its build review, 2026-11-07; it needs a decision before a fix.
- **Severity:** High if the decision lands on "a loader's glob": then a `correspondence()` over
  `files({ glob: 'adrs-typo/*.md' })` in a loaded tree passes (measured by the build review: 0
  elements, no `sourceEmpty`, `beComplete()` returns `[]` whichever way it reads), a false green.
- **Origin:** self-found · the enforcement review of [bug 0642](./fixed/0642-other-doors-pass-over-an-input-that-loaded-nothing.md)'s fix, 2026-11-07.
- **Reported:** 2026-11-07

## Symptom

`files()` (`packages/crossvalidate/src/files.ts`) walks `cwd` and keeps the files its glob matches.
Since [bug 0642](./fixed/0642-other-doors-pass-over-an-input-that-loaded-nothing.md) it carries `sourceEmpty: true` when the walk found no file at all. A glob that
matches nothing in a tree that holds files is not marked. The family reads the same shape both ways:
eess-gherkin's `features({ cwd, roots })` and eess-md's `corpus({ cwd, roots })` treat roots that
match nothing as an empty source, while [spike 0640](../spikes/0640-an-input-side-loaded-nothing.md) keeps an empty _selection_ over a loaded
source green on purpose (a release gate's empty diff). Nothing else catches a dead `files()` glob:
the kernel's dead-glob diagnosis exists on `RuleBuilder`, not on a correspondence.

## Fix

Not designed. The decision: is `files()`'s glob the definition of its source (then a dead one is
an empty source, as `features()`'s roots are), or a selection over the walked tree (then it stays
green, and a dead-glob finding of the correspondence's own is the alternative)? Measured against
the repository's own `files()` uses before it is set.

## Verification

- [ ] The decision recorded in a spike of its own under `work/spikes/`.
- [ ] Red first, if a loader: a correspondence over a dead `files()` glob in a loaded tree reports it.
