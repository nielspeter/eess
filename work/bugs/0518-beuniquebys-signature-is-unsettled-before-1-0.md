# Bug 0518: `beUniqueBy`'s signature is unsettled before 1.0

## Status

- **State:** Draft — recorded 2026-10-19 from PR #251's verify round (architect M6, M7; product M4);
  measured on `release/batch-builds` 513f378, no red test yet.
- **Severity:** Low — every shape below fails closed or is cosmetic today; each becomes a break once
  1.0 claims the signature stable, so it is settled before then.
- **Origin:** self-found · PR #251's review (architect M6, M7; product M4)
- **Reported:** 2026-10-19

## Symptom

Three shapes of the block-13 API (plan 0459 and its addendum) were shipped without a decision:

1. **`key` returns only `string`** (architect M6). `docs().beUniqueBy(key, what)` takes
   `(d: MdDocument) => string` (`packages/md/src/builders/docs.ts`), and
   `fields()`/`terms().beUniqueBy(key, what)` takes `(t: MdTerm) => string`
   (`packages/md/src/builders/vocabulary.ts`). A document with nothing to key must be selected away
   with `.that()`; a key that returns `''` for it groups every such document as "the same". The two
   levels already treat "nothing to key" differently: the value-level form reports an unreadable
   value itself and never groups it, the document-level form leaves it to the caller. Widening to
   `string | undefined` later changes two public methods.
2. **`uniqueByCondition`'s `at` against `toViolation`'s location** (architect M7). `UniqueByOptions`
   (`packages/core/src/unique-by.ts`) takes `locate(e).at`, the text a message lists for the other
   members, and separately `toViolation`, which sets the finding's own `file` and `line`. Nothing
   ties the two together or documents that they must agree; every caller today keeps them
   consistent by hand (`relPath:1` with line 1; `relPath:line` with `t.line`; gherkin's
   `relPath:line` with `s.line`).
3. **Positional `(key, what)` has no place for `why`** (product M4). The kernel's options take
   `why`, appended to each message, and gherkin uses it; neither md form can pass it. Adding it later
   is a third positional argument or a break, now on two methods.

## Reproduction

Measured 2026-10-19 on 513f378:

- over `r/a.md` and `r/b.md`, neither numbered,
  `docs(c).should().beUniqueBy((d) => /(?:^|\/)(\d+)-[^/]*\.md$/.exec(d.relPath)?.[1] ?? '', 'number')`
  reports `r/a.md has the same number as 1 other: r/b.md:1` and its twin;
- `fields(c, { label: 'Id', forms: ['bold'] }).should().beUniqueBy((f) => f.value, 'Id')` over two
  documents whose Id is `✅` reports each as `(Id, line 3) has no value this rule can read in '✅'`,
  and groups neither;
- `UniqueByOptions` has no member tying `locate(e).at` to the finding's `line` (read);
- neither md signature accepts `why` (read).

## Fix

Decide all three together, since they are one signature:

- an options-object overload (`beUniqueBy({ key, what, why? })`) beside or instead of the positional
  form, before 1.0;
- whether `key` may return `undefined`, and if it may, what the document-level form reports for it
  (the value-level form's "cannot read" finding is the precedent);
- either derive `at` from the finding's location or document in `UniqueByOptions` that the two must
  agree.

## Verification

- [ ] The decision recorded (here, or in an ADR if it binds other conditions).
- [ ] Red test written first for each change the decision makes.
- [ ] `npm run validate` green.

Deferred: none
