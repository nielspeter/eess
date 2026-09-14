# Bug 0298: an exclusion that absorbs several subjects says nothing, outside cycle edges

## Status

- **State:** Draft — reproduced in both `applyFilters` copies, and pinned by
  KNOWN-GAP tests. The silence is also pinned **as design** by an existing control
  test, which the ruling this record needs will re-decide.
- **Severity:** Medium, at the top of it. For each subject a loose pattern absorbs,
  the result **is** a false green indistinguishable from compliance. What keeps it
  below [0233](./0233-an-exclusion-that-suppresses-every-violation-is-silent.md)'s
  High: the rule can still fail on what the pattern does not reach, and the pattern
  is the author's own declaration, visible in the diff that writes it. A loose
  pattern that happens to absorb every current violation is 0233.
- **Origin:** self-found · probing `eess-ts` against the findings of an external
  code-quality audit of an adopter monorepo.
- **Reported:** 2026-09-14

## Symptom

```ts
classes(p)
  .that()
  .haveNameEndingWith('Repository')
  .should()
  .notContain(call('this.db'))
  .rule({ id: 'x/no-raw-db' })
  .excluding(/Audit/)
  .check()
```

Over three violating classes — `DirectRepository`, `AuditRepository`,
`AuditTrailRepository` — this reports one, removes two, and writes nothing to
stderr. It will absorb any future `*Audit*` class the same way, in a diff that
does not touch the exclusion.

A pattern is tested against a violation's `element`, `file` **and** `message`
(`packages/core/src/execute-rule.ts:71`), so a path-shaped pattern absorbs every
subject in every file it matches. The docs teach unanchored patterns as the form
to copy (`docs/violation-reporting.md:184`, `docs/violation-reporting.md:193`).

## Root cause

The multi-match advisory exists and is scoped to one family. The eess-ts copy
accumulates matched subjects only for identities starting `cycle-edge::`
(`packages/ts/src/core/execute-rule.ts:193`) and warns only when that set holds
more than one edge (`:233-234`). The kernel copy
(`packages/core/src/execute-rule.ts:53`), which the four other dialects run, warns
only about a pattern that matched nothing (`:86-93`).

The scoping was deliberate, and its comment set an expiry
(`packages/ts/src/core/execute-rule.ts:218-232`): kept advisory, _"but the asymmetry
is real and worth re-litigating if this loophole is measured firing in practice."_
The control that pins it is `packages/ts/tests/core/excluding-matching.test.ts` ·
`it('CONTROL: a broad exclusion in an unrelated (non-cycle) family does not warn')`.

Two corrections to how this record first read that comment:

- **It cites "plan 0104", and no such plan exists in this repo** — the only 0104 in
  `work/` is a bug. The number is most likely carried over from ts-archunit, with the
  ADR numbers [0303](./0303-ts-archunit-adr-numbers-persist-in-eess-comments.md) records.
- **This record does not deliver the in-practice measurement.** The adopter evidence
  was re-sourced out when it was filed, and 0233 already cites
  [proposal 007](../proposals/007-ts-expose-terminalbuilder-declared-state.md) as that
  measurement. What this record adds is the scope: the loophole is not particular to
  cycle edges.

## Relation to 0233 — one decision, not two

0233 is the limit case: an exclusion that removes every violation. Its break-class
clause (2) says a fix must **not** fire when an exclusion legitimately suppresses
_some_ violations — which is exactly where one candidate below fires. The two
records need one decision about what an exclusion must disclose, recorded once;
0233's clause (2) now points here.

## Fix

Not decided. Settled constraints first:

- **Decide it once, in the kernel**, sequenced with
  [plan 0188](../plans/0188-unify-the-duplicated-engine-modules.md), which is
  unifying the two `applyFilters` copies — not as a patch to both.
- **Emit through the receipt ([ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md))
  or the run-boundary notice, not `writeStderr` inside the filter.** ADR-008 makes
  `reportViolations` the one emitter; the filter's existing stderr lines already
  emit during detection.
- **Define the subject.** Outside cycle edges, `element` can be a node kind or a
  file's base name. Distinct subjects need a key — `identity`, or `file` plus
  `element`.

Candidates, none measured:

1. **Disclosure on the receipt** — per pattern, what it removed, reaching
   `--format json` and the terminal summary. Stderr is not in a diff and is the
   channel ADR-009 Context point 1 says is not read. It does not reach the future
   diff that adds a new absorbed class, and it prints on every green run for every
   broad exclusion the docs teach.
2. **A configuration finding when a RegExp exclusion matches more than one distinct
   subject.** Contradicts 0233's clause (2); `bypassFilters` means no baseline can
   absorb it, so every existing broad pattern fails at once on upgrade — a marked break.
3. **A declared expected match set** — the pattern names the subjects it is meant to
   absorb, and fails when that set changes. This is the only candidate that reaches
   the future diff, and it has the expiry property ADR-010 §3 gives `.expectEmpty()`
   and ADR-009 rule 3's corollary prefers.

Independent of the ruling: the docs' examples can be anchored now.

## Verification

- [x] KNOWN-GAP tests pin today's behaviour, in both copies —
      `packages/ts/tests/core/an-exclusion-matching-many-subjects-is-silent.test.ts` ·
      `it('KNOWN GAP — one loose exclusion removes two violating subjects and writes nothing')`, and
      `packages/core/tests/an-exclusion-matching-many-subjects-is-silent.test.ts` ·
      `it('KNOWN GAP — the kernel applyFilters removes two subjects with one pattern and writes nothing')`.
      **They pin stderr during filtering, and nothing else.** A fix that writes there
      turns them red. A fix through the receipt or the run-boundary notice does not
      touch that channel and must bring its own red test at the `checkAll()` or CLI
      level; a declared-match-set fix must bring its own too.
- [ ] a ruling on what an exclusion must disclose, recorded once, with 0233's clause
      (2) and the CONTROL test above updated to match
- [ ] the fix in the kernel, sequenced with plan 0188
- [ ] the docs' exclusion examples anchored
- [ ] `npm run validate` green.

Deferred: none.
