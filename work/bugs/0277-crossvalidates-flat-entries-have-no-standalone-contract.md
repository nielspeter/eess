# Bug 0277: crossvalidate's flat entries have no standalone contract

## Status

- **State:** Draft — the residual bug 0276 narrowed itself around, named rather
  than absorbed.
- **Severity:** Low-to-medium — an adopter reaches for the kernel directly, which
  is the cost plan 0089 exists to remove, but nothing breaks.
- **Origin:** self-found · architecture review of PR #124, which measured that
  0276's own corrected sentence was still false about the fifth dialect.

## Symptom

Bug 0276 established that a dialect whose adopter can be handed a receipt must
publish the seam to use one, and 0277's four barrel dialects now do. `eess-
crossvalidate` has no barrel — it ships seven flat entry files — so "what its
adopter can reach" is a per-subpath question the required-set test cannot ask.

Measured on the built package:

| subpath                                                   | `collectResult` | `mergeCollectResults` |
| --------------------------------------------------------- | --------------- | --------------------- |
| `md-mermaid`, `md-gherkin`, `gherkin-ts`, `md-mermaid-er` | yes             | **no**                |
| `mermaid-ts`, `md-ts`, `files`                            | **no**          | **no**                |

Zero of seven publish the merge. The four carrying the constructor do so only
because their own source imports it — the import-driven rule already forced that,
which is the supply side, not the demand side.

## Why 0276 did not extend to it

The required-set test lists four dialects and names crossvalidate as excluded.
That exclusion is honest but unargued: it was excluded because it has no barrel,
not because a decision was taken about what a crossvalidate adopter should be
able to reach.

The real question is prior to the mechanism: **is a flat-entry package supposed
to offer standalone sufficiency at all?** A binding built from `md-mermaid` is
narrower than a dialect — the adopter is using one prepared correspondence, not
writing rules. It is arguable that reaching for the kernel is correct there and
plan 0089's promise simply does not apply.

Answer that, then decide the mechanism. Extending the set over seven entries
before answering it would be building a gate from a shape rather than a decision,
which is what 0276's first cut did and what its review caught.

## The corruption that must produce a violation

If the answer is "yes, it applies": a crossvalidate entry file that hands its
caller a receipt without publishing the means to build, merge, report or finish
one.

## Verification ledger

- [ ] The prior question answered and recorded: does standalone sufficiency apply
      to a flat-entry bridge package, and if not, say so where plan 0089's
      promise is stated so the next reader is not left to infer it.
- [ ] If it applies: the required set extended per entry, red test first, and the
      pending changeset's crossvalidate sentence revisited.
- [ ] If it does not: the exclusion in
      `scripts/lib/receipt-constructors.test.mjs` carries the reason rather than
      the shape.
