# Bug 0388: a baseline entry forgives the same finding in any file

## Status

- **State:** Draft — measured on `main`; no red test yet. The fix is a design decision held
  in [plan 0346](../plans/0346-a-finding-is-identified-by-the-code-it-matched.md)'s Phase 2.
- **Severity:** High — **a baseline forgives a finding nobody reviewed**, and it reaches the
  default floor. Fix the file you baselined, make the same mistake in another file, and the
  build stays green.
- **Origin:** enforcement review of plan 0346's refresh, 2026-10-05, which widened a
  six-producer probe into this class.
- **Reported:** 2026-10-05

## Symptom

A baseline entry is a hash of `rule::subject`. For a finding with no `identity`, the subject
is `element::message`. **The file is not in it.** So a finding whose element and message do
not spell out its path has one baseline entry for every file it can occur in.

Each probe ran a rule twice. Run 1 has the finding in `src/a/…` and writes the baseline.
Run 2 has `a` fixed and the same finding in `src/b/…`, and then asks whether `b` is reported.
Measured on `main` on 2026-10-05. **`b` was not reported in any of these:**

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
Both report `b`, and both also report the stale entry for `a`.

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

The fix is a decision, and it is held in plan 0346's Phase 2:

- put the root-relative file into the fallback subject (one change, one migration);
- or make `identity` required on every finding;
- or patch producers one at a time and leave a known residual.

Whichever is chosen, every baseline entry without an `identity` moves, so it ships through
the same migration as 0346.

## Verification

- [ ] a red test per probed shape above, driven through the public builders: fix `a`,
      break `b`, and `b` is reported
- [ ] a guard that does not depend on a list of producers, so the next producer cannot
      reopen it
- [ ] `packages/ts/src/helpers/baseline.ts:86`'s comment says what the hash actually covers
- [ ] `npm run validate` green.

Deferred: none.
