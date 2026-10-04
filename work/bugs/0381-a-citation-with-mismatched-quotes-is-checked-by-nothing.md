# Bug 0381: a citation with mismatched quotes is checked by nothing

## Status

- **State:** Draft — measured by two reviews of the 0111 fix; no red test yet.
- **Severity:** High — **malformed input ignored, not reported** (ADR-009). A row citing
  `` `it('foo")` `` — a typo — names no test, and no gate says so. Not live in this repo: all
  43 cited titles in `adr/**` parse.
- **Origin:** enforcement review of the first 0111 attempt, confirmed by method review of
  the second; recorded rather than folded in.
- **Reported:** 2026-10-04

## Symptom

`citedItTitles` (`packages/crossvalidate/src/it-title.ts:117`) extracts a title only between
matching delimiters, so `` `it('foo")` `` and an unterminated `` `it('foo` `` yield no
citation at all. Until
[0111](./fixed/0111-md-adr-citations-resolve-by-prefix.md), `eess-md`'s extractor closed a
title on either quote, extracted `foo`, and reported it not found. 0111 removed that
extractor, so `check:corpus` no longer catches the typo and `check:crossval` never sees it.

## Fix

Not decided: after extraction, report any `it(` followed by a quote that no match consumed,
as a malformed citation naming the missing delimiter.

## Verification

- [ ] a red test: an ADR row citing `` `it('foo")` `` produces a finding
- [ ] the fix
- [ ] `npm run validate` green.

Deferred: none.
