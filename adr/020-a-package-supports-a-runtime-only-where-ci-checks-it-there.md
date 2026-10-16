# ADR-020: A package supports a runtime only where CI checks it there

- **Status:** Proposed 2026-10-16. The owner asked for Bun support, scoped to what CI can test, after
  an adopter monorepo on Bun could not load eess-md
  ([bug 0439](../work/bugs/0439-the-family-fails-to-load-under-bun-from-eess-0-5-1.md)).
- **Amends** the runtime half of [ADR-001](./001-toolchain-node-vitest-eslint-prettier.md)'s "No Bun
  (runtime or test runner)". ADR-001 stands for this repository's toolchain (Node, npm, vitest on
  Node), and [ADR-004](./004-esm-only-package.md) stands: every package runs on Node 24 or later.
- **Context:** [spike 0438](../work/spikes/0438-what-the-family-does-under-bun.md).

## The question

ADR-001 rejected Bun for ts-archunit: its engine drives the TypeScript compiler, and its users ran
it inside Node test suites. eess is now six packages, and most of them neither drive the compiler
nor run only in a test suite. Spike 0438 measured the family under Bun 1.4.3: one import stops 22 of
the 28 published entry points, and with it fixed, every real call it tried gave the same counts as
under Node. So Bun support looks cheap. The question is what "supports Bun" may mean, so that the
claim cannot be true on the page and false in an adopter's build.

The spike also measured why that is not a hypothetical. eess-md's test suite passed 300 of 300 on
the Bun runtime, on the very build whose `@nielspeter/eess-md` entry fails to load under Bun:
vitest's module runner links what Bun itself refuses. A claim backed by a suite run alone would have
certified the defect that started this.

## Decision

**A package supports a runtime other than Node only where CI checks it on that runtime, with a check
that fails the build when the package breaks there.** Precisely:

1. **Node is every package's runtime.** ADR-004 is unchanged. Any other runtime is claimed package
   by package, never for the family as a whole.
2. **The check has two parts, and both run in CI on that runtime:**
   - **Load.** Every entry in the package's `exports`, the list read from its `package.json` and
     never typed in, is imported in its own process by the runtime's own loader, not a test runner.
     An entry that runs a command when imported (`@nielspeter/eess-ts/cli`) passes when its error
     is the command's own, not a link or resolution error.
   - **Suite.** The package's own test suite runs on that runtime and fails the build on a failure.
     A suite alone is not the check: it does not prove the package loads (spike 0438).
3. **A test that asserts one runtime's mechanism says so.** It is skipped on the other runtime only
   through one named helper that states the runtime and the reason, never a bare skip, and the
   number skipped that way per package is printed beside the suite's result. A Node resolve hook, or
   Node's strip-only TypeScript refusing an `enum`, is a Node mechanism; a wrong answer under one
   runtime is a defect, not a mechanism.
4. **The claim is written in one place.** The README's Packages table carries each package's
   runtimes. A runtime listed there without the CI check above is a finding, and so is a check
   with no listing.
5. **Which packages claim Bun, and when, is the plan's call**, from what the check measures. This
   ADR rules what a claim requires, not which claims are made.

## Why this, and not the alternatives

- **Declaring Bun for the family** (an `engines` entry, a README line) is the cheapest, and it is a
  check that cannot fail: nothing would go red when eess-ts broke under Bun. ADR-009 calls that worth
  less than no check.
- **A suite run on Bun as the check** is what a reader would assume is enough, and spike 0438
  measured that it is not: it was green on a build that does not load.
- **Refusing Bun** keeps ADR-001, and leaves an adopter's measured failure in place for a defect the
  spike showed is one import.

## Consequences

- A second runtime in CI: a load job and a suite job for each package that claims it. The cost is
  the plan's to measure.
- Tests that assert a Node mechanism are marked through the helper, in every package that claims
  Bun.
- The README's Packages table gains a column, bound by `check:spec` like its Status column.
- eess-ts's watch mode under Bun ([bug 0440](../work/bugs/0440-eess-ts-watch-mode-reads-a-stale-sibling-under-bun.md))
  is a defect under rule 3, not a mechanism: eess-ts cannot claim Bun while it stands, unless the
  plan narrows the claim to exclude `--watch` and says so in the same place.
- Out of scope: Deno, Bun's own test runner, Windows.

## Enforcement

| Clause                                                                                               | Tier | Mechanism                                                                                           | Status  |
| ---------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------- | ------- |
| **R1** — Node is every package's runtime                                                             | 1    | the engines field of each package manifest names node >=24 (ADR-004)                                | manual  |
| **R2** — a claimed runtime has a load check over every published entry, derived from `exports`       | 3    | a CI job per claimed runtime, built by the plan                                                     | pending |
| **R2** — a claimed runtime has a suite run that fails the build                                      | 3    | a CI job per claimed runtime, built by the plan                                                     | pending |
| **R3** — a runtime-mechanism test is skipped only through the named helper, and the count is printed | 1    | an arch rule over test files forbidding a bare runtime skip, built by the plan                      | pending |
| **R4** — the README's runtimes and the CI checks agree                                               | 1    | a `spec.rules.ts` binding of the Packages table's runtimes column to the CI jobs, built by the plan | pending |
| **R5** — which packages claim Bun is the plan's                                                      | 5    | governance                                                                                          | n/a     |
