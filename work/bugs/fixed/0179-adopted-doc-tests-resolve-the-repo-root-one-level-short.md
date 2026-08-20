# Bug 0179: adopted doc tests resolve the repo root one level short

## Status

- **State:** Fixed — `npm run validate` exits 0; 3507 tests pass, 0 fail.
- **Deferred:** none
- **Found:** 2026-08-20, running the full gate chain during the fold-audit
  review. Both enforcement reviewers observed the failures and classified them as
  "pre-existing", which is true of the branch but not of `main`.
- **Severity:** was a **merge blocker**.

## Symptom

27 tests across 12 files failed. `main` carries none of these files — they arrived
with this branch's ts-archunit corpus adoption, so this was the adoption
half-landed, not inherited debt.

```
 Test Files  12 failed | 253 passed (265)
      Tests  27 failed | 3499 passed (3526)
```

## Root cause — broader than the title

The title names the visible symptom. `packages/ts/tests/<area>/../..` is
`packages/ts`, and `ts-archunit` is a single-package repository where that WAS the
repo root. But repointing alone would have fixed almost nothing, because the tests
also encode that project's:

- **corpus layout** — `bugs/`, `plans/`, `proposals/` at the top level, where eess
  keeps them under `work/`;
- **artifacts** — a root `CHANGELOG.md` and a `docs/upgrading.md`, neither of which
  eess has;
- **conventions** — `**Status:**` headers where eess writes `- **State:**`;
- **numbering** — citations to `bugs/fixed/0044-…` and
  `adr/008-agent-first-failure-surfaces.md`, whose numbers mean _different
  documents_ in eess. eess's ADR-008 is "caller owns reporting"; the agent-first
  one is ADR-009.

That last one was the dangerous class: not a dead link but a **live link to the
wrong decision**.

**Two of the twelve did not fail on the root at all**, which the first draft of this
record got wrong:

- `tools/scan-cardinality-assertions.test.ts` resolves `packages/ts` correctly and
  was reporting a genuine ratchet breach.
- `release/version-bump-guard.test.ts` points at
  `.github/scripts/assert-version-bump-is-safe.sh`, which eess does not have.

## Fix

### The two roots are named, not counted

New `packages/ts/tests/roots.ts` exports `packageRoot` and `repoRoot` (discovered
by walking up to the `package.json` declaring `workspaces`, so it survives the file
moving). Several tests need **both** — `doc-globs-are-anchored` reads `docs/` from
the monorepo and `src/conditions/dependency.ts` from the package — which is why a
blanket `'../../..'` would have been wrong.

### Triage, per file

| file                                                | disposition                           |
| --------------------------------------------------- | ------------------------------------- |
| `docs/doc-globs-are-anchored.test.ts`               | repointed (both roots)                |
| `docs/doctor-is-not-experimental.test.ts`           | repointed                             |
| `docs/deprecation.test.ts`                          | repointed (both roots)                |
| `docs/preset-ids-in-docs-exist.test.ts`             | repointed — per-row roots             |
| `docs/shipped-links.test.ts`                        | repointed + adapted to eess packaging |
| `docs/cross-document-links-resolve.test.ts`         | repointed (both roots)                |
| `tools/scan-cardinality-assertions.test.ts`         | re-baselined, delta stated            |
| `docs/upgrading.test.ts`                            | **not adopted**                       |
| `docs/upgrade-rows-name-their-presets.test.ts`      | **not adopted**                       |
| `docs/completed-plans-are-marked-done.test.ts`      | **not adopted**                       |
| `docs/every-plan-declares-its-blast-radius.test.ts` | **not adopted**                       |
| `release/version-bump-guard.test.ts`                | **not adopted**                       |

### Why the five were not adopted

- **`upgrading` / `upgrade-rows-name-their-presets`** — both assert against
  `docs/upgrading.md`, which eess does not publish and nothing references. The
  honest options were to delete them or to write an upgrade page to satisfy a test,
  and writing product docs to make a test green is backwards. Adopting them
  conditionally ("check it if it exists") would be worse: a gate that cannot fail
  (ADR-009).
