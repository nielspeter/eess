---
'@nielspeter/eess': patch
---

Two-sided rules now carry their own metadata onto every violation — `because`,
`suggestion`, `docs` and `ruleId` (bugs 0122, 0113).

**Expect new `Why:` and `Fix:` lines in the output of any `correspondence()`
rule.** No violation appears or disappears; the existing ones say more.

`RuleBuilder` threads rule metadata through the condition context, which is why
one-sided rules have always rendered it. `correspondence()` and the pair builders
extend `TerminalBuilder` and construct violations directly, with no equivalent
path — so they silently dropped all four:

```ts
const v = correspondence({ left, right, keyBy })
  .should()
  .beComplete({ direction: 'left-to-right' })
  .because('an index row that names no file is a spec pointing at nothing')
  .rule({ id: 'spec/index-matches-files', suggestion: 'remove the row' })
  .violations()

v[0].because // was undefined — now the rationale
v[0].suggestion // was undefined — now 'remove the row'
```

The rationale was the sharper loss. `.check()` passes it to the reporter
separately, so it rendered there; `.violations()` — the caller-owns-reporting
route of ADR-008 — lost it in every format, including `--format json`, where
`because` came back `null`. `.rule({ suggestion })` on a two-sided rule was worse
than incomplete: it type-checked, ran, and could never produce a `Fix:` line.

The four fields are properties of the rule, so they are stamped once in
`applyFilters` for every builder rather than patched per-builder. A condition
that sets its own value is never overwritten, and `correspondence()`'s per-side
`suggest` callbacks are unaffected — they fold into the message, so both routes
can be present without colliding.
