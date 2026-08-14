# Bug 0133: a `check:*` script need never join the `validate` chain — three authored lists, two joins asserted

## Status

- **State:** Draft — measured against the two instruments that exist. No red test yet.
- **Severity:** Medium — the set is clean today (the only `check:*` outside the
  chain is `check:fast`, a subset chain of gates each gated on its own), so nothing
  is currently unrun. It is the missing third join, and its absence is exactly how
  [0129](./fixed/0129-four-validate-gates-run-in-no-workflow.md) happened one list
  over.
- **Origin:** self-found · architect and product personas, third review round on
  0129's fix
- **Reported:** 2026-08-13

## Symptom

Three authored lists describe the same gates, and only two of the three joins are
asserted:

| join                                           | asserted by                                                                  |
| ---------------------------------------------- | ---------------------------------------------------------------------------- |
| `check:*` keys → a gate row or a stated waiver | `gateCoverage()` in `scripts/check-nonvacuity.mjs`                           |
| `validate` chain → a merge-blocking workflow   | nothing yet — [0132](./0132-the-chain-and-the-workflow-need-a-derivation.md) |
| **`check:*` keys → the `validate` chain**      | **nothing**                                                                  |

A new `check:foo` added to `package.json` with a `no-gate-yet` waiver in
`NO_GATE_NEEDED` — three such waivers exist today — and never added to `validate`
is green in every instrument and runs nowhere.

## Reproduction

```bash
node -e "const p=require('./package.json');
  const chain=p.scripts.validate.match(/check:[a-z:-]+/g);
  const all=Object.keys(p.scripts).filter(k=>k.startsWith('check:'));
  console.log('check:* not in validate →', all.filter(c=>!chain.includes(c)))"
# → [ 'check:fast' ]
```

`check:fast` is the legitimate exception and the reason the guard needs a waiver
rather than a bare subset assertion.

## Root cause

`gateCoverage()` asks whether each `check:*` has a **fixture**. Nothing asks whether
it has a **home in the chain**. Those are different questions about the same script,
and the second was never posed.

## Fix

One assertion in `gateCoverage()`: every `check:*` appears in the `validate` chain,
or is waived **by a waiver that says so**.

The waiver is the part with a trap in it, and it was found in review rather than in
the first draft of this record. `NO_GATE_NEEDED` is a statement about fixtures —
`check:integrity`, `check:examples` and `check:docs-code` are waived there as
`no-gate-yet`, meaning "no violating fixture written". Reusing that map for chain
membership would exempt those three from the chain too, which is the symptom this
record is about. A second, separate waiver is needed, with `check:fast` in it and a
reason: _an alias-shaped subset chain whose members are each in `validate` on their
own._

Note `check:fast` is a subset chain (`check:release && check:corpus && check:spec &&
check:arch`), not an alias. The waiver's reason should say the true thing.

## Verification

- [ ] Red test written first: a `check:*` present in `package.json`, waived for
      fixtures, and absent from `validate` fails `check:nonvacuity`. Green today.
- [ ] The chain-membership waiver is its own map, not `NO_GATE_NEEDED` — reusing the
      fixture waiver reintroduces the hole.
- [ ] The control asserts **which** failure fired, not merely that one did
      ([0127](./fixed/0127-nonvacuity-proves-a-condition-not-a-wired-rule.md)'s lesson,
      and the one 0129's two failed attempts kept missing).
- [ ] `check:fast`'s waiver reason describes a subset chain, not an alias.
- [ ] `npm run validate` green.

Deferred: none.
