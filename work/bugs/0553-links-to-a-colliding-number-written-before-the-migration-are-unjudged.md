# Bug 0553: links to a number ts-archunit also used, written before the migration, are unjudged

## Status

- **State:** Draft — found 2026-10-28 by the re-check of
  [plan 0542](../plans/0542-this-repositorys-record-mentions-are-migrated.md)'s lane 4; measured,
  not read.
- **Severity:** Medium — a wrong link is green under every gate, and [plan 0542](../plans/0542-this-repositorys-record-mentions-are-migrated.md)'s lanes found the
  class real: 5 wrong among the 693 such links its lanes 2 to 4 wrote, all of which a judge has
  now read.
- **Origin:** self-found, 2026-10-28. Recorded rather than read in [plan 0542](../plans/0542-this-repositorys-record-mentions-are-migrated.md), whose lanes judge the
  links they write, not the ones the corpus already held.
- **Reported:** 2026-10-28

## Symptom

eess was folded from ts-archunit, whose records reuse eess's numbers (its ADRs 001–010, plans to
0106, bugs to 0080, proposals to 028, spikes to 0069). The engine under `packages/*/src` came from
ts-archunit, and its comments cite 136 numbers inside that range; records copy them without naming
the project. A link to eess's record with such a number can mean ts-archunit's record and is then
wrong, and nothing can tell: the link resolves and its text names the record it points at, so
[plan 0549](../plans/completed/0549-a-link-names-the-record-it-mentions.md)'s target check greens it.

[Plan 0542](../plans/0542-this-repositorys-record-mentions-are-migrated.md)'s lanes 2 to 4 wrote 693 such links and their judges read all of them; five were wrong
([bug 0335](./0335-the-binding-resolver-asks-the-checker-once-per-identifier.md)'s ts-archunit plan 0076, [bug 0268](./0268-doctor-gives-a-clean-bill-to-a-builder-that-enforces-nothing.md)'s ts-archunit plan 0069, [ADR-013](../../adr/013-the-kernel-takes-the-fact-not-the-project.md)'s ts-archunit ADR-008
rule 2, and [proposal 007](../proposals/007-ts-expose-terminalbuilder-declared-state.md)'s and [proposal 010](../proposals/010-ts-performance-at-scale.md)'s ts-archunit ADR-008), each a ts-archunit number copied from a code comment. The corpus already held **423**
such links before the migration (at 65c24273, outside [plan 0542](../plans/0542-this-repositorys-record-mentions-are-migrated.md)'s eight left-out files: 89 to ADRs,
150 to plans, 149 to proposals, 19 to bugs, 16 to spikes, in 131 files). No judge has read them.

## Fix

Not chosen; the read is the first step. The same judge [plan 0542](../plans/0542-this-repositorys-record-mentions-are-migrated.md)'s lanes use (a different model,
the passage checked against the linked record and against any code comment it quotes, a reason that
quotes the passage) over the 423, each wrong one reworded in the ts-archunit form. Whether a lasting
check is worth having (for example, a link to a colliding number beside a phrase a code comment
attributes to ts-archunit's record) is for after the read shows the rate.

## Verification

- [ ] The 423 read, each verdict with a reason quoting the passage; every wrong link reworded.
- [ ] The rate recorded, and a decision on a lasting check taken from it.
