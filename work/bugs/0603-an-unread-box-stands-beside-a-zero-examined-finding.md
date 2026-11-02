# Bug 0603: an unread box stands beside a zero-examined finding

## Status

- **State:** Draft — measured 2026-11-02 on PR #296's build; no red test yet.
- **Severity:** Medium — the receipt contradicts itself, as
  [bug 0602](./fixed/0602-an-unread-mention-stands-beside-a-zero-examined-finding.md)'s did for
  `mentions()`: it reports a box mark the rule cannot read and, beside it, that the emptiness was
  declared or that nothing was examined. The build is red either way, but the generic finding sends
  an author to `.expectEmpty()` or to the selector.
- **Origin:** self-found · the testing review of PR #296 ([plan 0580](../plans/0580-md-a-raw-html-link-is-resolved.md), Phase 1), which fixed the same
  shape in `mentions()`.
- **Reported:** 2026-11-02

## Symptom

[ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) rule 7: a rule whose
only subjects are undecided reports them, and neither the generic zero-examined finding nor a
declared emptiness beside them. Over a document whose only box carries a mark the rule was not told
about, measured against `packages/md/dist` (0.14 s):

```js
const c = corpusFromText({ 'a.md': '# A\n\n- [~] thing\n' })
taskItems(c).should().notExist().violations() // md/undeclared-box-mark, declaredEmpty: true
taskItems(c)
  .should()
  .satisfy({ description: 'x', evaluate: () => [] })
  .violations()
// md/undeclared-box-mark, and "this rule examined zero units …"
```

## Root cause

`taskItems()`'s `collectViolations` (`packages/md/src/builders/task-items.ts:72`) appends its
unread-box findings and counts only the predicate causes in `undecided`, not the boxes themselves,
so the terminal adds the generic finding and `declaredEmpty`. It is the shape
[bug 0602](./fixed/0602-an-unread-mention-stands-beside-a-zero-examined-finding.md) fixed in
`mentions()` by the shared helper `withUnread` (`packages/md/src/builders/unread.ts:69`).

## Fix

`taskItems()` builds its receipt with `withUnread`, as `mentions()` now does.

## Verification

- [ ] Red first: the reproduction's `notExist()` has no `declaredEmpty`, and the other condition
      returns only `md/undeclared-box-mark`.
- [ ] A document with a read box beside an unread one is unchanged.
- [ ] A changeset naming `@nielspeter/eess-md`.
- [ ] `npm run validate` green.

Deferred: none
