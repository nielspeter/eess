# Bug 0389: an accepted-warning list holds the author's absolute paths

## Status

- **State:** Draft — verified by reading the code on 2026-10-05; no red test yet.
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

## Verification

- [ ] a red test: an `accepted` list written under one root keeps the finding at `warn` under
      another
- [ ] the advice text prints the portable subject
- [ ] `npm run validate` green.

Deferred: none.