- **`completed-plans-are-marked-done`** — a duplicate. `check:ledger` already
  enforces it, better and natively. Verified by experiment: setting a completed
  plan's State to `Draft` produces
  `work/plans/completed/0058-…:5 ledger/state-folder-mismatch — State: Draft but
filed in a done-folder`. The adopted version reads `**Status:**`, a field eess
  does not use, so it would have matched zero plans and passed vacuously.
- **`every-plan-declares-its-blast-radius`** — would silently convert a
  review-enforced rule into a gate. eess's ADR-009 says in as many words that
  "Rules 1–4 and rule 6 are **review-enforced**", its Enforcement table has no row
  for rule 6, and `CLAUDE.md` does not require the line. 3 of 38 plans carry one, so
  adopting it reddens ~35. That is a policy decision, not a test fix.
- **`version-bump-guard`** — tests a shell script eess never ported, guarding a
  hand-edited-version release model eess does not use. eess releases through
  changesets, and `check:release` already enforces that every changed package
  declares its bump.

### Real defects the repointing surfaced

Repointing was the first half; these are the second, and they are the argument for
having done it rather than deleting the tests:

1. **24 doc hits teaching deprecated API.** `docs/` documented
   `notImportFromCondition`, `shouldExtend`, `shouldImplement`,
   `shouldHaveMethodNamed`, `conditionHaveNameMatching`, `shouldResideInFile` and
   `shouldResideInFolder` as the **primary** spelling — in "Available Conditions"
   tables, not a migration section — while eess-ts's own source marks all seven
   `@deprecated`. 38 occurrences renamed to the replacements the source names.
2. **Two broken links in a shipped file.** `packages/ts/README.md` linked
   `../../README.md` and `../../docs/agent-integration.md`; `files` is
   `['dist', 'README.md', 'LICENSE']`, so both resolved to nothing from the npm
   tarball. Now absolute. This is exactly the defect `shipped-links.test.ts` exists
   to catch, caught the moment it could see real files.
3. **146 source-comment citations into a foreign corpus.** Repaired by matching on
   **slug** rather than number, which is verifiable rather than invented: 22 resolved
   to an eess record (confirming the fold renumbering — ts-archunit ADR-008 →
   eess ADR-009, bug 0020 → eess 0156, bug 0038 → eess 0157) and 124 became absolute
   `ts-archunit` URLs, which is what they are: citations of upstream history with no
   eess equivalent. 0 ambiguous. Four fixture strings (`./old.md`, `./ghost.md`)
   were excluded by guard — they are test data, not citations.

`cross-document-links-resolve.test.ts`'s source-comment check is kept even though
`check:corpus` overlaps its corpus half: the two derive the link set differently,
and ADR-008 review rule 5 is why a second independent derivation is worth having.
The `src/`-comment direction is covered by no gate at all.

## Verification

- [x] `npm run validate` exits 0.
- [x] 3507 tests pass, 0 fail (was 27 failing). All five sibling suites green.
- [x] Each repointed test asserts a non-zero denominator, so none can pass
      vacuously on an empty corpus — the failure this bug is named after.
      `doctor-is-not-experimental` gained one (`pages.length > 20`) where its
      `upgrading.md` carve-out was removed as vacuous.
- [x] Everything that turned red for a REAL reason was fixed or recorded, not
      repointed away — the three classes above.
- [x] No count re-pinned to fit this corpus: `doc-globs-are-anchored`'s
      `toBe(31)` became a floor, for the reason its own sibling assertion already
      records about `toBe`.
- [x] `notImportFrom('src/infra/**')` measured to report 1 violation against the
      `modules` fixture before concluding three doc examples were correct rather
      than dead — the alternative was editing three correct teaching pages,
      including the landing page, to satisfy an inherited assertion.
