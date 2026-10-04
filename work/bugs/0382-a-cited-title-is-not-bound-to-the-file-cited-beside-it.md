# Bug 0382: a cited title is not bound to the file cited beside it

## Status

- **State:** Draft — measured by enforcement review of the 0111 fix; no red test yet.
- **Severity:** Medium — **a stated rule nothing enforces.** The cited test is still real and
  unique, so this is not a test that does not exist; it is an ADR pointing readers and agents
  at the wrong file. `CLAUDE.md`'s citation convention says "the title must exist in that
  file", and since 0111 no gate checks it.
- **Origin:** enforcement review of
  [0111](./fixed/0111-md-adr-citations-resolve-by-prefix.md)'s fix, which caused it.
- **Reported:** 2026-10-04

## Symptom

`eess-md`'s removed resolver searched only the test files cited on the same row, so a title
cited beside the wrong file was reported. `adrCitationsResolve` keys on the title across the
whole project (`packages/crossvalidate/src/md-ts.ts:156`, `keyBy: (e) => e.title`), with no
file in the key. Measured on the crossvalidate fixture: a row citing `` `tests/quoted.cases.ts` ``
· `it('exists')`, where `exists` lives only in `tests/example.test.ts`, was reported before
0111 and passes after it. A row citing a title with no test path at all passes the same way.

## Fix

Not decided: make `adrCitationsResolve` resolve a title against the test files cited on its
row, when the row cites any, and report one cited beside a file that does not define it.

## Verification

- [ ] a red test: the measured row above produces a finding
- [ ] the fix, and `CLAUDE.md`'s convention text agrees with what is enforced
- [ ] `npm run validate` green.

Deferred: none.
