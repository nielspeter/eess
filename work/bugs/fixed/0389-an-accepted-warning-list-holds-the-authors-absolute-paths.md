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
`` identity: `${sourceFile.getFilePath()}::${subject}` ``
(`packages/ts/src/conditions/dependency.ts:190`). And the advice an adopter is told to paste from
prints the same raw subjects (`packages/ts/src/core/terminal-builder.ts:919` on `91b420a`, before the fix). So the list an
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
- **The collision guard** compares raw subjects, as on `main`. Two different raw subjects can still
  share a portable form in two contrived ways, both measured by enforcement review:
  - **a separator.** On POSIX a backslash is part of a file name, so `repo\src/a.ts` and
    `repo/src/a.ts` are two files. Only the root prefix is compared with separators normalised, and
    only on Windows, where `\` is one; the rest of every token is kept verbatim. On POSIX the two
    stay apart. (The first attempt normalised the root prefix on every platform; review of `bcfe457`
    measured that prefix case still colliding.)
  - **a subject that already spells the portable syntax**, which turns portable matching off for
    its rule (below).
- **A subject that spells the portable syntax turns portable matching off for its rule** (spike
  0393; option A, taken by the coordinating agent on the maintainer's instruction). If any finding of a deferred warning has `<root:` in its raw subject (identity, or element
  and message), that rule compares raw subjects only, exactly as on `main`, and the advice names the
  subjects that spell it. No portable syntax can be made unspellable: `identity` is a plain string
  and messages are free text. No producer template in eess spells `<root:`, though values a template
  interpolates (module specifiers, names, matcher descriptions) are user-controlled. (`bcfe457`
  escalated every finding of such a rule instead; review measured that as stricter than `main` for a
  raw list and stricter than the spike's option A, and it was narrowed.)
- **The baseline hashes are unchanged.** `portableSubjectOf` (`packages/core/src/violation.ts`) is
  the one definition both hashes use; it keeps the substring scrub, which is bug 0391's to fix.

**Residuals, stated.**

- **Two different repositories that share one `package.json` name** share an entry for the same
  relative path, under one rule file with one list. Nothing machine-independent tells them apart.
  Inside one checkout this includes two submodules with the same name, or a nested repository with
  the outer one's name (copied templates that are not their own repositories fail closed). Accepted
  by the maintainer on 2026-10-06; pinned by a `KNOWN RESIDUAL` test that turns red if it is ever
  closed.
- **An entry kept for a finding that spelled the portable syntax.** While that finding is present
  the rule matches raw subjects only; once it is fixed, an entry kept for it can equal another
  finding's portable form. Pinned by a second `KNOWN RESIDUAL` test (spike 0393).
- **Not portable, and fails closed:** builders that name no project (3 never do, 2 only when given
  one, of 15), repositories without a root `package.json` name, and paths written inside prose
  rather than as a `::` token.

**Superseded designs, kept so they are not rebuilt** (all on this PR, 2026-10-06):

1. **Substring scrub, a root per finding** (`85d1852`–`593d8e6`). The root was found above the
   project's tsconfig, or above each finding's own file when the builder named no project. A
   scrubbed-key collision guard was added after enforcement review, and sabotage-tested. Enforcement
   review then measured the cross-run case greener than `main`: an entry pasted for `pkgA/src/x.ts`
   accepted `pkgB/src/x.ts` after A was fixed, in a no-marker tree, a two-`package.json` tree and a
   submodule tree.
2. **Substring scrub, a root per builder, none without a project** (`f384f25`). Enforcement review
   measured one list shared across projects greener than `main`, and bug 0391's shape across runs.
   This is spike 0392's column H: greener on 10 of its 15 rows.
3. **The count behind "10 always, 2 when given one, 3 never".** Method review counted the 15
   concrete builders that descend from `TerminalBuilder`. An earlier version of this record said 7
   name their project, which did not reproduce.

## Verification

- [x] a red test: an `accepted` list written under one root keeps the finding at `warn` under
      another — `packages/ts/tests/core/an-accepted-list-is-portable.test.ts`. It went red before
      the fix: the advice printed the checkout path, and the pasted list escalated to `error`.
- [x] the advice text prints the portable subject — same file.
- [x] each of spike 0392's cases through the public path — same file: another checkout, a list
      written before the fix, a worktree, a checkout without `.git`, a different finding,
      two packages without a repository marker, two same-named packages inside one repository,
      submodules, separate repositories, an unnamed repository, a builder that names no project,
      a path that spells the root again, a backslash in a file name and at the root prefix, a
      subject that spells the portable syntax (with and without an identity, its advice, the list it
      tells the author to paste, its remedy, and its order after a collision), and both known
      residuals. Three of the spike's rows have no test of their
      own: `/app` itself (a test cannot create it, so its whole-token rule is tested on the kernel
      function and, through the builder, with a path that spells the temporary root again), "no
      markers" and "two repositories with one directory name" (closed by the same mechanisms the
      separate-repositories and two-packages rows pin).

Sabotage matrix, run against the shipping code in a worktree whose kernel resolution was proven.
Its script and output were kept in the session scratchpad (`sab9.py`, `sab9.out`), which is not part
of the repository; the table is the output. Each row reds the tests listed:

| removed                                         | red                                                                   |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| the portable match (raw only)                   | another checkout, worktree, no `.git`, both residuals                 |
| the repository-marker requirement               | two same-named packages inside one repository                         |
| the name in the token                           | 11 rows, among them advice, submodules, separate repositories, `/app` |
| `.git` as a file counting as a marker           | worktree                                                              |
| whole tokens, in the kernel                     | `/app`, builder whole tokens                                          |
| whole tokens, in the builder                    | builder whole tokens                                                  |
| no repository for a builder without a project   | the no-project row, the pasted-advice row                             |
| no name, no portable form                       | the unnamed-repository row                                            |
| portable matching off for a marker subject      | the five rows for that case                                           |
| the cause in its advice                         | the advice row, the pasted-advice row, the remedy row                 |
| element and message counting, not only identity | the identity-less row                                                 |
| separators normalised on POSIX                  | the backslash-at-the-prefix row                                       |
| its advice listing raw subjects to paste        | the pasted-advice row                                                 |
| a collision reported before it                  | the collision-order row                                               |
| its remedy saying to remove the old entry       | the remedy row                                                        |
| the rest of a path kept verbatim                | the backslash row                                                     |

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
