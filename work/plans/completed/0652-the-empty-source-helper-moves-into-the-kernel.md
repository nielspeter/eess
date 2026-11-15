# Plan 0652: the empty-source helper moves into the kernel

## Status

- **State:** Done — built 2026-11-14 on `plan/0652-lift-the-empty-source-helper` (43a16af0) and closed in the same PR, after a build review by the enforcement and method lenses (below). It went from Draft to Done in one commit: the freeze to Ready was given orally, at the maintainer's "go", and never committed, which the method lens recorded at the build review. Before that: Draft — authored 2026-11-14, from
  [plan 0649](../0649-md-a-code-reference-resolves-at-its-lines.md)'s review (the architect lens), as
  the first step of the sequence that
  [spike 0651](../../spikes/0651-where-the-typescript-code-facts-come-from.md) set. Revised the same
  day after its own review by the architect, enforcement and method lenses ("Review, 2026-11-14"
  below).
- **Priority:** Medium. There is no false green today. [Plan 0649](../0649-md-a-code-reference-resolves-at-its-lines.md) would write a third copy of a rule
  the kernel owns, and its builder's receipt will carry an `undecided` count that the copies lose.
- **Effort:** Small. An estimate of about an hour, not measured.
- **Created:** 2026-11-14
- **Decided, each overrulable:**
  - **The helper lives on `@nielspeter/eess/internal`**, as `withSourceEmpty(loadedNothing,
receipt)`. It is family plumbing that the dialects need and consumers do not
    ([ADR-011](../../../adr/011-the-kernels-public-api-is-explicit.md)), and its rule is
    [ADR-014](../../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) §4's. It is named
    after the evidence flag it sets, `sourceEmpty`, rather than crossvalidate's `withEmptySource`.
  - **On the branch where nothing was examined, the receipt is kept whole.** That means its
    violations and its evidence (`undecided`, `declaredEmpty`, `notRun`), with `sourceEmpty`
    added. The one exception is `deadGlob`, which an empty source makes meaningless, as
    `RuleBuilder` already drops it (`packages/core/src/rule-builder.ts:404`).
  - **On the branch beside a non-zero `examined`, the result is exactly what
    `mergeCollectResults` returns.** The helper adds no field of its own, so the merge stays the one
    owner of its rules ([ADR-014](../../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) §7). That the merge drops `undecided` is
    [bug 0653](../../bugs/0653-the-merge-drops-the-undecided-count.md)'s, for every merge.
  - **The release:** the kernel takes a minor, since `/internal` is a published, versioned contract
    and crossvalidate's built code will import the new symbol. Crossvalidate takes a patch. This
    follows the precedent of the `pathSuffixIndex` lift (39517a3d).

## Problem

One rule, from [spike 0640](../../spikes/0640-an-input-side-loaded-nothing.md): an input that loaded
nothing is reported once.

- **Over nothing examined**, the receipt carries `sourceEmpty` itself.
- **Beside a non-zero `examined`**, it is a member of its own, and the merge reports
  `emitter/source-empty`.

The rule is written twice:

- inline in `correspondence()` (`correspondence.ts` lines 165-171 at bc3349a6, before this plan), with
  one empty member per empty side;
