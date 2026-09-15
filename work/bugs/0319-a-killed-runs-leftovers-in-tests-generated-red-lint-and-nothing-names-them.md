# Bug 0319: a killed run's leftovers in `tests/__generated__` red `lint` with a wrong remedy, and nothing names or removes them

## Status

- **State:** Draft — measured by #139's enforcement review, and again by its author.
- **Severity:** Medium — **false red.** After a killed `vitest` run, `npm run lint` fails on a file
  `git status` does not show, and its message sends the author to the wrong fix.
- **Origin:** #139's enforcement and architecture reviews, 2026-09-15, while reviewing 0313's fix.
- **Reported:** 2026-09-15

## Symptom

Measured by the review, and again on 2026-09-15 at 0313's fix, on a planted leftover
`packages/ts/tests/__generated__/init-1-left/src/a.ts`: `eslint packages/ts/tests/__generated__` exits 1 and
reports `Parsing error: … was not found by the project service. Consider either including it in the
tsconfig.json or including it in allowDefaultProject`. The file is gitignored and excluded from
`tsconfig.json` on purpose, so both suggested remedies are wrong.

How a leftover gets there and stays:

- `lint` reads `packages/*/tests` (`package.json:36`), and ESLint's flat config reads no `.gitignore`;
  its ignores do not name `__generated__` (`eslint.config.ts:7`).
- `validate` runs `lint` before `test` (`package.json:21`), and the only cleanup, the vitest config's
  prune, runs when vitest loads — after `lint`.
- That prune removes `run-<pid>` directories of dead processes (`packages/ts/vitest.config.ts:34`) and
  nothing else. `packages/ts/tests/cli/init-scaffold-loads-rules.test.ts` removes its `init-<pid>-*`
  scaffolds in `afterEach` (`packages/ts/tests/cli/init-scaffold-loads-rules.test.ts:38`), which a
  killed run never reaches, so those are never removed.
- `check:integrity`, which leads `validate` to name a leftover probe before a later gate misreports it,
  recognises `__nonvacuity_probe` files (`scripts/check-workspace-integrity.mjs:438`) and not a
  `tests/__generated__` leftover.

## Why it matters

The same lint error is today the only check that stops a test force-committed under
`tests/__generated__`: vitest collects and runs it, `tsc` excludes it, and since
[0313](./fixed/0313-the-cardinality-scan-reads-probe-files-another-test-writes-mid-run.md) the
cardinality scan skips it. Adding `__generated__` to ESLint's ignores would remove the false red and
that backstop together.

## Fix

Remove `init-<pid>-*` leftovers of dead processes as `run-<pid>` ones are, before `lint` as well as
before `test`; have `check:integrity` name any leftover in `tests/__generated__`; and settle the ESLint
question only with the backstop replaced — `check:integrity` failing on a tracked file under
`tests/__generated__`, for instance.

Related, not measured: eess-mermaid's `packages/mermaid/tests/cli/gates-its-builders.test.ts` writes
probes under a `tests/__probe-*` directory that `.gitignore` does not name, per #139's architecture
review.

## Verification

- [x] Measured by #139's enforcement review, on a planted `init-*` leftover.
- [x] Measured again on 2026-09-15 in 0313's worktree: `eslint` exits 1 on the planted file with the
      project-service parsing error.
- [ ] a red test first
- [ ] the fix
- [ ] `npm run validate` green.

Deferred: none.
