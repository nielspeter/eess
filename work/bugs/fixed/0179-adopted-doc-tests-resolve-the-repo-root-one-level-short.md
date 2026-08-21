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
  plan's State to `Draft` produces `ledger/state-folder-mismatch — State: Draft
but filed in a done-folder`.

  **CORRECTION, found in review.** This record originally said the adopted test
  "would have matched zero plans and passed vacuously". **That was false, and it
  was asserted without being measured** — in a record whose entire virtue is that
  it measures. Repointed at `work/plans/completed/`, the test FAILS LOUDLY on two
  rows: its own vacuity guard is `expect(plans.length).toBeGreaterThan(50)` and
  eess has 26 completed plans; and 0 of those 26 use `**Status:**`, so the
  identity row lists every in-scope plan as `(no **Status:** line)`. The test was
  working correctly. Claiming a vacuous pass is the most damning thing this repo
  says about a check, and it must never be said from inspection alone.

  The disposition is unchanged and still right — `check:ledger` owns this, and the
  adopted test's `**Status:**` field and its `FIRST_IN_SCOPE = 78` grandfather
  boundary are both `ts-archunit` history. But the reason is redundancy, not
  vacuity.

  **One class of coverage is genuinely lost**, and it is filed rather than
  absorbed: a plan in a done-folder with **no `State:` line at all** passes
  `check:ledger` with exit 0. Measured — `headerStateViolation` returns `null`
  when no line is found (`packages/md/src/rules/ledger.ts`), because a document
  with no State is treated as "not an item", which is right for `ROADMAP.md` and
  wrong for something in `completed/`. The only trace is the summary's
  `124 records · 123 with a readable State`, a delta nothing asserts. Filed as
  [bug 0182](../0182-a-done-folder-document-with-no-state-line-is-not-an-item.md).

- **`every-plan-declares-its-blast-radius`** — would silently convert a
  review-enforced rule into a gate. eess's ADR-009 says in as many words that
  "Rules 1–4 and rule 6 are **review-enforced**", its Enforcement table has no row
  for rule 6, and `CLAUDE.md` does not require the line.

  **CORRECTED in review.** This said "3 of 38 plans carry one, so adopting it
  reddens ~35". All three numbers were wrong: the 3 came from a case-insensitive
  grep for the _phrase_, which matches prose mentions, not the `**Blast radius:**`
  field the test looks for. Measured with the deleted test's own regex: **0 of 37**
  numbered plans carry the field, and **20** are in scope (`>= 0078`) — so adopting
  it reddens all 20, and its grandfather guard (which requires at least one
  out-of-scope plan to LACK the line) behaves differently than assumed too.

  The ruling is unchanged and is strengthened by the real numbers. But a triage
  table justified by arithmetic nobody ran is the wrong precedent in this repo.

  **And the real justification is stronger than the one given.** ADR-009 does not
  merely leave rule 6 review-enforced by omission; it says so outright at line 229:
  "We deliberately do **not** dogfood these six rules as `eess-ts` rules against
  this repo's own source." Adopting that test would have contradicted a binding
  ADR, not pre-empted an undecided policy call.

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

### A defect this fix introduced, found in review and repaired

Repointing the hrefs left the **labels** untouched, so 13 citations read
`[ADR-008]` while resolving to `adr/009-…`, and `[bug 0020]` while resolving to
`work/bugs/0156-…`. A reader greps the label, not the href — so the fix for "a
live link to the wrong decision" produced exactly that, and converted a loud
failure (a dead link, which the gate saw) into a silent one (a resolving link
with a wrong name, which no gate sees).

Worse in scale, and pre-existing from the adoption rather than from this fix:
**177 unlinked prose references** said `ADR-008 rule N` or `ADR-009 part N`.
eess's ADR-008 (`caller-owns-reporting`) has **no numbered rules at all**; the
rules are ADR-009's, and the numbered Decision parts are ADR-010's. Both mappings
were verified in range before rewriting — the cited rule numbers are 1–6 and
ADR-009 has Rules 1–6; the cited part numbers are 1, 3 and 4 and ADR-010 has
parts 1–4.

Repaired: 13 labels synced to their targets, 177 prose references renumbered, and
117 upstream citations relabelled `[ts-archunit ADR-010]` so foreign numbering is
visible rather than inferred. 0 label/href mismatches remain.

The general lesson is the one the record already carries about roots: a rewrite
that fixes one half of a reference and not the other is not a partial fix, it is
a different defect.

`cross-document-links-resolve.test.ts`'s source-comment check is kept even though
`check:corpus` overlaps its corpus half: the two derive the link set differently,
and ADR-009 rule 5 is why a second independent derivation is worth having. (This
record cited `ADR-008 review rule 5` until review caught it: eess's ADR-008 has
no numbered rules at all — an instance of the very defect described below.)
The `src/`-comment direction is covered by no gate at all.

## Verification

- [x] `npm run validate` exits 0.
- [x] 3507 tests pass, 0 fail (was 27 failing). All five sibling suites green.
- [x] Each repointed test asserts a non-zero denominator, so none can pass
      vacuously on an empty corpus — the failure this bug is named after.
      `doctor-is-not-experimental` gained one (`pages.length > 20`) where its
      `upgrading.md` carve-out was removed as vacuous.
- [x] **Per ROW, not merely per file.** The line above was first written at file
      granularity and was false at row granularity, which is the granularity
      ADR-010 uses: two rows of `doc-globs-are-anchored` filtered
      `ANCHORING_REQUIRED`, a set empty by construction, so no input could redden
      them and the file-level floor was satisfied by a sibling bucket. Measured —
      a `./`-prefixed glob added to `docs/cli.md` left all five rows green while
      selecting 0 modules. The `./` check now runs over every bucket (it is dead
      for every base, per `core/glob-diagnosis.ts`), the emptiness of the registry
      is asserted rather than assumed, and the sabotage now reddens naming the
      file and the glob.
- [x] Everything that turned red for a REAL reason was fixed or recorded, not
      repointed away — the three classes above.
- [x] No count re-pinned to fit this corpus: `doc-globs-are-anchored`'s
      `toBe(31)` became a floor, for the reason its own sibling assertion already
      records about `toBe`.
- [x] `notImportFrom` measured against the `modules` fixture before concluding
      three doc examples were correct rather than dead — the alternative was
      editing three correct teaching pages, including the landing page, to satisfy
      an inherited assertion. Whole fixture: `src/infra/**` → 4 violations,
      `**/src/infra/**` → 4, `fastify` → 0. (This record first stated "1
      violation", which was the figure with the selection narrowed by
      `resideInFolder('src/domain/**')` and did not say so. The relative-equals-
      anchored equality and the conclusion are unchanged.)
