# Bug 0151: `expectEmptyHeaders` and `honestyAtClose`'s calling convention are undiscoverable past reading source, and the kernel's own zero-examined message points a caller at an API that doesn't exist for this preset

## Status

- **State:** Draft — surfaced by bug 0131's own round-2 review (two
  independent personas, product and customer, converged on the same finding).
  No red test yet.
- **Severity:** Medium — nothing is wrong in the mechanism (bug 0131 fixed
  that); this is an honesty-gap between what a caller is told to do and what
  actually works.
- **Origin:** self-found · six-persona `/review` round 2 of bug 0131's fix
- **Reported:** 2026-08-16

## Symptom

Two independent gaps, both traced to the same root:

1. `kit/README.md` names `honestyAtClose` as the mechanism behind
   `check:ledger` but documents none of its options or calling convention —
   in particular, nothing about `expectEmptyHeaders`, the option a freshly-
   bootstrapped lane (exactly what `kit/`'s own bootstrap flow produces) needs
   to avoid a false "examined zero units" failure on day one. `kit/` ships no
   reference `check-ledger.mjs` an adopter could copy either (unlike
   `next-number.mjs`, which it does ship as a template).
2. The violation an adopter actually sees when they hit this — the kernel's
   generic `zeroExaminedViolation()` message
   (`packages/core/src/terminal-builder.ts:275-289`) — says "declare it
   explicitly with `.expectEmpty()`." But `honestyAtClose(corpus, options)` is
   a plain function; a caller holding its `ArchViolation[]` return value has
   no `.expectEmpty()` to call. The real remedy, `{ expectEmptyHeaders: true }`
   in the options object, is a different name on a different surface, and is
   never named in the text that actually fires.

## Reproduction

```bash
rg -n 'expectEmptyHeaders' kit/ packages/md/README.md   # no hits
```

Build a corpus matching `kit/templates/work/plans/`'s real seed state (only
`ROADMAP.md`, no plan yet) and call `honestyAtClose` on it without options —
the emitted message never names `expectEmptyHeaders`.

## Root cause

`expectEmptyHeaders` (bug 0131) was added to close a false-positive, but its
existence was recorded only in `ledger.ts`'s own JSDoc, the changeset, and the
bug/plan records — none of which a `kit/` adopter reads before wiring their
own `check:ledger`. Separately, the kernel's `zeroExaminedViolation()` message
is generic by design (it serves every `RuleBuilder`-derived rule across every
dialect) and has no per-preset override hook for naming a dialect-specific
escape hatch.

## Fix

Two independent, additive fixes:

1. Document `expectEmptyHeaders` and `honestyAtClose`'s calling convention in
   `kit/README.md`'s "Wire the gates" section (the `check:ledger` bullet), and
   in `packages/md/README.md` (which currently doesn't mention `honestyAtClose`
   at all — a pre-existing gap this closes incidentally). Consider whether
   `kit/` should ship a reference `check-ledger.mjs` template the way it ships
   `next-number.mjs`.
2. Give `headerRule` (`packages/md/src/rules/ledger.ts`) a way to name
   `expectEmptyHeaders` in its own violation text rather than relying on the
   kernel's generic message alone — likely via `.because()`/a `suggestion`
   override on the builder, if the kernel exposes one; if not, that may itself
   be a small kernel-level ask worth its own proposal.

## Verification

- [ ] Red test written first: a fixture proving a `kit/`-shaped fresh corpus
      still false-positives with no discoverable remedy in the current docs.
- [ ] `kit/README.md` and `packages/md/README.md` document `expectEmptyHeaders`
      concretely.
- [ ] The violation text `honestyAtClose` emits on a dead `headerViolations`
      selector names `expectEmptyHeaders` by name, not just the kernel's
      generic `.expectEmpty()` advice.
- [ ] `npm run validate` green.

Deferred: none.
