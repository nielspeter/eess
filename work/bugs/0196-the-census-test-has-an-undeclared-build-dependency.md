# Bug 0196: the primitive census test has an undeclared build dependency

## Status

- **State:** Draft — reproduced on demand; the mechanism is now measured rather
  than inferred.
- **Deferred:** none
- **Found:** 2026-08-21, enforcement + testing review of PR #73. Both reviewers
  hit it independently, from separate worktrees, while measuring margin.

## Symptom

`packages/ts/tests/tools/scan-enforceable-primitives.test.ts:144` reads
`../core/dist/define.d.ts` — a **build artifact**. The test therefore has an
undeclared dependency on `npm run build` having run, and on it not being
mid-rebuild.

With that file absent or stale, exactly three tests fail:

```
× includes a primitive from each kind, each folder, and each entry-point shape
× no FILE has left the population
× the meta-primitives are exactly the recorded five
```

## Repro

```bash
mv packages/core/dist/define.d.ts packages/core/dist/define.d.ts.aside
npx vitest run packages/ts/tests/tools/scan-enforceable-primitives.test.ts
#   Tests  3 failed | 8 passed (11)
mv packages/core/dist/define.d.ts.aside packages/core/dist/define.d.ts
```

## Why this is load-bearing twice over

**1. It already corrupted a measurement in this corpus.**
[Bug 0186](./fixed/0186-two-security-rules-cannot-fail.md) records four margins
that were each inflated by exactly one, and names this fragility as the _likely_
cause — "the mechanism is inference." It is not inference any more: the repro
above yields three extra failures on a clean, unmutated tree, and any margin
measured by diffing a mutated run against a baseline taken under a different
build state absorbs them.

**2. [Plan 0193](../plans/0193-measure-the-margin.md) makes this census the
population that `check:margin` measures.** A gate whose scope comes from a test
that reds on a stale build inherits the flake, and margin's failure direction is
the dangerous one: noise ADDS failing files, so it lifts a genuine margin **0** —
the gate's only red state — to **1**, silently clearing it.

ADR-009 states both halves of the countermeasure and 0193 currently ports one:

> Assert a green baseline before the first patch, **and hold the tree
> exclusively** (an isolated git worktree, or nobody else running).
> — `adr/009-agent-first-failure-surfaces.md:247-253`

## Fix

Not decided. Three candidates, in increasing order of cost:

1. **Declare the dependency** — the test asserts a fresh `packages/core/dist`
   and fails with a message saying `npm run build` first, rather than failing
   three assertions that look like a population drift.
2. **Read the source, not the artifact** — `packages/core/src/define.ts` instead
   of `dist/define.d.ts`, if the test only needs the declared shape.
3. **Make the census not need it** — if `define.d.ts` is being read to enumerate
   kernel meta-primitives, derive them the same way the rest of the census does.

Candidate 2 is likely right but not verified; whoever fixes it should check what
the `.d.ts` gives that the `.ts` does not.

## Verification

- [ ] Red test first: the repro above fails today, and fails with a message that
      names the missing build rather than three unrelated-looking assertions.
- [ ] With the fix, the census test passes with `packages/core/dist` absent, or
      fails with one clear message.
- [ ] `npm run validate` exits 0 from a clean checkout with no prior build.
