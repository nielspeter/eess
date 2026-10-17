# Bug 0460: the kernel exempts a cardinality rule before it looks for a dead glob

## Status

- **State:** Draft — recorded 2026-10-18 from PR #235's enforcement and testing reviews. Fixed by
  [plan 0456](../plans/0456-kernel-notexist-and-dead-glob.md), at the maintainer's decision.
- **Severity:** Medium — a ratchet broken by one character passes. eess-ts guards against it on its
  own; any other dialect that ships a cardinality condition inherits the silent pass.
- **Origin:** self-found · PR #235's reviews, 2026-10-18.
- **Reported:** 2026-10-18

## Symptom

`zeroExaminedFinding` (`packages/core/src/terminal-builder.ts:311`) returns no finding for a rule
whose condition asserts cardinality (`notExist`) before it consults the dead-glob diagnosis
(`packages/core/src/terminal-builder.ts:318-319`). A `notExist` rule whose selector is broken examines zero elements and
passes, where the same selector on a positive rule reds with
"examined zero units".

Measured by PR #235's enforcement review on main's build, over a corpus holding `guides/a.md`, with
a cardinality-marked condition on eess-md's `docs()`:

| glob        | cardinality rule               | positive rule (`haveSection`)     |
| ----------- | ------------------------------ | --------------------------------- |
| `guides/**` | 1 finding, examined 1          | 1 finding                         |
| `gudies/**` | 0 findings, examined 0 → green | 1 finding ("examined zero units") |

eess-ts closed the same class in its own dialect, with a disk discriminator (bug 0355) and a
syntactic clause (bug 0362). The kernel has neither, and eess-md has no cardinality condition yet,
so the exposure arrives with proposal 017's block 6. Whether eess-mermaid's `notExist`
(`packages/mermaid/src/conditions/class.ts:110`) is exposed today is not measured.

## Fix

In the kernel, a cardinality rule that examined zero first asks the dialect whether its selector is
at fault, under [bug 0355](./fixed/0355-a-cardinality-rule-cannot-tell-none-exist-from-my-selector-broke.md)'s
ruling: a fault decidable from the glob text (bug 0362's `./` or leading `/`), or a glob naming
Markdown the repository holds that the corpus did not load, is a finding. A glob that names nothing in
the repository cannot be told from a ratchet that holds (a deleted folder), so it stays green; a
mistyped folder is caught where the folder is the corpus root, since an empty corpus is now a finding.
Planned in [plan 0456](../plans/0456-kernel-notexist-and-dead-glob.md).

## Verification

- [ ] Red first: a cardinality rule over `./guides/**` (a fault in the glob text) passes today
- [ ] Red first: a cardinality rule over a folder holding Markdown the corpus did not load passes today
- [ ] Green: both red, naming the glob; a glob naming no file in the repository stays green, pinned
- [ ] Green: a corpus rooted at a mistyped folder loads nothing and reds as an empty source

Deferred: none
