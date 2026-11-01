# Bug 0596: the repository's cross-document link test cuts a URL at its fragment only

## Status

- **State:** Draft — read 2026-11-01 while fixing
  [bug 0583](./fixed/0583-a-local-link-with-a-query-string-never-resolves.md); no red test yet.
- **Severity:** Low — a false red in this repository's own test, on a link shape no tracked file
  holds today.
- **Origin:** self-found · [bug 0583](./fixed/0583-a-local-link-with-a-query-string-never-resolves.md)'s
  fix, which found the same shape on another path; recorded here rather than widened into that fix.
- **Reported:** 2026-11-01

## Symptom

`packages/ts/tests/docs/cross-document-links-resolve.test.ts` resolves the links of the root
documents itself, not through eess-md. Its `resolvesAsPath` (line 146) and `resolvesAsRoute`
(line 153) cut a target at `#` only, so a link such as `./logo.png?raw=true` would be checked as a
file named `logo.png?raw=true` and fail the test, though GitHub reads the `?…` as a query. This is
the shape [bug 0583](./fixed/0583-a-local-link-with-a-query-string-never-resolves.md) fixed in
`resolveLink`.

## Fix

Cut the target at its first `?` or `#`, as `resolveLink` now does, or resolve through eess-md's
`resolveLink` so the two cannot disagree again.

## Verification

- [ ] Red test written first: a root document holding `./README.md?plain=1` passes the test.
- [ ] `npm run validate` green.

Deferred: none