- as `withEmptySource` in eess-crossvalidate (`shared.ts` lines 126-130 at bc3349a6), with
  four call sites serving six presets (`gherkin-ts.ts`'s `withInputs` serves three).

[Plan 0649](../0649-md-a-code-reference-resolves-at-its-lines.md) would need it a third time in eess-md, which cannot import crossvalidate.

**Why no behaviour changes, measured by the review:**

- **No current receipt carries what the copies drop.** All six presets build their receipt as
  `collectResult(violations, { examined })`, and `correspondence()` refuses an undecided subject
  (`correspondence.ts` lines 331 and 364 at bc3349a6).
- **One empty member and two report alike.** The merge reports one finding whatever the number of
  empty members, since it finds the first (`packages/core/src/collect-result.ts:189-191`).

The loss is latent until [plan 0649](../0649-md-a-code-reference-resolves-at-its-lines.md)'s builder.

## Phase 1 — the helper

```ts
// packages/core/src/source-empty.ts
/**
 * Spike 0640: an input that loaded nothing, reported once beside a receipt ([ADR-014](../../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) §4). Over
 * nothing examined, the receipt keeps its violations and evidence and says `sourceEmpty` itself,
 * and the terminal or a preset's gate reports it; beside a non-zero `examined` that flag would
 * contradict, so the input is a member of its own, and the merge reports `emitter/source-empty`.
 */
export function withSourceEmpty(loadedNothing: boolean, receipt: CollectResult): CollectResult
```

Its doc links name the ADRs from `packages/core/src/`, as `../../../adr/…`.

- **Export.** It is exported from `packages/core/src/internal.ts` and forwarded by no dialect
  ([ADR-011](../../../adr/011-the-kernels-public-api-is-explicit.md) §2).
- **`correspondence()`** calls it with "a side carries `sourceEmpty`".
- **Crossvalidate.** Its four call sites call it in place of `withEmptySource`, which is deleted
  along with the imports only it used (`collectResult` and `mergeCollectResults` in `shared.ts`).

## Files changed

- `packages/core/src/source-empty.ts` (new)
- `packages/core/src/internal.ts`
- `packages/core/src/correspondence.ts`
- `packages/core/tests/source-empty.test.ts` (new)
- `packages/core/tests/correspondence-source-empty.test.ts` (one test added)
- `packages/crossvalidate/src/shared.ts`
- `packages/crossvalidate/src/md-gherkin.ts`
- `packages/crossvalidate/src/md-mermaid.ts`
- `packages/crossvalidate/src/gherkin-ts.ts`
- `packages/crossvalidate/src/md-mermaid-er.ts`
- `work/bugs/0645-the-vacuity-matrix-probes-no-preset-under-expect-empty.md` (it names
  `withEmptySource`)
- `work/bugs/0641-the-empty-source-finding-names-no-source.md` (a note: the boolean parameter drops
  which side loaded nothing)
- `work/plans/0649-md-a-code-reference-resolves-at-its-lines.md` (its Phase 2 calls the helper, not a
  third copy)
- `.changeset/` (`@nielspeter/eess` minor, `@nielspeter/eess-crossvalidate` patch)

## Test inventory

Each assertion is exact: the whole list of finding ids, with `toEqual`. The `notRun` test first
asserted no finding list; it was made exact at the build review.

- [x] **Over zero examined**, a receipt with a violation, `undecided: 1`, `declaredEmpty` and a
      `deadGlob`: the result holds that violation only, `examined: 0`, `sourceEmpty`, `undecided: 1`,
      `declaredEmpty`, and no `deadGlob` (`packages/core/tests/source-empty.test.ts`). Added at build:
      `notRun` kept.
- [x] **Beside a non-zero `examined`**: exactly the receipt's violation and `emitter/source-empty`,
      no `sourceEmpty`, `examined` the receipt's.
- [x] **`loadedNothing` false** returns the receipt itself.
- [x] **Two empty sides beside a non-zero `examined`** in `correspondence()`: one
      `emitter/source-empty` (`packages/core/tests/correspondence-source-empty.test.ts`).
- [x] **Existing tests pass unchanged:** the whole kernel suite (47 files, 447 tests, the 5 new
      ones among them) and the whole crossvalidate suite (14 files, 170 tests), on 43a16af0, 2026-11-14.
- [x] **The gates**, on 43a16af0: `check:family` (1 rule across 1 file, 1.39 s), `check:arch` (41
      rules across 2 files, 18.9 s), `check:surface` (101 kernel root exports documented, 0.15 s),
      and lint over every changed file, each green.
- [x] **The sabotage matrix**, 2026-11-14, on 43a16af0 in a worktree with its own `npm ci` and
      builds, one break at a time, against the three kernel test files and the whole crossvalidate
      suite (1 min 45 s; re-run on 4f0622ab, 1 min 54 s, see the correction below). Restored, 0
      red before and after. Every break red its named test:

  | break                                                                       | kernel tests red | crossvalidate tests red |
  | --------------------------------------------------------------------------- | ---------------- | ----------------------- |
  | the zero branch drops the receipt's violations                              | 1                | 0                       |
  | the zero branch drops `undecided`                                           | 1                | 0                       |
  | the zero branch always merges                                               | 4                | 3                       |
  | the merge branch merges an empty copy of the receipt                        | 1                | 0                       |
  | the merge branch stamps `sourceEmpty`                                       | 1                | 1                       |
  | the merge branch re-stamps the receipt's fields (added at the build review) | 1                | 0                       |
  | `loadedNothing` ignored                                                     | 25               | 82                      |
  | `correspondence()` stops calling it                                         | 4                | 3                       |

  _The two breaks that drop findings red only the new exact tests, as the review predicted: every
  existing suite stays green under them._

  _Corrected 2026-11-14 at the build review (method lens): the table first recorded 2 and 1 kernel
  reds, and 5 crossvalidate reds, for rows 3 and 7. The harness's counter took the first "N failed"
  anywhere in vitest's output, which is not the "Tests" line, so it recorded something other than
  the number of tests. Whether each break red was right, since a clean run prints no "failed"; the
  counts were not. Re-run on 4f0622ab with a counter that reads the "Tests" line (1 min 54 s); the
  method lens, by another route, measured 4 and 28 for those kernel cells and 82 for row 7's
  crossvalidate cell. The same counter recorded the matrices of plans
  [0647](./0647-md-a-mention-reading-that-keeps-backticks.md) and
  [0648](./0648-md-a-code-reference-still-appears-in-its-file.md); each carries its own correction._

## Build review, 2026-11-14

The enforcement and method lenses reviewed the build at aeb3d83d. Neither found a critical defect,
and no verdict or receipt changes for an existing caller: the enforcement lens compared main's
copies with the helper over 13 receipt shapes, each read six ways.

- **The merge branch was not pinned field for field** (enforcement). A helper re-stamping the
  receipt's fields onto the merge's result left every test green. The test now compares each field
  with `mergeCollectResults` computed in the test, and a new matrix row shows it reds.
- **Two matrix rows did not reproduce** (method). The harness's counter was wrong; the table above
  is corrected and re-run.
- **The State claimed a committed freeze** that never happened (method); corrected above.
- **Minor, folded in:**
  - pointers into code the build changed, now pinned to bc3349a6;
  - the counts and gates pinned to their commit;
  - the `notRun` test made exact;
  - the helper's doc on a receipt that already contradicts itself;
  - the board row;
  - [plan 0649](../0649-md-a-code-reference-resolves-at-its-lines.md)'s review pointed at this plan and [bug 0653](../../bugs/0653-the-merge-drops-the-undecided-count.md).
- **Recorded, not fixed here:**
  - nothing gates that eess-md calls the helper rather than a third copy; [plan 0649](../0649-md-a-code-reference-resolves-at-its-lines.md) says to call
    it;
  - the merge does not see an expired `declaredEmpty` on a member,
    [bug 0654](../../bugs/0654-the-merge-loses-an-expired-declaration-on-a-member.md);
  - the kernel minor also patch-bumps the dialects that depend on it, which the changeset does not
    name, as changesets does on its own.

## Out of scope

- The merge dropping `undecided`, and `finishPreset` dropping it on the preset path:
  [bug 0653](../../bugs/0653-the-merge-drops-the-undecided-count.md).
- Naming the source in the finding:
  [bug 0641](../../bugs/0641-the-empty-source-finding-names-no-source.md).
- eess-md's use of the helper, which is [plan 0649](../0649-md-a-code-reference-resolves-at-its-lines.md)'s.

## Review, 2026-11-14

Reviewed as a Draft by the architect, enforcement and method lenses; the full reviews were written
to the session's scratchpad and are not kept in the repository; what they found is recorded here. No verdict changes under the lift; the enforcement lens measured it in
its own worktree (crossvalidate 170 tests, core 442).

- **Critical (architect, method):** "keeps `undecided` on both branches" contradicted the plan's own
  scope. The merge branch is the merge, which drops it. It is resolved by keeping the receipt whole
  on the zero branch only and returning the merge's output untouched.
- **Important:**
  - the changeset: the kernel takes a minor (architect, method);
  - the unit of evidence kept, `deadGlob` decided (architect);
  - the reason no behaviour changes, now stated (method);
  - six presets, not four (method);
  - two lift mistakes that every existing suite leaves green: dropping the receipt's violations on
    either branch. Exact assertions and a named matrix now catch them (enforcement).
- **Minor, folded in:**
  - the doc-link depth;
  - the rename's reason;
  - [bug 0645](../../bugs/0645-the-vacuity-matrix-probes-no-preset-under-expect-empty.md)'s mention of the old name;
  - the unused imports left in `shared.ts`;
  - [plan 0649](../0649-md-a-code-reference-resolves-at-its-lines.md)'s third-copy instruction;
  - the board's "Blocked on" cell;
  - the boolean losing which side loaded nothing ([bug 0641](../../bugs/0641-the-empty-source-finding-names-no-source.md)).
