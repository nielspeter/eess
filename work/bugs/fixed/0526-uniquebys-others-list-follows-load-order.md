# Bug 0526: `beUniqueBy`'s others list follows load order

## Status

- **State:** Fixed — 2026-10-19, on branch `fix/mark-not-judged`, at the coordinator's order before
  the release; merged through PR #253.
- **Severity:** Low — the findings are the same, and only their message text differs; no verdict
  changes. Above ten others it also decides which locations a message names.
- **Origin:** inbound · the release candidate's trial upgrade of the three adopters, 2026-10-19
  (issue E3 in the trial upgrade report, scratchpad, not kept): adopter 2's plan-number rule gave the same findings on Node and on Bun,
  with the others listed in a different order.
- **Reported:** 2026-10-19

## Symptom

`uniqueByCondition` (`packages/core/src/unique-by.ts`), the one `beUniqueBy` condition behind md's
`docs()`, `fields()` and gherkin's titles, names each member's others in the order the elements
reached it. That order is the dialect's load order, which differs between runtimes and file systems.
In a group of more than eleven, only the first ten others are named, so load order also decided
which ten.

## Cause

The others were built by filtering the group in place, `group.filter(…).map((o) => opts.locate(o).at)`,
with no sort.

## Fix

The others are sorted by their location, `locate(o).at`, before they are listed and cut at ten. The
comparison is deterministic and consults no locale: a run of digits compares as a number, so
`a.md:9` comes before `a.md:10` and `a2.md` before `a10.md`; anything else compares by code unit.
The order of the findings themselves is not changed; it is the reporter's.

## Verification

- [x] Red first: `packages/core/tests/unique-by.test.ts`, "the others are listed by location,
      whatever order the elements load in (bug 0526)" and "above ten others, the ten named are the
      first by location, not the first loaded (bug 0526)", both failed against the unfixed code
- [x] Green: the core suite (375), and the md and gherkin tests that use `beUniqueBy`
- [x] Sabotage matrix: see below
- [ ] `npm run validate` green — validation-owed: validate and CI at the pull request's merging head,
      recorded in the pull request's description

### Sabotage matrix

Committed before the run (`e80aeb82`). The core test reads the kernel's `dist` ([bug 0519](../0519-a-core-test-of-an-internal-symbol-reads-dist.md)), so each
mutant was rebuilt before its run and the build restored after. 2 rows, 2 red.

| Row | Mutant                                                    | Named test (in `unique-by.test.ts`)                                                        | Result |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------ |
| T1  | the others are not sorted                                 | the others are listed by location, whatever order the elements load in (bug 0526)          | red    |
| T2  | the others sort by code unit, a digit run not as a number | above ten others, the ten named are the first by location, not the first loaded (bug 0526) | red    |

Deferred: none
