# Bug 0336: a rule that changes subject re-reports accepted findings, and no diagnostic says why

## Status

- **State:** Draft — measured by the customer review of PR #149 on a scaffolded adopter project
  upgraded across the change. The fix is a decision about what the baseline may claim to detect.
- **Severity:** Medium — **no false green; a false alarm with no explanation.** On upgrade day a
  finding the adopter had accepted comes back as a fresh error, at the top of the list, and the two
  diagnostics that exist for "your baseline and this run disagree" both stay silent. The adopter is
  told they have a new violation when they have an old one under a new subject.
- **Origin:** the customer review of PR #149, 2026-09-20, which walked the `npm update` path across
  [0333](./fixed/0333-the-recommended-floor-reads-functions-only.md)'s change.
- **Reported:** 2026-09-20

## Symptom

Measured across `main` at faf1503 → the 0333 branch, one adopter project, one committed baseline:

| what the adopter sees                                      | what is true                                  |
| ---------------------------------------------------------- | --------------------------------------------- |
| a fresh `no-eval` error on an accepted `eval` in `runEval` | the finding's subject moved, the code did not |
| no `descriptionChangeFinding`                              | both builds print the same rule description   |
| no `unmatchedBaselineFinding`                              | `matched` was 3, not 0                        |

The baseline entry is a hash of the rule and the finding's subject. A finding that moves from a
function subject to a module subject hashes differently, so the entry stops matching — correctly.
What is missing is anything that says so.

## Root cause

The two diagnostics cover the two shapes anyone had met before:
`descriptionChangeFinding` (`packages/ts/src/helpers/baseline-diagnostics.ts:66`) fires when the
rule's DESCRIPTION changed, and `unmatchedBaselineFinding` (`:125`) when the baseline matched
**nothing** (`matched === 0`). A subject change is neither: the description is stable and most
entries still match. The gap is exactly the case where a rule keeps its id, keeps its wording, and
changes what it reads — which is what an upgrade does.

## Fix

Not decided, and the decision is what a baseline is allowed to claim.

- A **partial-match diagnostic** — some entries matched, some did not, and the unmatched ones are
  reported as a set — is the smallest thing that would have spoken here. It needs a threshold, and a
  threshold is a guess unless it is derived: every unmatched entry is already known by the time the
  run ends.
- A **subject-kind stamp in the entry** would let the diagnostic name the cause rather than the
  symptom ("these entries were recorded against a function subject; this rule now reads a module").
  That is a baseline format change, which is its own migration.
- **Nothing, declared**: say in the release notes that a subject change invalidates entries, and
  accept that the tool does not say it at the moment it matters. That is what
  [0333](./fixed/0333-the-recommended-floor-reads-functions-only.md)'s changeset does today, which
  is why this is Medium and not High.

## Related

- [0333](./fixed/0333-the-recommended-floor-reads-functions-only.md) — the change that produced the
  first instance; its changeset states the remedy and its order.

## Verification

- [ ] reproduced by a test that upgrades a rule's subject with a baseline in place
- [ ] a ruling on what the baseline may detect and say
- [ ] the fix, with the diagnostic pinned
- [ ] a changeset
- [ ] `npm run validate` green.

Deferred: none.
