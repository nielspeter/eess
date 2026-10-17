# Bug 0460: the kernel exempts a cardinality rule before it looks for a dead glob

## Status

- **State:** Draft — recorded 2026-10-18 from PR #235's enforcement and testing reviews. Fix planned
  in [plan 0456](../plans/0456-kernel-notexist-and-dead-glob.md), at the maintainer's decision.
- **Severity:** Medium — a cardinality rule whose glob is decidably broken (rooted, or naming Markdown
  the corpus never loaded) passes. eess-ts guards against it on its own; any other dialect that ships
  a cardinality condition inherits the silent pass. A typo naming nothing stays green after the fix
  (bug 0355's ruling; see below).
- **Origin:** self-found · PR #235's reviews, 2026-10-18.
- **Reported:** 2026-10-18

## Symptom

`zeroExaminedFinding` (`packages/core/src/terminal-builder.ts:311`) returns no finding for a rule
whose condition asserts cardinality (`notExist`) before it consults the dead-glob diagnosis
(`packages/core/src/terminal-builder.ts:318-319`). A `notExist` rule whose selector is broken examines zero elements and
passes, where the same selector on a positive rule reds with
"examined zero units".

Measured by PR #235's enforcement review on main's build (an agent's spike, not yet a red test), over a corpus holding `guides/a.md`, with
a cardinality-marked condition on eess-md's `docs()`:

| glob        | cardinality rule               | positive rule (`haveSection`)     |
| ----------- | ------------------------------ | --------------------------------- |
| `guides/**` | 1 finding, examined 1          | 1 finding                         |
| `gudies/**` | 0 findings, examined 0 → green | 1 finding ("examined zero units") |

**What the fix does not change.** The `gudies/**` row above names nothing in the repository, and under
bug 0355's ruling that cannot be told from a ratchet that holds (a deleted folder), so it stays green
after the fix. It is caught only where the folder is the corpus's root: then the corpus is empty, and
an empty corpus is a finding (plan 0456). What the fix closes is a glob whose fault is decidable: a
rooted `/` glob, or one naming Markdown the repository holds that the corpus never loaded.

eess-ts closed the same class in its own dialect, with a disk discriminator (bug 0355) and a
syntactic clause (bug 0362). The kernel has neither, and eess-md has no cardinality condition yet,
so the exposure arrives with proposal 017's block 6. eess-mermaid's selectors are class names,
not paths, so this kernel order does not reach it; its empty-diagram pass is
[bug 0463](./0463-a-mermaid-notexist-over-an-empty-diagram-passes.md).

## Fix

In the kernel, a cardinality rule that examined zero first asks the dialect whether its selector is
at fault, under [bug 0355](./fixed/0355-a-cardinality-rule-cannot-tell-none-exist-from-my-selector-broke.md)'s
ruling: a fault decidable from the glob text (a leading `/`, a `../` segment, or a `./` segment after the
first; picomatch strips a leading `./`, so that one is not a fault, measured in plan 0456), a
backslash used as a path separator where the corrected glob selects real files, or a glob naming
Markdown the repository holds that the corpus did not load, is a finding. A glob that names nothing in
the repository cannot be told from a ratchet that holds (a deleted folder), so it stays green; a
mistyped folder is caught where the folder is the corpus root, since an empty corpus is now a finding.
Planned in [plan 0456](../plans/0456-kernel-notexist-and-dead-glob.md).

## Verification

- [ ] Red first, measured at build: a cardinality rule over a rooted `/guides/**` glob passes today
- [ ] Red first, measured at build: a cardinality rule over a folder holding Markdown the corpus did not load passes today
- [ ] Green: both red, naming the glob; a glob naming no file in the repository stays green, pinned
- [ ] Green: a corpus rooted at a mistyped folder loads nothing and reds as an empty source

Deferred: none
