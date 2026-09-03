# Bug 0234: `adr/citations-resolve` has no non-vacuity fixture, and the harness cannot notice

## Status

- **State:** Draft — measured against the harness and its own fixture; no red test
  yet.
- **Severity:** Medium — nothing is currently wrong with the rule's behaviour, so
  this is not a live false green. It is an uncovered gate: `adr/citations-resolve`
  could be emptied and `check:nonvacuity` would still print
  `no fixture is silently green`. That the rule ALSO has an open High-severity
  correctness bug ([0111](./0111-md-adr-citations-resolve-by-prefix.md)) is what
  moves this off Low — the one rule in `adrEnforcement` known to be wrong is the
  one with no fixture.
- **Origin:** self-found · surfaced while reviewing
  [proposal 008](../proposals/promoted/008-md-adr-citation-form-for-bare-identifiers.md),
  which proposes extending this rule with a pluggable citation form. **Not
  proposal 008's ask** — it needs no `**Implements:**` line.
- **Reported:** 2026-09-03

## Symptom

`adrEnforcement` ships three rule ids (`packages/md/src/rules/adr.ts:41`):

```js
const RULE_IDS = ['adr/enforcement-declared', 'adr/valid-tiers', 'adr/citations-resolve']
```

The non-vacuity harness has one row for the whole preset, and it names one of the
three (`scripts/check-nonvacuity.mjs:1290`):

```js
['corpus/adr', () => gateNode('bad-adr.mjs', 'adr/valid-tiers')],
```

The fixture states the gap in its own text — `scripts/nonvacuity/bad-adr/adr/999-bad.md:10`:

> `adr/citations-resolve` check stays green — isolating the tier failure.

That isolation is deliberate and correct _for proving tiers_. What is missing is a
second fixture proving citations.

## Root cause

`gateCoverage()` enumerates **`check:*` scripts**, not rule ids. `check:corpus` has
a row, so the script is "accounted for", and nothing asks whether every rule the
script can emit has a fixture.

This is the one-row-per-multi-check-script trap that `GATE_FOR`'s own comment
already documents, and which `check:integrity` was fixed for — its four checks now
get four rows, with the comment recording exactly why:

> four checks behind one row named after harness history, so `gateCoverage()`
> counted the script as accounted for while any check inside it could be deleted
> silently.

`check:corpus` follows the one-row-per-check doctrine for its 24 corpus rules, so
this is not a lane-wide gap — it is `adrEnforcement`'s three ids collapsed to one
row, with two of the three uncovered.

## Break class

A fix must fail when:

1. `adr/citations-resolve` stops firing — an ADR citing a file that does not exist,
   or an `it('…')` title that no cited test defines, is accepted.
2. And the existing tier fixture must keep proving tiers alone: the new fixture
   must not make `bad-adr.mjs` red for a reason that would mask a deleted tier
   check. Assert the **rule id**, not merely a non-zero exit — the discipline
   `bad-adr.mjs` already applies against bug 0109's class.

## Fix

Cheap, and the machinery is already there: `bad-adr.mjs` filters by `ruleId` under
`report: 'return'`. Add a fixture ADR carrying an unresolvable citation, and a
second row to the `gates` table alongside `corpus/adr`, keyed on
`adr/citations-resolve`.

Worth deciding at the same time: `adr/enforcement-declared` is the third id and is
also unrepresented. If the answer is one row per rule id, it wants a fixture too —
otherwise this record closes two thirds of the gap and leaves the same shape
behind.

## Sequencing

**Fix [0111](./0111-md-adr-citations-resolve-by-prefix.md) first, or alongside.**
0111 is open, High severity, and filed as a false green against this very rule —
the resolution regex at `adr.ts:51` has no closing delimiter, so `it('r')` resolves
against any test whose title starts with `r`, and `IT_CITE_RE` at `:44` truncates
at any quote and is blind to backticks. A fixture written before that fix would be
written against the broken matcher and would then need rewriting; a fixture written
after it can pin the corrected behaviour. Doing 0111 first also gives this record
its red test for free.

## Verification

- [ ] Red test: `adr/citations-resolve` emptied, and the new fixture reds naming
      that rule id.
- [ ] The tier fixture still proves tiers alone — deleting the tier check reds
      `corpus/adr` and not the new row.
- [ ] `check:nonvacuity` green with both rows.
- [ ] Decide whether `adr/enforcement-declared` gets a row too, and record the
      decision either way.

## Related

- [0111](./0111-md-adr-citations-resolve-by-prefix.md) — the correctness bug in the
  rule this record leaves uncovered. Sequence it first.
- [proposal 008](../proposals/promoted/008-md-adr-citation-form-for-bare-identifiers.md) —
  ruled `Docs-only`; its review names this gap and 0111 as outranking the ask.
- [0110](./fixed/0110-nonvacuity-gates-do-not-assert-which-rule-fired.md) — assert
  which rule fired, not that something did. The discipline the new fixture must
  follow.
