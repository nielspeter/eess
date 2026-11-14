# Plan 0652: the empty-source helper moves into the kernel

## Status

- **State:** Draft — authored 2026-11-14, from
  [plan 0649](./0649-md-a-code-reference-resolves-at-its-lines.md)'s review (the architect lens), as
  the first step of the sequence that
  [spike 0651](../spikes/0651-where-the-typescript-code-facts-come-from.md) set. Revised the same
  day after its own review by the architect, enforcement and method lenses ("Review, 2026-11-14"
  below).
- **Priority:** Medium. There is no false green today. [Plan 0649](./0649-md-a-code-reference-resolves-at-its-lines.md) would write a third copy of a rule
  the kernel owns, and its builder's receipt will carry an `undecided` count that the copies lose.
- **Effort:** Small. An estimate of about an hour, not measured.
- **Created:** 2026-11-14
- **Decided, each overrulable:**
  - **The helper lives on `@nielspeter/eess/internal`**, as `withSourceEmpty(loadedNothing,
receipt)`. It is family plumbing that the dialects need and consumers do not
    ([ADR-011](../../adr/011-the-kernels-public-api-is-explicit.md)), and its rule is
    [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) §4's. It is named
    after the evidence flag it sets, `sourceEmpty`, rather than crossvalidate's `withEmptySource`.
  - **On the branch where nothing was examined, the receipt is kept whole.** That means its
    violations and its evidence (`undecided`, `declaredEmpty`, `notRun`), with `sourceEmpty`
    added. The one exception is `deadGlob`, which an empty source makes meaningless, as
    `RuleBuilder` already drops it (`packages/core/src/rule-builder.ts:404`).
  - **On the branch beside a non-zero `examined`, the result is exactly what
    `mergeCollectResults` returns.** The helper adds no field of its own, so the merge stays the one
    owner of its rules ([ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) §7). That the merge drops `undecided` is
    [bug 0653](../bugs/0653-the-merge-drops-the-undecided-count.md)'s, for every merge.
  - **The release:** the kernel takes a minor, since `/internal` is a published, versioned contract
    and crossvalidate's built code will import the new symbol. Crossvalidate takes a patch. This
    follows the precedent of the `pathSuffixIndex` lift (39517a3d).

## Problem

One rule, from [spike 0640](../spikes/0640-an-input-side-loaded-nothing.md): an input that loaded
nothing is reported once.

- **Over nothing examined**, the receipt carries `sourceEmpty` itself.
- **Beside a non-zero `examined`**, it is a member of its own, and the merge reports
  `emitter/source-empty`.

The rule is written twice:

- inline in `correspondence()` (`packages/core/src/correspondence.ts:165-171`), with one empty member
  per empty side;
- as `withEmptySource` in eess-crossvalidate (`packages/crossvalidate/src/shared.ts:126-130`), with
  four call sites serving six presets (`gherkin-ts.ts`'s `withInputs` serves three).

[Plan 0649](./0649-md-a-code-reference-resolves-at-its-lines.md) would need it a third time in eess-md, which cannot import crossvalidate.

**Why no behaviour changes, measured by the review:**

- **No current receipt carries what the copies drop.** All six presets build their receipt as
  `collectResult(violations, { examined })`, and `correspondence()` refuses an undecided subject
  (`packages/core/src/correspondence.ts:331`, `:364`).
- **One empty member and two report alike.** The merge reports one finding whatever the number of
  empty members, since it finds the first (`packages/core/src/collect-result.ts:189-191`).

The loss is latent until [plan 0649](./0649-md-a-code-reference-resolves-at-its-lines.md)'s builder.

## Phase 1 — the helper

```ts
// packages/core/src/source-empty.ts
/**
 * Spike 0640: an input that loaded nothing, reported once beside a receipt ([ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) §4). Over
 * nothing examined, the receipt keeps its violations and evidence and says `sourceEmpty` itself,
 * and the terminal or a preset's gate reports it; beside a non-zero `examined` that flag would
 * contradict, so the input is a member of its own, and the merge reports `emitter/source-empty`.
 */
export function withSourceEmpty(loadedNothing: boolean, receipt: CollectResult): CollectResult
```

Its doc links name the ADRs from `packages/core/src/`, as `../../../adr/…`.

- **Export.** It is exported from `packages/core/src/internal.ts` and forwarded by no dialect
  ([ADR-011](../../adr/011-the-kernels-public-api-is-explicit.md) §2).
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

Each assertion is exact: the whole list of finding ids, with `toEqual`.

- [ ] **Over zero examined**, a receipt that carries a violation and `undecided: 1`: the result
      holds that violation and no other, `examined: 0`, `sourceEmpty: true`, `undecided: 1`.
- [ ] **Beside a non-zero `examined`**, a receipt that carries a violation: the result holds that
      violation and `emitter/source-empty`, exactly; it has no `sourceEmpty`; and its `examined`
      equals the receipt's.
- [ ] **`loadedNothing` false** returns the receipt unchanged.
- [ ] **Two empty sides beside a non-zero `examined`** in `correspondence()`: one
      `emitter/source-empty`, which no test pins today.
- [ ] **Existing tests pass unchanged:** `correspondence.test.ts`,
      `correspondence-source-empty.test.ts`,
      `packages/crossvalidate/tests/an-input-side-loaded-nothing.test.ts`, and the whole
      crossvalidate suite.
- [ ] **`check:family` and `check:arch` stay green:** `/internal` imports are exempt from the
      family check, and `internal.ts` is an entry point for `eess/no-unused-exports`.
- [ ] **The sabotage matrix**, in a worktree with its own install. Each break is listed with the
      test expected to red; a survivor is a finding:

  | break                                                | expected to red                                                                                                                |
  | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
  | the zero branch drops the receipt's violations       | the helper's zero-branch test                                                                                                  |
  | the zero branch drops `undecided`                    | the helper's zero-branch test                                                                                                  |
  | the zero branch always merges                        | the helper's zero-branch test; `correspondence-source-empty.test.ts:39`                                                        |
  | the merge branch merges an empty copy of the receipt | the helper's merge-branch test                                                                                                 |
  | the merge branch stamps `sourceEmpty`                | the helper's merge-branch test; `it('scenarioExemptionsCurrent reports the empty test side beside the exemptions it counted')` |
  | `loadedNothing` ignored                              | the helper's third test; the crossvalidate suite                                                                               |
  | `correspondence()` stops calling it                  | `correspondence-source-empty.test.ts`                                                                                          |

## Out of scope

- The merge dropping `undecided`, and `finishPreset` dropping it on the preset path:
  [bug 0653](../bugs/0653-the-merge-drops-the-undecided-count.md).
- Naming the source in the finding:
  [bug 0641](../bugs/0641-the-empty-source-finding-names-no-source.md).
- eess-md's use of the helper, which is [plan 0649](./0649-md-a-code-reference-resolves-at-its-lines.md)'s.

## Review, 2026-11-14

Reviewed as a Draft by the architect, enforcement and method lenses; the full reviews were written
to the session's scratchpad. No verdict changes under the lift; the enforcement lens measured it in
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
  - [bug 0645](../bugs/0645-the-vacuity-matrix-probes-no-preset-under-expect-empty.md)'s mention of the old name;
  - the unused imports left in `shared.ts`;
  - [plan 0649](./0649-md-a-code-reference-resolves-at-its-lines.md)'s third-copy instruction;
  - the board's "Blocked on" cell;
  - the boolean losing which side loaded nothing ([bug 0641](../bugs/0641-the-empty-source-finding-names-no-source.md)).
