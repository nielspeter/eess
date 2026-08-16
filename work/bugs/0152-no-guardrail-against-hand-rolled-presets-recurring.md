# Bug 0152: nothing stops a future dialect preset from repeating bug 0131's exact pattern — a shipped rule hand-iterating its corpus instead of going through `RuleBuilder`

## Status

- **State:** Draft — surfaced by bug 0131's own round-2 review (enforcement
  persona, both rounds). No red test yet.
- **Severity:** Medium — bug 0131 itself was found by manual persona review,
  not a mechanism; this repo's own thesis ("a check that cannot fail is worth
  less than no check") applies to itself here — closing one instance of the
  violation without a check that would catch a recurrence is an incomplete
  close relative to that standard.
- **Origin:** self-found · six-persona `/review`, both rounds of bug 0131's fix
- **Reported:** 2026-08-16

## Symptom

Neither `arch.rules.ts` nor `arch.internal.rules.ts` constrains a shipped
preset under `packages/*/src/rules/**` (or the ts dialect's `presets/**`) to
be expressed through its dialect's `RuleBuilder`-derived builders rather than
iterating `corpus.documents()` (or the ts dialect's project-level equivalent)
directly. The next preset author in any sibling dialect can reintroduce
exactly bug 0131's anti-pattern and nothing in `npm run validate` will object
— it would need another manual review to be caught, the same way this one was.

## Reproduction

```bash
rg -n 'RuleBuilder' arch.rules.ts arch.internal.rules.ts   # no constraint on rules/ or presets/ shape
```

## Root cause

Bug 0131's fix (see
[work/bugs/fixed/0131-...](./fixed/0131-honesty-at-close-bypasses-the-builder-dsl.md))
closed the one known instance. It named this gap in its own Fix section (option
1 of bug 0131's original two: "record the departure... give it a compensating
check") but that option was never taken for the _general_ pattern, only for
the one file.

## Fix

Author a rule in `arch.rules.ts` (or `arch.internal.rules.ts`, depending on
which corpus this repo's own dialect-source rules already scan) asserting that
no file under `packages/*/src/rules/**` (md) or `packages/ts/src/presets/**`
(ts) — the two known "shipped preset" shapes in this family — calls a raw
corpus/project iteration method (`corpus.documents()`, or the ts-dialect
equivalent) without also constructing at least one `RuleBuilder`-derived
builder. Survey first whether this is expressible as a static AST check (an
eess-ts rule over this repo's own source) or needs a different mechanism —
bug 0131's own Fix section named this as option 2's obligation ("give it a
compensating check... at minimum, a non-vacuity fixture proving it fires").

## Verification

- [ ] Survey: is "a rules/presets file with no `RuleBuilder` construction" a
      static, false-positive-free AST check, or does it need a narrower shape?
- [ ] Red test written first: a fixture preset (hand-iterating, no builder)
      that the new rule must flag.
- [ ] `ledgerStats()` (`packages/md/src/rules/ledger.ts`) is a genuine,
      already-documented exception (pure read-only counting, not a rule) —
      confirm the new check's shape doesn't false-positive on it, or carves it
      out explicitly with a written reason.
- [ ] `npm run validate` green, including the new rule against this repo's own
      corpus (zero real violations expected today).

Deferred: none.
