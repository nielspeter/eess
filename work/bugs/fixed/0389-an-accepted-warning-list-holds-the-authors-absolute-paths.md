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

Compare, and print, the subject with the identity root scrubbed, in the same form the
baseline hash uses: one kernel function (`portableSubjectOf(v, root)`) called by both. Plan 0346's
Phase 2 depends on this: its `accepted` comparison uses the portable `file::subject`.

**As built.** `portableSubjectOf(violation, root?)` in the kernel
(`packages/core/src/violation.ts`, exported from `@nielspeter/eess/internal`) is the one
definition. Both baseline hashes call it, with unchanged output. The `accepted` comparison and the
advice text in `packages/ts/src/core/terminal-builder.ts` call it too.

- **Where the root comes from.** The identity root above the project's tsconfig (the
  `disk-set.ts` precedent). **A builder that names no project gets no root**, and keeps the raw
  subject exactly as before this fix. Of the 15 concrete builders that descend from
  `TerminalBuilder`, 10 always name their project, 2 name it when given one, and 3 never do
  (counted by method review; an earlier version of this record said 7, which did not reproduce).
  - _Why not a root per finding, which an earlier cut of this fix used._ Enforcement review
    measured it greener than `main`: with two package roots, `pkgA/src/a.ts` and `pkgB/src/a.ts`
    scrub to one subject, so an entry pasted for A accepted a B that appeared after A was fixed —
    `warn` where `main` said `error`, in a no-marker tree, a two-`package.json` tree and a
    submodule tree alike. No check over one run can see a collision with a finding that is no
    longer in the run, so the root must be one per run, and only the project gives one.
- **A filesystem root is treated as no root.** Scrubbing `/` would turn every separator in a
  subject into the token.
- **Both sides are scrubbed.** The accepted strings are scrubbed with the same root, so a list
  pasted before the fix, holding raw paths, still matches in the checkout it was written in. A
  list written elsewhere with a raw path still escalates, as it always did.
- **The collision guard compares what the matcher compares.** With one root per run, two raw
  subjects can still scrub to one when the checkout path also appears inside a file path (bug
  0391: under `/app`, `src/app/user.ts` and `src/appuser.ts`). The guard checks the scrubbed key
  as well as the raw one, so within one run every finding escalates and the advice names the
  cause.

**Residuals, stated.**

- **Builders that name no project are not fixed.** For the 3 that never name one, and the 2 when
  not given one, an `accepted` list still holds raw paths and is not portable, as before this fix.
- **Portability rests on root discovery** finding the same relative root in both checkouts. A
  checkout without `.git` or a workspace marker can stop at a different package; that fails closed
  (nothing matches), and the baseline has the same dependency.
- **Across runs, bug 0391 still lets one entry forgive a different file** whose path scrubs to the
  same subject; the guard sees only one run. That is 0391's to fix, and it predates this one.

## Verification

- [x] a red test: an `accepted` list written under one root keeps the finding at `warn` under
      another — `packages/ts/tests/core/an-accepted-list-is-portable.test.ts`. It went red
      before the fix: the advice printed `/home/alice/repo/…`, and the pasted list escalated to
      `error`. It is green after. Its other rows pin that the fixture's identity really carries
      the path, that a list from before the fix still holds where it was written, and that a
      different finding still escalates.
- [x] the advice text prints the portable subject — same file.
- [x] the root rules and the collision guard, each with a row that can fail — same file: a
      builder that names no project leaves its subjects as they are; an entry pasted for a fixed
      finding does not accept a new one under another package root; two findings that scrub to one
      subject escalate together; a builder that names its project scrubs against the root above
      its tsconfig; a filesystem root leaves the subject as it is.

Sabotage matrix, run against the code that ships, in a worktree whose kernel resolution was
proven. Each row reds its own test:

| removed                                       | red                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------- |
| the scrub on the subject (compare raw)        | the cross-checkout row and the row for a list pasted before the fix |
| the scrub in the advice text                  | the advice row, the cross-checkout row and the precedence row       |
| the scrub on the accepted side                | the row for a list pasted before the fix                            |
| no-project-no-root (a root per finding again) | the no-project row and the fixed-then-new row                       |
| the filesystem-root rule                      | the filesystem-root row                                             |
| the scrubbed-key collision check              | the scrub-to-one-subject row                                        |

- [x] `npm run validate` green on the final code, `f384f25`. All runs, in order:
  - `85d1852` failed one test,
    `held-builder-is-immutable.test.ts` · `it('every in-place-mutated container field is copied for the clone')`:
    a per-directory memo of the identity root was a builder field every clone would share. It was
    dropped rather than copied.
  - `62820bb`: 486 s, exit 0, 3,948 eess-ts tests, 102 nonvacuity fixtures fired.
  - `593d8e6` stopped on this repo's own `check:arch`: the review fixes had pushed
    `deferredWarningAdvice` past 30 lines and complexity 10, and `TerminalBuilder` past 150 lines.
    The root lookup, the match and the message text moved to module functions (`edcf329`), with
    the advice text unchanged.
  - `edcf329`: 516 s, exit 0, 3,952 eess-ts tests, 102 nonvacuity fixtures fired.
  - `f384f25`, the final code: 469 s, exit 0, 3,953 eess-ts tests, 102 nonvacuity fixtures fired.

Deferred: none.
