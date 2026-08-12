---
'@nielspeter/eess': patch
---

Violations now state what is wrong, and two-sided rules carry their own metadata
(bugs 0122, 0113).

**Two visible changes. No violation appears or disappears, and your baseline
file keeps matching** — violation identity is `rule::element::message`, and none
of those change.

**1. The terminal report gains a `What:` line, for every rule.** The formatter
never printed `message`. For a one-sided rule that was survivable: the element,
the rule description and the code frame usually carry the meaning. For a
two-sided rule `message` is the only place the finding lives, so a
`correspondence()` failure rendered like this:

```
  Rule: correspondence
  CLAUDE.md:24 — 099
  Why: the ADR index is a spec: every ADR is listed, every listing is real
```

— a name and a rationale, and no statement of which side drifted. It now reads:

```
  What: CLAUDE.md ADR index row "099" has no matching ADR file
```

The whole message is rendered, not just its first line, so a `correspondence()`
per-side `suggest` remedy — which is appended as a continuation — becomes visible
too. It was being written and silently dropped.

**2. `correspondence()` and `tsconfig()` violations carry `ruleId`, `because`,
`suggestion` and `docs`.** These builders construct violations directly and had
no path for the rule's own metadata. Concretely, `.rule({ suggestion })` on a
two-sided rule type-checked, ran, and could never render a `Fix:` line:

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

The rationale was the sharper loss on the `.violations()` route — ADR-008's
caller-owns-reporting path — where it was lost in every format. `--format json`
returned `"because": null` there; it no longer does. On the `.check()` path the
default terminal format is unchanged for `because` (it already fell back to the
rule's reason); `--format json` and `--format github` gain it on both routes.

One-sided rules built with `RuleBuilder` were never affected — they thread this
through the condition context, and are unchanged.

**Choosing between the two remedy routes.** A rule-level `suggestion` is stamped
onto every violation, including all three branches a `correspondence()` can emit
— so on a `direction: 'both'` rule, one remedy is shown for "this row has no
file" _and_ for "this file has no row", where the correct advice is opposite.
Prefer the per-side `suggest` callbacks when the remedy differs by cause; they
render now. Reserve `.rule({ suggestion })` for a remedy that is true of every
way the rule can fail.

A value a condition computed for a specific violation is never replaced by the
rule's — `tsconfig()`'s per-key remedy and any per-element `suggestion` survive.
