# Bug 0204: `check` printed a green tick over a rule file that enforced nothing

## Status

- **State:** Fixed — `check` now reports a rule file that contributed zero rules,
  matching what `doctor` already did.
- **Deferred:** none
- **Found:** 2026-08-21, adopter-persona review of PR #74, walking the
  `@nielspeter/ts-archunit` → `eess-ts` migration from packed tarballs.

## Symptom

`eess-ts check` on a rule file that loaded cleanly and produced **no rules**:

```
✓ eess-ts — 0 rules across 1 file · 0 failing (1.15s)     exit 0
```

Every rule gone, green tick, nothing on stderr, exit 0.

`eess-ts doctor` on the _same file_ already refused it:

```
Error: no rules found in the given files.                 exit 1
```

Two commands in one CLI disagreeing about whether "no rules" is an error — and the
one wired into CI was the one blessing it.

`CLAUDE.md` tells agents, in this repo's own words, that a zero denominator "means
the gate matched little or nothing — treat that as a red flag". `check` was
printing `✓` over its own alarm value.

## The shape that makes it urgent

`@nielspeter/ts-archunit`'s `recommended()` returned builders unconditionally — it
has no `report` option at all. `eess-ts`'s runs and throws by default. So the exact
line **ts-archunit's own `init` scaffolded**:

```ts
export default [...recommended(p)]
```

spreads the preset's _result_ rather than its builders. What happens then depends
on the codebase, and the two outcomes have opposite signs:

| the adopter's codebase | result                                                                          |
| ---------------------- | ------------------------------------------------------------------------------- |
| has violations         | the loader rejects a non-builder entry — exit 1, loud                           |
| **is clean**           | the result is an **empty array**, so the file exports `[]` — **exit 0, silent** |

**The adopter this hit is the one who did the baseline work and cleaned up.** The
one carrying debt at least got a red.

`tsc --noEmit` catches neither: a spread of the wrong array type is not a type
error.

## Why it survived

`packages/ts/src/cli/commands/init.ts` documents this failure mode at length and
`init-scaffold-loads-rules.test.ts` guards the _scaffold_ against it. Nothing
guarded a **hand-written or migrated** rule file, and
[bug 0198](../0198-no-migration-path-from-ts-archunit.md)'s migration measurement
was taken on a project **with** violations, so it recorded the loud branch and
generalised from it.

`export default []` was equally unguarded, and this repo's own
`config-cjs-project.test.ts` fixture relied on it being green.

## Fix

`ruleFileContributedNoRules()` in `packages/ts/src/cli/rule-file-findings.ts`,
pushed by `runCheck` when a rule file loads without error and yields zero builders.
It names the likely cause (a preset spread without `report: 'builders'`) and the
remedy, and says to delete the file if it is deliberately empty.

**This is a breaking change** and is declared as one: a build that was green can now
be red. That is the point — it was green over a gate that checked nothing.

## Verification

- [x] Red test first — `packages/ts/tests/cli/rule-file-contributes-no-rules.test.ts`,
      `it('fails instead of printing a green tick over zero rules')`, over a fixture
      that is the naive migration on a clean codebase. Verified red:
      `expected '✓ eess-ts — 0 rules across 1 file …' to contain 'contributed no rules'`.
- [x] **The discriminator**: `it('stays green when the file does contribute rules
  and they all pass')` applies the stated remedy to the same project and
      requires a non-zero rule count. A fix that failed every zero-violation run
      would pass the first test and fail this one.
- [x] The producer is classified in `every-config-finding-is-classified.test.ts`
      as `behavioural`, since the second test applies the remedy and asserts it
      clears.
- [x] This repo's own `config-cjs-project.test.ts` fixture depended on
      `export default []` being green. It now carries one real rule — its property
      under test (an ESM-syntax config loading in a CJS project) is unchanged.
- [x] `npm run validate` exits 0 — 3551 tests.
