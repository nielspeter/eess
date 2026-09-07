# Bug 0269: `eess-mermaid check` greenlights a builder that enforces nothing

## Status

- **State:** Draft — measured against the built binary while reviewing plan
  0263 Phase 2, which closed the same class of hole in `eess-ts`.
- **Severity:** Medium — a false green at a published dialect's build gate. Not
  higher only because `eess-mermaid` has far fewer adopters than `eess-ts`; the
  shape is the one ADR-014 exists to refuse, and the family's binding ADR reads
  as though it were covered.
- **Origin:** self-found · product review of PR #118
- **Reported:** 2026-09-07

## Symptom

`@nielspeter/eess-mermaid` is one of only two dialects that publish a binary.
Its `check` command accepts a hand-rolled builder that asserts nothing and
reports a clean gate:

```ts
// m.rules.ts
export default [{ check: () => {} }]
```

```
$ eess-mermaid check m.rules.ts
✓ eess-mermaid — 1 rule across 1 file · 0 failing (51ms)
$ echo $?
0
```

A denominator is printed beside it — `1 rule across 1 file` — which is exactly
the reassurance `CLAUDE.md` warns is not evidence: the count is of rules
_declared_, not of anything _examined_.

## Root cause

The dialect's CLI loads through its own `RuleBuilderLike`, which is
`{ check(opts): void }` — a builder that throws `ArchRuleError` or returns — and
counts the errors it catches. There is no receipt in that contract, so there is
nothing for an evidence gate to read.

This is the shape `eess-ts` had before plan 0263 Phase 2, one dialect over. The
kernel work it depends on is already done and published: `CollectResult`,
`collectResult`, `mergeCollectResults` and the emitter findings are all on the
kernel root, and `finishPreset(receipt, { report: 'return' })` is the same seam
the `eess-ts` doors now use.

## Why it matters

ADR-014's enforcement row for this clause is written dialect-neutrally — "a rule
file exporting an evidence-free builder reds `check`, `check --fix`, `baseline`
and `checkAll`" — and is marked `gated`. `check` is also the name of
`eess-mermaid`'s command. A reader of the family's binding ADR has no way to
tell that the clause covers one dialect's `check` and not the other's, and
**standalone sufficiency cuts the same way**: someone who installs only
`eess-mermaid` gets a dialect where the family's headline invariant does not
hold at the door they use.

That is the half this record fixes immediately: the ADR row now names the
dialect. The door itself is the open work.

## Fix

Not decided. The obvious shape is to give `eess-mermaid`'s builders the same
`violations(): CollectResult` terminal `eess-ts` has and gate its `check`
command per rule file — but that is a dialect-wide contract change, not a CLI
patch, and it should be sized before it is promised. The cheaper interim is to
report `examined` per rule and refuse a run whose rules examined nothing in
total.

The other three dialects (`eess-md`, `eess-gherkin`, `eess-crossvalidate`) ship
no binary, so their exposure is through presets a caller finishes — a different
question, and not this record's.

## Verification

- [ ] Red test first: `eess-mermaid check` over a rule file exporting
      `{ check: () => {} }` exits non-zero and names the rule file.
- [ ] `check:nonvacuity` asserts it by rule id, so an emptied fix cannot stay
      green.
- [ ] ADR-014's clause stops reading as family-wide, or starts being true of the
      family. (The naming half landed with PR #118; this box is the other half.)

Deferred: none.

## Related

- [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) —
  the clause whose scope this record corrects.
- [Plan 0263](../plans/0263-adr-014s-residual-enforcement-rows.md) — Phase 2
  closed the identical hole in `eess-ts`; its measurements are the template.
- [0268](./0268-doctor-gives-a-clean-bill-to-a-builder-that-enforces-nothing.md)
  — the same family of false green, on `eess-ts`'s diagnostic rather than a
  sibling's gate.
- [0174](./0174-eess-ts-reports-a-clean-gate-with-no-denominator.md) — why a
  printed rule count is not evidence that anything was examined.
