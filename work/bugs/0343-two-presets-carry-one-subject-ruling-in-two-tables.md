# Bug 0343: two presets carry one subject ruling in two tables, kept in step by hand

## Status

- **State:** Draft — the decision is a design judgement, not a measurement. Filed so that the
  question has a home that is open and unfrozen, because shipped source points at it.
- **Severity:** Low — **no false green today, and a demonstrated route to one.** Both presets now
  read the same code. The defect is that nothing keeps them that way: the ruling lives in two
  hand-maintained places, and the last time they drifted it took two bug records and two releases to
  notice.
- **Origin:** the method review of PR #149 asked why 0333's ruling stopped at one preset; the method
  review of PR #151 (2026-09-26) objected that 0337 closed with `Deferred: none` over a question its
  own shipped comment still calls open.
- **Reported:** 2026-09-26

## Symptom

One ruling — _each rule reads the broadest subject its condition has a variant for, and exactly one,
because the subject kinds nest_ — is spelled twice:

| preset            | where the subject is decided                                          | shape                                               |
| ----------------- | --------------------------------------------------------------------- | --------------------------------------------------- |
| `recommended`     | `packages/ts/src/presets/recommended.ts` — the `SPECS` table          | an explicit `subject: 'module' \| 'function'` field |
| `agentGuardrails` | `packages/ts/src/presets/agent-guardrails.ts` — a local `push` helper | the builder chosen per call site                    |

Nothing binds them. The cost is already paid, twice:

- [0333](./fixed/0333-the-recommended-floor-reads-functions-only.md) made the ruling for `recommended`
  and did not generalise it.
- [0337](./fixed/0337-agent-guardrails-reads-function-bodies-only.md) applied it to the sibling, seven
  releases later — **two records for one decision**, and in between, a comment in `recommended.ts`
  had to warn adopters that the two presets read different code.

A third preset, or a fourth rule in either, re-opens the gap with nothing to catch it.

**And the question is described as open by shipped source, in a frozen record.**
`packages/ts/src/presets/recommended.ts` reads "Whether they should agree by construction is the open
question in 0337" — and 0337 is `State: Fixed`, in `work/bugs/fixed/`, which
`scripts/check-corpus.mjs:159` lists in `FROZEN`. That is
[0330](./0330-what-a-rule-reads-is-ruled-in-archived-bug-records.md)'s defect, which is why this
record exists rather than a sentence appended to a closed one.

## Root cause

0337 disposed of the question as "not now, and why" and wrote `Deferred: none`. That is defensible as
a decision and wrong as a ledger entry: a deferral with a real reason is still a deferral, and
`check:ledger` cannot see it because there is no unticked box to find. The honest form is
`deferred→<home>`, and this is the home.

## Fix

Not decided. Two candidates and a genuine third:

- **A shared spec shape** — lift `RuleSpec`/`subject`/`builderFor` into something both presets
  construct from. Binds them by construction; it is also a refactor of two presets' rule
  construction, each with its own options, severities and declaration carriers.
- **A test, not a mechanism** — assert that for every rule id the two presets share, and for every
  condition that has a module variant, the subject chosen agrees with the ruling. Cheaper, and it
  fails when they drift rather than preventing the drift. This is the shape
  `tests/matrix/path-glob-surfaces.ts` took for the glob census after
  [0339](./fixed/0339-globs-match-nothing-when-the-project-sits-under-a-dot-directory.md).
- **Neither, declared** — two tables is the right cost for two presets with different option shapes;
  then say so here, close this record, and change `recommended.ts` to state the decision rather than
  call it an open question.

Whichever lands, `packages/ts/src/presets/recommended.ts` must stop pointing at a frozen record.

## Related

- [0333](./fixed/0333-the-recommended-floor-reads-functions-only.md) and
  [0337](./fixed/0337-agent-guardrails-reads-function-bodies-only.md) — the two records this one
  decision produced.
- [0330](./0330-what-a-rule-reads-is-ruled-in-archived-bug-records.md) — a ruling whose only home is a
  frozen record; this is an instance with live source pointing into it.
- [0344](./0344-no-stubs-reads-function-bodies-though-its-condition-has-a-module-variant.md) — a rule
  the ruling selects `module` for and the wording overrode, which is the next test of whether the
  ruling binds anything.

## Verification

- [x] measured: the two spellings, the two records, and `recommended.ts` calling the question open
      while linking into `FROZEN`.
- [ ] a ruling among the three candidates
- [ ] the chosen mechanism, with a test that fails on drift
- [ ] `recommended.ts` repointed at a live statement of the decision
- [ ] `npm run validate` green.

Deferred: none.
