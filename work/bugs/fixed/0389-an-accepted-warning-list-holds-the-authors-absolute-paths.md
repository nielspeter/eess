# Bug 0389: an accepted-warning list holds the author's absolute paths

## Status

- **State:** Fixed — on branch `fix/0389-portable-accepted`, 2026-10-06.
- **Severity:** Medium — **fails closed, but teaches the wrong reflex.** A deferred warning's
  `accepted` list written on one machine matches nothing on another, so every accepted finding
  escalates to error on CI. Nothing is forgiven that should not be. But the obvious remedy is to
  paste the CI machine's subjects instead, which only moves the problem.
- **Origin:** architecture and product review of plan 0346's Phase 2, 2026-10-05.
- **Reported:** 2026-10-05

## Symptom

`asSeverity('warn', { accepted })` keeps a finding at `warn` only when its subject is in the
list (`packages/ts/src/core/terminal-builder.ts:854`). The comparison is the raw `subjectOf(v)`.
Nothing scrubs the root out of it, unlike the baseline hash, which runs `normalizeIdentityText`.

Producer identities interpolate the absolute path. For example, `dependency.ts` sets
`identity: \`${sourceFile.getFilePath()}::${subject}\``
(`packages/ts/src/conditions/dependency.ts:190`). And the advice an adopter is told to paste from
prints the same raw subjects (`packages/ts/src/core/terminal-builder.ts:919`). So the list an
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

- **Where the root comes from.** The builder has no root of its own, and only 7 of the 15
  builders that extend `TerminalBuilder` name their project. So the root is the identity root
  above the project's tsconfig when the builder names one (the `disk-set.ts` precedent), and
  otherwise the identity root above the finding's own file.
- **A filesystem root is treated as no root.** Scrubbing `/` would turn every separator in a
  subject into the token.
- **Both sides are scrubbed.** The accepted strings are scrubbed with the same root, so a list
  pasted before the fix, holding raw paths, still matches in the checkout it was written in. A
  list written elsewhere with a raw path still escalates, as it always did.

## Verification

- [x] a red test: an `accepted` list written under one root keeps the finding at `warn` under
      another — `packages/ts/tests/core/an-accepted-list-is-portable.test.ts`. It went red
      before the fix: the advice printed `/home/alice/repo/…`, and the pasted list escalated to
      `error`. It is green after. Its other rows pin that the fixture's identity really carries
      the path, that a list from before the fix still holds where it was written, and that a
      different finding still escalates.
- [x] the advice text prints the portable subject — same file. Sabotage matrix, run in a
      worktree whose kernel resolution was proven: - comparing raw subjects again reds the cross-checkout row; - printing raw subjects again reds the advice row and the cross-checkout row.

      Not sabotaged: dropping the scrub on the accepted side. The compatibility row exists for
      that, but no sabotage run proved it can go red.

- [x] `npm run validate` green at `62820bb`, 486 s, exit 0. That covers 3,948 eess-ts tests
      plus the kernel and sibling suites, and all 102 nonvacuity fixtures fired. The first run, at
      `85d1852`, failed one test:
      `held-builder-is-immutable.test.ts` · `it('every in-place-mutated container field is copied for the clone')`.
      A per-directory memo of the identity root was a builder field that every clone would share.
      The memo was dropped rather than copied: discovery runs only for a deferred warning, and a
      cache would add a staleness question for no measured gain.

Deferred: none.
