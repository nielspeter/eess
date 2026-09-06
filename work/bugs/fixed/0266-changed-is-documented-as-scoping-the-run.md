# Bug 0266: `--changed` is documented as scoping the run and keeping hooks fast; it filters the report

## Status

- **State:** Fixed — filed and fixed 2026-09-06 in the same PR (the 0236
  shape): the docs sentence, the large-projects note and the ADR-002 row.
  `Deferred: none`.
- **Severity:** Medium — the one claim/check gap both reviews of
  [proposal 010](../../proposals/010-ts-performance-at-scale.md) found. An adopter
  who wires the agent-hook recipe expecting a faster run on a large repository
  gets the same run and a shorter report, and nothing tells them so.
- **Implements:** proposal 010
- **Origin:** self-found · the second review of proposal 010 ruled the
  proposal's "docs slice" `Accepted` as `Docs-only` and found it owned by no
  record; this is that record.
- **Reported:** 2026-09-06

## Symptom

`docs/agent-integration.md:71` tells the reader that `--changed`

> scopes the run to files touched on the current branch (`--base main` to
> change the comparison branch), keeping the hook fast on large repos.

Both halves are wrong. `packages/core/src/diff-aware.ts:10` says what the flag
does, in capitals: rules evaluate the **full** project, and only the reporting
is filtered to changed files. Measured with `scripts/profile-ts-check.mjs` on
the workspace `arch.rules.ts` builds: project construction is 265 files and
several hundred milliseconds before any rule runs, and `--changed` does not
touch that stage. The flag buys a shorter report, not a faster hook.

Two adjacent gaps in the same territory, owned here because a reader who
finds the first sentence wrong goes looking for what does work:

- `docs/cli.md:141` names watch-mode substitution as the large-project advice
  ("consider using `vitest --watch`"). The lever that actually reduces the
  work — a narrower tsconfig, or one `project()` per rule file — is documented
  nowhere, and neither is its cost: cross-file conditions (`beImported`,
  `haveNoUnusedExports`, cycles, layer order) lose visibility of what was left
  out.
- `adr/002-ts-morph-ast-engine.md:96` promises three mitigations for the
  5000+ file case — lazy source file parsing, predicate memoization, file-set
  narrowing via `resideInFolder` — and its Enforcement table carries no row for
  them. Parsing is eager (`packages/ts/src/core/project.ts:64`; measured
  `parsedEagerly: true`), narrowing was never built, and nothing in the table
  says either.

## Reproduction

Read the three lines. For the first: `npx eess-ts check arch.rules.ts --changed`
on a clean branch prints the suppression notice from
`packages/core/src/diff-disclosure.ts` and takes as long as the same command
without the flag — the profile script's `project.initMs` is paid either way.

## Root cause

The docs sentence was written from the flag's name. The flag's own docstring in
the kernel says the opposite, and no gate binds a prose claim about behaviour
to the code it describes: `check:docs-code` type-checks code fences, and
`check:corpus` grounds a `path:line` pointer to an existing line, not to what
the sentence beside it claims.

## Fix

1. `docs/agent-integration.md:71` — say what the flag does: it filters the
   **report** to files touched since `--base`; every rule still evaluates the
   whole project, so the run costs the same; what it buys is a report an agent
   can act on without wading through pre-existing findings. Carry a pointer to
   `packages/core/src/diff-aware.ts:10` beside the sentence so `check:corpus`
   grounds it — Tier 1, and honestly so: the gate proves the line exists, the
   claim itself is review-enforced.
2. `docs/cli.md` — a "Large projects" paragraph naming the narrower-tsconfig /
   per-rule-file `project()` lever, and its cost in one sentence.
3. `adr/002-ts-morph-ast-engine.md` — a `pending` row in the Enforcement table
   for the three mitigations at line 96, stating that none is built and that
   proposal 010's Ask A is the file-set narrowing one, held on its own
   measurement.

## Verification

- [x] done-otherwise — no red test: the defect is prose. The instrument is
      `check:corpus` on the pointer added in fix 1 (it grounds the line; the
      claim's truth is reviewed, not gated), and this record says so rather than
      naming a gate that reads no prose.
- [x] `docs/agent-integration.md` no longer says "scopes the run" or "fast".
- [x] `docs/cli.md` names the lever and its cost, under "Large projects".
- [x] ADR-002's table carries the row, status `deprecated` — the promise is
      recorded as measured and not kept, rather than as pending work; `check:corpus`
      (ADR tables) green.
- [x] `npm run check:fast`, `check:ledger`, `check:docs-code` green in the PR;
      `npm run validate` is CI's.

Deferred: none.

## Related

- [Proposal 010](../../proposals/010-ts-performance-at-scale.md) — the docs
  slice its second review accepted; the Priority of that proposal rests on this
  record existing.
- [0221](../0221-diffaware-cannot-tell-no-changes-from-wrong-base.md) — the
  same flag's other silence: an empty diff is indistinguishable from a wrong
  base.
