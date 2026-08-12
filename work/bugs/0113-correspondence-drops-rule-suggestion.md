# Bug 0113: `correspondence()` silently drops `.rule({ suggestion })` — no `Fix:` line can ever render for a two-sided rule

## Status

- **State:** Draft — confirmed against the source and against a live gate run; no
  red test written yet.
- **Severity:** Medium — an honesty gap between a stated claim and its mechanism.
  The builder accepts a documented field and does nothing with it, and CLAUDE.md
  promises every violation surfaces a `Fix:` line.
- **Origin:** self-found · enforcement review of [0104](./fixed/0104-it-title-capture-stops-at-any-quote.md)
  asked why the ADR↔test violation carried no remedy; adding `suggestion`
  changed nothing, which is the bug
- **Reported:** 2026-08-12

## Symptom

`.rule({ id, because, suggestion })` on a `correspondence()` chain type-checks,
runs, and has no effect. `packages/core/src/format.ts:33` renders the `Fix:` line
from `v.suggestion`, but the correspondence path never sets it:

```ts
// packages/core/src/correspondence.ts:59
function violationFor(info: ElementInfo, message: string, ruleId?: string): ArchViolation {
  return { rule: 'correspondence', ruleId, element: info.name /* … */ }
  //                                                    ^ no suggestion, ever
}
```

`buildConditionContext()` (`packages/core/src/rule-builder.ts:372`) does put
`suggestion` in the context — the correspondence condition simply doesn't read
it.

Every other builder renders `Fix:`. Two-sided rules cannot.

## Reproduction

Add `suggestion` to `crossval/adr-citations-resolve` and run
`node scripts/nonvacuity/bad-md-ts.mjs`:

```
  docs/adr/0005-renamed.md:8 — it('catches `GONE` in a deleted test')
  Why: an ADR that cites a test must cite one that exists
```

No `Fix:` line. Remove the `suggestion` — byte-identical output.

## Root cause

`correspondence()` grew its own `suggest` option
(`packages/core/src/correspondence.ts:53-56`) with per-side callbacks that append
to the **message string**, before/instead of the rule-metadata route the rest of
the builders use. Two mechanisms for one concept; the one a caller reaches for
first is the one that does nothing.

The `suggest` route is also incomplete: `suggestLeft` is applied to the
`leftUnmatched` branch (`correspondence.ts:155`) but **not** to `leftAmbiguous`
(`:165`), so a citation matching several elements gets no guidance at all — the
case most in need of it.

## Why it matters

CLAUDE.md states the contract: _"every violation surfaces its rationale
(`.because`), a `Fix:` line (the rule's `suggestion`), and a `Docs:` link where
present, so a failing gate reads as an instruction, not just an error."_ For
correspondence rules that is not true, and a rule author gets no signal — the
field is accepted and discarded.

Every cross-validation preset in the family is a correspondence rule, so this is
the whole `eess-crossvalidate` surface.

## Fix

Carry rule metadata into the violation, as the other paths do — `suggestion` and
`docs` from the condition context onto `violationFor`. Keep `suggest` for the
per-element case, where the remedy depends on which element failed, and apply it
to the ambiguous branch too.

Where both are present, `suggest` (specific) should win over `suggestion`
(generic); document that rather than leaving it to call order.

**The ambiguous branch also mis-attributes, not just under-advises.** Its
violation points at the _left_ element (the ADR row) and says "matches multiple
tests" without naming a single one — no file, no line, for either colliding
match. An author is told there is a collision and not where. The message should
list the matching right-hand elements' `identify().file`, which the
correspondence already has in hand. Raised again during review of
[0105](./fixed/0105-md-ts-drops-modifier-forms.md), which widens the population
reaching this branch: modifier-form definitions now count toward ambiguity, so a
title existing both live and skipped lands here.

`patch` on `@nielspeter/eess`, plus a `Fix:` line appearing in any downstream
correspondence gate output — worth a note in the changeset since CI logs change.

## Verification

- [ ] Red test written first: a correspondence rule declaring `suggestion`
      renders a `Fix:` line. Fails today.
- [ ] An ambiguous match renders its `suggest.left` output.
- [ ] `--format json` carries `suggestion` for a correspondence violation.
- [ ] `npm run validate` green.

Deferred: none.
