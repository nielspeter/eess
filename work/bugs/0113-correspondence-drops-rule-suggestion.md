# Bug 0113: `correspondence()` silently drops `.rule({ suggestion })` — no `Fix:` line can ever render for a two-sided rule

## Status

- **State:** Parked — **narrowed on 2026-08-12.** Parked rather than Draft: it is
  waiting on a ruling, not on work, and the bug lane has a state for that. The headline symptom is fixed:
  [0122](./fixed/0122-violations-path-drops-because.md) stamps `suggestion`,
  `docs`, `because` and `ruleId` from the rule onto every violation in
  `applyFilters`, so a correspondence rule now renders its `Fix:` line
  (`packages/core/tests/correspondence.test.ts` · `it('carries because,
suggestion, docs and ruleId onto violations from .violations()')`). What
  remains is the **ambiguous branch**, which is a design call rather than a
  missing stamp — see _Fix_.
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

`buildConditionContext()` (`packages/core/src/rule-builder.ts:283`) does put
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

**Done, by 0122.** Rule metadata is now carried onto the violation in
`applyFilters` — one stamp for every builder, rather than a correspondence-local
patch. Precedence fell out correctly and is worth stating: `suggest` folds its
text into the **message**, `suggestion` is a separate field, so the two do not
collide and both can be present. A condition that sets its own `suggestion` is
never overwritten.

**Still open — the ambiguous branch, and it needs a decision, not a stamp.**
`suggestLeft` is applied to `leftUnmatched` (`packages/core/src/correspondence.ts`)
and not to `leftAmbiguous`. Applying the same callback is one line, but it is not
obviously right: a `suggest.left` written for the unmatched case reads as
"remove this row or restore the missing thing", which is the wrong advice when
the row matched _too many_ things. The remedy there is "disambiguate", and the
two are different enough that reusing the text would mis-advise. Either accept
that and apply it anyway, or give the ambiguous case its own `suggest.ambiguous`.
That is the call this record is now waiting on, and
[0124](./0124-correspondence-stamps-one-remedy-onto-opposite-branches.md) is the
same call arriving from the other side: its preferred fix — `correspondence()`
populating `v.suggestion` per branch — answers this record's question as a
byproduct. Decide them together.

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

- [x] Red test written first: a correspondence rule declaring `suggestion`
      renders a `Fix:` line — done in 0122, and verified red before the fix.
- [x] `--format json` carries `suggestion` for a correspondence violation.
- [ ] The ambiguous branch advises — blocked on the decision above, not on work.
- [ ] The ambiguous message names the colliding right-hand elements (file and
      line), which the correspondence already holds. Independent of the
      suggest question, and the sharper half of this record.
- [ ] `npm run validate` green.

Deferred: none.
