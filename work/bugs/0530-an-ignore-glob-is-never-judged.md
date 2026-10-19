# Bug 0530: an `ignore` glob is never judged

## Status

- **State:** Draft — recorded 2026-10-19 from PR #253's method verify round (N1); read from the code,
  not reproduced with a red test.
- **Severity:** Medium — a document filed later under an ignored folder glob is left out of every
  rule over the corpus without a finding, the stale or universal exclusion ADR-018 says should be one.
- **Origin:** self-found · PR #253's review; the migration page to 0.15 recommends `ignore` as a remedy
- **Reported:** 2026-10-19

## Symptom

`corpus({ ignore })` compiles its globs with picomatch (`packages/md/src/corpus.ts:121`) and uses them
only to filter what is loaded. Nothing reports an `ignore` glob that matches no file (stale) or one
that matches every file under a root (universal), unlike a dead root (bug 0465) or a dead frozen glob
(bug 0499). A record filed later under an ignored folder is skipped silently by every rule.

## Fix

Judge `ignore` as `frozen` is judged: a text fault is refused; a glob that matches no file the walk
saw is a finding unless declared (or refused, as dead roots are); a glob that ignores every file a
root loads is a finding. Red test first, per case, through `corpus()` and `corpusFromText()`.

## Verification

- [ ] red test first: a stale `ignore` glob and a universal one each give a finding
- [ ] the migration page's `ignore` paragraph is updated when this is fixed
- [ ] `npm run validate` green
