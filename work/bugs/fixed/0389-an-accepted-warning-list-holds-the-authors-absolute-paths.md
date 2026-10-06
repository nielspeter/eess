# Bug 0389: an accepted-warning list holds the author's absolute paths

## Status

- **State:** Fixed — PR #181, 2026-10-06.
- **Severity:** Medium — **fails closed, but teaches the wrong reflex.** A deferred warning's
  `accepted` list written on one machine matches nothing on another, so every accepted finding
  escalates to error on CI. Nothing is forgiven that should not be. But the obvious remedy is to
  paste the CI machine's subjects instead, which only moves the problem.
- **Origin:** architecture and product review of plan 0346's Phase 2, 2026-10-05.
- **Reported:** 2026-10-05

## Symptom

`asSeverity('warn', { accepted })` keeps a finding at `warn` only when its subject is in the
list (`packages/ts/src/core/terminal-builder.ts:854` on `91b420a`). The comparison is the raw `subjectOf(v)`.
Nothing scrubs the root out of it, unlike the baseline hash, which runs `normalizeIdentityText`.

Producer identities interpolate the absolute path. For example, `dependency.ts` sets
`identity: \`${sourceFile.getFilePath()}::${subject}\``
(`packages/ts/src/conditions/dependency.ts:190`). And the advice an adopter is told to paste from
prints the same raw subjects (`packages/ts/src/core/terminal-builder.ts:919`on`91b420a`, before the fix). So the list an
adopter writes holds their checkout path.

The architecture reviewer measured one such subject on `HEAD`:
`/home/alice/repo/src/a/index.ts::aliased::x::y`, from
`modules(p).should().notHaveAliasedImports()`.

## Fix

**Built as spike 0392's C5, decided by the maintainer on 2026-10-06** after three review rounds each
found a version of this fix that accepted a finding `main` reports. The spike measured six matchers
over fifteen cases; [spike 0392](../../spikes/0392-what-makes-an-accepted-entry-portable.md) holds
the table and the harness.

- **The portable form.** Every `::`-delimited path token under the repository's root becomes
  `<root:NAME>/relative/path`, where NAME is the root `package.json` `name`
  (`portableTokens` and `discoverNamedRepository` in `packages/core/src/identity-root.ts`,
  exported from `@nielspeter/eess/internal`).
  - **The root** is the nearest ancestor holding `.git` (a directory, or the file a worktree or
    submodule has) or a workspace marker. A bare `package.json` is never a root: a package's own
    directory as root let two packages, or two copies of a template, share one entry.
  - **The name** is what makes it an identity: a root-relative path alone makes the same layout in
    two repositories look alike. No name, no portable form.
  - **Whole tokens, not substrings,** so a root that spells a path segment (`/app` and
    `src/app/user.ts`) keeps two files apart — bug 0391's shape, which the baseline hash still has.
- **The match.** An entry matches a finding by its raw subject (what a list written before the fix
  holds) or by its portable form. The entry itself is never rewritten.
- **The advice** prints the portable form.
- **Where the repository comes from.** The project's tsconfig, so there is one per builder. A
  builder that names no project gets none and keeps raw subjects, as before: a repository found per
  finding was measured to let an entry for one package accept the same finding in another.
- **The collision guard** compares raw subjects, as on `main`. Whole-token replacement under one
  repository cannot make two different subjects equal.
- **The baseline hashes are unchanged.** `portableSubjectOf` (`packages/core/src/violation.ts`) is
  the one definition both hashes use; it keeps the substring scrub, which is bug 0391's to fix.

**Residuals, stated.**

- **Two different repositories that share one `package.json` name** share an entry for the same
  relative path, under one rule file with one list. Nothing machine-independent tells them apart.
  Accepted by the maintainer; pinned by a `KNOWN RESIDUAL` test that turns red if it is ever closed.
- **Not portable, and fails closed:** builders that name no project (3 never do, 2 only when given
  one, of 15), repositories without a root `package.json` name, and paths written inside prose
  rather than as a `::` token.
- **Earlier versions of this fix, recorded so they are not rebuilt:** a substring scrub of both
  sides with a root per finding, then with a root per builder. Each was measured greener than
  `main` (spike 0392, column H: 10 rows).

## Verification

- [x] a red test: an `accepted` list written under one root keeps the finding at `warn` under
      another — `packages/ts/tests/core/an-accepted-list-is-portable.test.ts`. It went red before
      the fix: the advice printed the checkout path, and the pasted list escalated to `error`.
- [x] the advice text prints the portable subject — same file.
- [x] each of spike 0392's cases through the public path — same file: another checkout, a list
      written before the fix, a worktree, a checkout without `.git`, a different finding,
      two packages without a repository marker, two same-named packages inside one repository,
      submodules, separate repositories, an unnamed repository, a builder that names no project,
      whole tokens under `/app`, and the known residual.

Sabotage matrix, run against the shipping code in a worktree whose kernel resolution was proven.
Each row reds its own test:

| removed                                       | red                                                       |
| --------------------------------------------- | --------------------------------------------------------- |
| the portable match (raw only)                 | another checkout, worktree, no `.git`, and the residual   |
| the repository-marker requirement             | two same-named packages inside one repository             |
| the name in the token                         | the advice row, submodules, separate repositories, `/app` |
| `.git` as a file counting as a marker         | worktree                                                  |
| whole tokens (a substring scrub instead)      | `/app`                                                    |
| no repository for a builder without a project | the no-project row                                        |
| no name, no portable form                     | the unnamed-repository row                                |

- [x] `npm run validate` green on the C5 code, `57b4d14`: 500 s, exit 0, 3,958 eess-ts tests, 102
      nonvacuity fixtures fired. Earlier runs, in order:
  - `85d1852` failed one test,
    `held-builder-is-immutable.test.ts` · `it('every in-place-mutated container field is copied for the clone')`:
    a per-directory memo of the root was a builder field every clone would share. Dropped.
  - `62820bb`: 486 s, exit 0, 3,948 eess-ts tests, 102 nonvacuity fixtures fired.
  - `593d8e6` stopped on this repo's own `check:arch` (method length, complexity, class size);
    the helpers moved to module functions in `edcf329`.
  - `edcf329`: 516 s, exit 0, 3,952 eess-ts tests, 102 nonvacuity fixtures fired.
  - `f384f25`: 469 s, exit 0, 3,953 eess-ts tests, 102 nonvacuity fixtures fired. That code was
    then replaced by C5, after enforcement review measured it greener than `main`.

Deferred: none.
