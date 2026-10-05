# Bug 0388: a baseline entry forgives the same finding in any file

## Status

- **State:** Draft — measured; no red test yet. Fix decided (option E, 2026-10-06) and built by
  [plan 0346](../plans/0346-a-finding-is-identified-by-the-code-it-matched.md)'s Phase 2.
- **Severity:** High — **a baseline forgives a finding nobody reviewed.** Fix the file you
  baselined, make the same mistake in another file, and the build stays green. Of the floor's
  rules, `no-empty-bodies` was probed, through a hand-built builder with the preset's rule id
  rather than through the preset. It ships at `warn`, so it fails a build only when an adopter
  raises it to error.
- **Origin:** enforcement review of plan 0346's refresh, 2026-10-05, which widened a
  six-producer probe into this class.
- **Reported:** 2026-10-05

## Symptom

A baseline entry is a hash of `rule::subject`. For a finding with no `identity`, the subject
is `element::message`. **The file is not in it.** So a finding whose element and message do
not spell out its path has one baseline entry for every file it can occur in.

Each probe ran a rule twice. Run 1 has the finding in `src/a/…` and writes the baseline.
Run 2 has `a` fixed and the same finding in `src/b/…`, and then asks whether `b` is reported.
Measured on 2026-10-05 in throwaway worktrees of `main` at `9423420`. The probe sources were not
kept in the repo; the red tests in Verification replace them. **`b` was not reported in any of
these twelve:**

| condition                                                                | where the two files share |
| ------------------------------------------------------------------------ | ------------------------- |
| `notHaveDefaultExport`, `haveDefaultExport`                              | basename `index.ts`       |
| `moduleContain`, and `moduleUseInsteadOf`'s missing-good half            | basename `index.ts`       |
| `haveNoUnusedExports`, `beImported` (bug 0159), `onlyBeImportedVia`      | basename `index.ts`       |
| `haveMatchingCounterpart`, `haveConsistentExports`                       | basename `index.ts`       |
| `classes().should().extend('Base')`                                      | class name `Svc`          |
| `functions().should().beExported()`                                      | function name `handle`    |
| `recommended`'s `no-empty-bodies` condition (`functionNotHaveEmptyBody`) | function name `noop`      |

The controls carry an identity that names the path: `moduleNotContain` and `haveMaxExports`.
Both report `b`, plus one stale-baseline finding for the entry that matched nothing.

The list above is what was probed; it is not a census. The defect is in the shared
derivation, so every producer that leaves `identity` unset is exposed whenever its element
and message can repeat across files.

## Root cause

- `packages/core/src/violation.ts:227-229` — `subjectOf` returns
  `violation.identity ?? \`${violation.element}::${violation.message}\``.
- `packages/ts/src/helpers/baseline.ts:237-248` hashes `rule::subjectOf(v)`.
- `packages/core/src/baseline.ts:122-135` is a second `hashViolation` with its own copy of the
  same fallback.
- `packages/ts/src/helpers/baseline.ts:86` documents the identity as "rule + file + content
  hash". The hash does not implement that, and `isKnown` matches on the hash alone.

The same subject also keys `asSeverity('warn', { accepted })` (`packages/ts/src/core/terminal-builder.ts:854`) and
`disambiguateIdentities`'s grouping (`packages/core/src/violation.ts:248`), so the same hole is in an accepted
warning list.

## Fix

**Decided 2026-10-06: option E**, measured in [spike 0390](../spikes/0390-a-or-e-where-the-file-enters-a-findings-identity.md) and built by plan 0346's Phase 2. The options as they were put:

- put the root-relative file into the fallback subject (one change, one migration);
- or make `identity` required on every finding;
- or patch producers one at a time and leave a known residual.

- or match on the `file` each baseline entry already stores, as well as the hash (option E,
  raised by review).

Under A every baseline entry without an `identity` moves, so it ships through the same
migration as 0346. Under E no hash moves.

## Verification

- [ ] a red test per probed shape above, driven through the public builders: fix `a`,
      break `b`, and `b` is reported
- [ ] a guard that does not depend on a list of producers, so the next producer cannot
      reopen it
- [ ] the comments at `packages/ts/src/helpers/baseline.ts:86` and `packages/core/src/baseline.ts:11`
      say what the hash actually covers
- [ ] `npm run validate` green.

Deferred: none.
