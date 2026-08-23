# Bug 0220: `check:docs-code` compiles the fences that exist and requires none

## Status

- **State:** Draft — measured 2026-08-23; fix not built.
- **Priority:** Medium — no live incorrectness, but it is the gate-shaped half of a defect
  this repo has now hit twice, and the second time it went ten days unnoticed.
- **Origin:** self-found — closing [bug 0219](./fixed/0219-corpus-listing-surface-is-undocumented.md),
  which documented three symbols that had shipped undocumented since they were written.
  0219's own ledger asked what stops that recurring. Nothing does.

## Symptom

`check:docs-code` compiles every import-bearing TypeScript fence in `docs/` and the package
READMEs — 51 of them, and it is a genuinely good gate: the fence in 0219's fix
dereferences four properties of `GherkinScenario`, so `tsc` would have failed it had any
been wrong about the shipped type.

**It requires no fence to exist.** Deleting a documented section is silent. Adding a public
export with no documentation is silent. The gate proves that what is written is _true_,
never that anything is _written_.

Measured 2026-08-23, over named exports in each dialect's `src/index.ts` against every file
in `docs/` and `packages/*/README.md`:

| package        | exported | appear in no doc or README |
| -------------- | -------- | -------------------------- |
| `eess` (core)  | 156      | 102                        |
| `eess-ts`      | 395      | 108                        |
| `eess-md`      | 58       | 34                         |
| `eess-mermaid` | 75       | 41                         |
| `eess-gherkin` | 12       | 5                          |
| **total**      | **696**  | **290 (42%)**              |

**Read that number as a ceiling, not a count.** The instrument is a word-boundary grep for
the exported name, so it cannot tell a documented concept from an incidental mention, and it
counts every exported type — including ones that only ever appear inside a signature and may
not want standalone prose. What it does establish is the shape: two of every five public
names appear nowhere a reader would look, and **nothing anywhere reports that.**

## Repro

Delete the "What did the corpus actually load?" section from `packages/md/README.md` — the
one [bug 0219](./fixed/0219-corpus-listing-surface-is-undocumented.md) just added — and run
`npm run validate`. It is green. The gate that "covers documentation" cannot see the
deletion, because it only ever visits fences that are present.

## Root cause

`scripts/check-docs-code.mjs` iterates fences found in the corpus. Its denominator is
therefore _supply_, not _demand_: it answers "is every fence correct?" and the question
nobody asks is "does every public symbol have one?". That is the exact asymmetry
[ADR-009](../../adr/009-agent-first-failure-surfaces.md) is about — a check whose green is
constructed from what happens to be there.

It is also the second instance of one pattern in one week. 0219 was the first: proposal
004's `Docs-only` ruling named documentation as the whole remedy, and ten days later none
of it existed with every gate green.

## Fix — the decision this needs first

Not obvious, and it is the reason this is a bug record and not a patch:

1. **Require a fence per exported symbol.** Honest and unambiguous, and would red on 290
   symbols on day one. Needs an explicit, committed allowlist to be adoptable — which is a
   suppression registry, with everything that implies.
2. **Require it per _entry point_** — every `export` an `index.ts` names in its public
   surface section, rather than every symbol. Much smaller denominator, and it matches how
   the docs are actually organised.
3. **Ratchet.** Record today's 290 as a baseline and fail only on an increase. Cheap, and
   the shape `check:baseline` already uses — but it accepts the current state as correct,
   which for 42% is a large thing to accept silently.

The denominator question decides the answer and it is reserved for the author. What is
**not** open: whichever ships must print its own denominator, because a doc-coverage rule
that examines nothing is the same defect one level up.

## Verification

- [ ] Red first: deleting a documented section reds, naming the symbol that lost its fence.
- [ ] A committed violating fixture, so an emptied implementation cannot stay green.
- [ ] The gate prints symbols examined and symbols covered — a zero or an unexpectedly low
      denominator is the failure to watch.
