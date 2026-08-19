# Bug 0162: A folder-shaped `shared` glob makes `strictBoundaries` falsely flag, with no diagnostic

## Status

- **State:** Draft — reproduced against the built dist with a four-row matrix;
  no red test yet.
- **Severity:** Medium — false red, and silent. A legitimate import is reported
  as a boundary violation and nothing indicates the cause is the glob.
- **Origin:** self-found · [fold audit](../fold-audit-2026-08-19.md)
  (upstream bug 0023)
- **Reported:** 2026-08-19

## Symptom

`strictBoundaries({ shared: [...] })` accepts the `shared` globs raw. A
folder-shaped spelling — `'**/src/shared'`, without the trailing `/**` —
matches no files, so imports of genuinely-shared modules are flagged as
cross-boundary violations. No configuration finding is emitted.

## Reproduction

Against `packages/ts/dist`, billing/reporting/shared fixture:

| `shared` value            | shared import       | config findings                           |
| ------------------------- | ------------------- | ----------------------------------------- |
| `['**/src/shared/**']`    | passes              | 0                                         |
| `['**/no-such-dir/**']`   | flagged             | 2 (from `shared-isolation`'s non-vacuity) |
| **`['**/src/shared']`\*\* | **falsely flagged** | **0**                                     |

Row 3 is the bug: wrong result, and silent. Row 2 shows the only diagnostic
that exists fires incidentally, from a different rule's zero-examined guard,
and does not cover the folder-glob case.

## Root cause

`packages/ts/src/presets/boundaries.ts` passes the `shared` option through
without normalising or validating its shape. Upstream added a
`preset/boundaries/shared-discovery` rule whose whole purpose is to make a
`shared` glob that resolves to nothing visible; eess has no such rule id
(`RULE_IDS`, `boundaries.ts:26-32`).

Predates plan 0088's fold. See the [fold audit](../fold-audit-2026-08-19.md).

## Fix

Add the discovery guard: if a `shared` entry matches zero files, emit a
configuration finding naming the glob and the likely fix (`/**`), rather than
letting the emptiness express itself as boundary violations elsewhere.

Consider also whether folder-shaped globs should be normalised rather than
merely reported — but a silent normalisation hides an author's mistake, so
reporting is likely the honest default. Record the ruling here.

## Verification

- [ ] Red test first: `shared: ['**/src/shared']` emits a configuration finding
      naming the glob. Fails today.
- [ ] Red test: the legitimate shared import is **not** flagged once the glob
      resolves.
- [ ] Control: a correct `'**/src/shared/**'` emits no configuration finding.
- [ ] Vacuity control: the fixture's shared import is genuinely cross-boundary
      absent the `shared` allowance, so row 1 passing is meaningful.
- [ ] `npm run validate` green.

Deferred: none.
