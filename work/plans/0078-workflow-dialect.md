# Plan 0078: Workflow dialect (`eess-workflow`)

## Status

- **State:** Draft — waiting on demand. This has sat on the board as an idea
  since the family was consolidated; no consumer has asked for it. It is written
  down so the shape is on record, not because it is scheduled.
- **Priority:** P3 — speculative. Building a sixth dialect nobody has asked for
  costs maintenance on every kernel change.
- **Effort:** ~2 sessions (the dialect pattern is well-worn by now).
- **Created:** 2026-07-19

## Problem

CI workflows, pipelines and job definitions are specs like any other: they
declare what must happen, they drift from what the code actually needs, and
nothing checks the correspondence. A workflow that references a script that was
renamed, or a job matrix that has silently diverged from the packages it claims
to cover, fails only when someone notices.

The family already has the machinery — a dialect is a parser plus an
element→violation adapter over the kernel's `RuleBuilder`, and
`eess-crossvalidate` already binds two dialects so drift in either fails the
build. A `.github/workflows/*.yml` dialect would let this repo's own CI be
validated against its own `package.json` scripts.

The concrete itch that exists today: two CI defects found in one session (a
missing `npm rebuild` that left workspace bins unlinked, and a gate whose
output format changed under `GITHUB_ACTIONS`) were both invisible to every gate
eess runs. eess validates its specs against its code and its code against its
diagrams, but nothing validates the thing that runs the gates.

## Approach (sketch — a Draft, not a frozen floor)

**Phase 1 — grammar.** Parse workflow YAML into elements: workflows, jobs, steps,
`run` commands, matrix entries.

**Phase 2 — rules.** Predicates and conditions over those elements — a `run` step
must reference a script that exists in `package.json`; a job matrix must cover
every workspace package; a step must not depend on a bin that nothing links.

**Phase 3 — crossvalidate.** Bind workflow ↔ `package.json` scripts, and
workflow ↔ the packages table, so a new package with no CI coverage fails.

**Phase 4 — dogfood.** Point it at this repo's `.github/workflows/ci.yml` and
confirm it would have caught the two defects above. If it would not have, the
dialect is not earning its place — say so and stop.

## Out of scope

- Executing or simulating workflows. This is static correspondence, not a runner.
- Non-GitHub CI systems, until one is actually in use.

## Success definition

Phase 4 is the honest gate on this whole plan: the dialect must catch a real,
already-experienced CI defect. A dialect that only catches hypothetical problems
is a maintenance liability.

## Open questions (resolve before Ready)

- [ ] Is there demand, or is the dogfood case the entire justification? If the
      latter, a handful of `eess-md`/`eess-ts` rules over the YAML may be
      cheaper than a sixth published package.
- [ ] Does YAML parsing belong in a dialect, or is there a generic
      structured-document dialect hiding here (YAML/JSON/TOML) that would serve
      more cases?
