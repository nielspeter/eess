# Plan 0652: the empty-source helper moves into the kernel

## Status

- **State:** Draft — authored 2026-11-14, from
  [plan 0649](./0649-md-a-code-reference-resolves-at-its-lines.md)'s review (the architect lens), as
  the first step of the sequence that
  [spike 0651](../spikes/0651-where-the-typescript-code-facts-come-from.md) set.
- **Priority:** Medium. There is no false green today. [Plan 0649](./0649-md-a-code-reference-resolves-at-its-lines.md) would write a third copy of a rule
  the kernel owns, and each copy drops a field of the receipt.
- **Effort:** Small, about an hour.
- **Created:** 2026-11-14
- **Decided, each overrulable:**
  - **The helper lives on `@nielspeter/eess/internal`**, as `withSourceEmpty(loadedNothing,
receipt)`. It is family plumbing, not public API
    ([ADR-011](../../adr/011-the-kernels-public-api-is-explicit.md)), and its rule is [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) §4's.
  - **It keeps the receipt's `undecided` count on both branches.** What `mergeCollectResults`
    itself drops is [bug 0653](../bugs/0653-the-merge-drops-the-undecided-count.md), not this plan.
  - **No behaviour changes.** Every existing test of `correspondence()` and of the four
    crossvalidate presets passes unchanged.

## Problem

One rule, from [spike 0640](../spikes/0640-an-input-side-loaded-nothing.md): an input that loaded
nothing is reported once.

- **Over nothing examined**, the receipt carries `sourceEmpty` itself.
- **Beside a non-zero `examined`**, it is a member of its own, and the merge reports
  `emitter/source-empty`.

The rule is written twice:

- inline in `correspondence()` (`packages/core/src/correspondence.ts:165-171`);
- as `withEmptySource` in eess-crossvalidate (`packages/crossvalidate/src/shared.ts:126-130`),
  with four callers.

[Plan 0649](./0649-md-a-code-reference-resolves-at-its-lines.md) would need it a third time in eess-md, which cannot import crossvalidate. Both copies
rebuild the receipt with `collectResult(receipt, { examined: 0, sourceEmpty: true })`, which keeps
only what it is given, so a receipt's `undecided` count is lost on that branch.

## Phase 1 — the helper

```ts
// packages/core/src/source-empty.ts
/**
 * Spike 0640: an input that loaded nothing, reported once beside a receipt ([ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) §4). Over
 * nothing examined, the receipt says so itself and the terminal reports it under the rule; beside
 * a non-zero `examined` that flag would contradict, so the input is a member of its own and the
 * merge reports `emitter/source-empty`. The receipt's `undecided` count is kept on both branches.
 */
export function withSourceEmpty(loadedNothing: boolean, receipt: CollectResult): CollectResult
```

It is exported from `packages/core/src/internal.ts`, and its callers change as follows:

- `correspondence()` calls it with "a side carries `sourceEmpty`";
- crossvalidate's four presets call it in place of `withEmptySource`, which is deleted.

## Files changed

- `packages/core/src/source-empty.ts` (new)
- `packages/core/src/internal.ts`
- `packages/core/src/correspondence.ts`
- `packages/core/tests/source-empty.test.ts` (new)
- `packages/crossvalidate/src/shared.ts`
- `packages/crossvalidate/src/md-gherkin.ts`
- `packages/crossvalidate/src/md-mermaid.ts`
- `packages/crossvalidate/src/gherkin-ts.ts`
- `packages/crossvalidate/src/md-mermaid-er.ts`
- `.changeset/` (no consumer-visible change: `'@nielspeter/eess': none` and
  `'@nielspeter/eess-crossvalidate': none`, unless the build finds one)

## Test inventory

- [ ] The helper's two branches: over zero examined, the result has `sourceEmpty`; beside a
      non-zero `examined`, the merge's `emitter/source-empty` is present, once.
- [ ] `undecided` is kept on both branches.
- [ ] `loadedNothing` false returns the receipt unchanged.
- [ ] Every existing test of `correspondence()` (`correspondence.test.ts`,
      `correspondence-source-empty.test.ts`) and of the four presets passes unchanged.
- [ ] `check:family` and `check:arch` stay green: crossvalidate takes the helper from the kernel's
      internal entry, which it already uses.
- [ ] The sabotage matrix, in a worktree with its own install: each branch of the helper broken,
      one at a time, reds a test.

## Out of scope

- The merge dropping `undecided` in general:
  [bug 0653](../bugs/0653-the-merge-drops-the-undecided-count.md).
- Naming the source in the finding:
  [bug 0641](../bugs/0641-the-empty-source-finding-names-no-source.md).
- eess-md's use of the helper, which is [plan 0649](./0649-md-a-code-reference-resolves-at-its-lines.md)'s.
