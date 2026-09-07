# Bug 0271: one rule-file fact, two spellings across the dialects

## Status

- **State:** Draft — found by an architecture review of PR #119, which is the
  change that created the second spelling.
- **Severity:** Low-to-medium — no false green. It is a machine-readable
  identity that exists in one dialect and not the other for the same fact, which
  breaks the one consumer this project says it writes for: an agent parsing
  `--format json`.
- **Origin:** self-found · architecture review of PR #119 (bug 0269)
- **Reported:** 2026-09-07

## Symptom

"This rule file loaded but contributed no rules" is a dialect-neutral fact. Two
dialects now report it, and they disagree about how:

|             | `eess-ts`                                                                  | `eess-mermaid`                                                            |
| ----------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| constructor | `ruleFileContributedNoRules` (`packages/ts/src/cli/rule-file-findings.ts`) | `reportContributedNoRules` (`packages/mermaid/src/cli/commands/check.ts`) |
| `ruleId`    | **absent**                                                                 | `cli/rule-file-contributed-no-rules`                                      |
| `rule`      | `eess-ts: rule file`                                                       | `rule file: contributed no rules`                                         |

An agent keying on `ruleId` sees the finding from one dialect and not the other.
`cli/*` is also a third id namespace beside `emitter/*` and a rule's own id,
introduced without a record — this one.

The same holds for the misconfigured-rule-file finding, and PR #119 re-inlined
the attribution step (`attributeToRuleFile`'s job in `eess-ts`) rather than
sharing it.

## Root cause

Neither finding is TypeScript- or Mermaid-specific, and neither lives anywhere
shared. `packages/core/src/emitter-findings.ts` already holds dialect-neutral
findings with stable hardcoded ids for exactly this reason; these two were
written where they were first needed instead.

PR #119 is the proximate cause of the divergence, and it is worth being precise
about why: it was fixing a false green in a dialect that had no such finding at
all, and inventing one locally was the smallest change that closed the hole. The
duplication is real, and doing the extraction inside a bug fix would have been
scope creep.

## Why it matters

Two binaries today. The third dialect that publishes one gets a third spelling,
and by then the two existing ones are published API. The cost of deciding is
lowest now.

`CLAUDE.md` also promises every violation surfaces a rationale, a `Fix:` line
and a `Docs:` link where present. PR #119 brought mermaid's two findings up to
that shape; `eess-ts`'s equivalents predate it and have no `ruleId`, so the
inconsistency is now visible in both directions.

## Fix

Not decided, and the choice is real:

1. **Extract to the kernel**, beside `emitter-findings.ts` — one constructor per
   fact, one id, one text, consumed by both dialects. Matches where the family
   already puts dialect-neutral findings.
2. **Give `eess-ts`'s versions the missing `ruleId`** and align the wording,
   leaving the constructors where they are. Cheaper, and it fixes the observable
   half without moving code between packages.

Option 1 is the one that stops a third dialect inventing a third spelling.
Option 2 is a patch-level change with no cross-package movement. Whichever
lands, `cli/*` as an id namespace should be recorded in ADR-014's table rather
than left implicit.

## Verification

- [ ] Red test first: one assertion that both dialects report the same `ruleId`
      for the same fact — which fails today.
- [ ] `check:nonvacuity` asserts the id in both dialects, so an emptied
      implementation cannot stay green in either.
- [ ] The `cli/*` namespace is named wherever the emitter ids are named.

Deferred: none.

## Related

- [Bug 0269](./fixed/0269-eess-mermaids-check-door-greenlights-a-builder-that-enforces-nothing.md)
  — the change that created the second spelling, and why it did so.
- [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) —
  its clause on rule files that enforce nothing names both dialects' mechanisms.
- [0270](./0270-the-vacuity-matrix-reports-zero-fail-open-doors-while-one-is-stated-open.md)
  — the other record filed rather than absorbed while closing 0269's family.
