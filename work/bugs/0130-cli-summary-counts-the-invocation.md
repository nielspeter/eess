# Bug 0130: the shipped `eess-ts check` summary counts the command line, not the work — under a comment claiming it proves non-vacuity

## Status

- **State:** Draft — read from the source and confirmed against a live run. No red
  test yet.
- **Severity:** Medium — an honesty gap between a stated claim and its actual
  mechanism, which is `BUGS.md`'s Medium row. Filed knowing the argument for High:
  its consequence lands on an **adopter's first run**, and it is the reporting half
  of [0127](./fixed/0127-nonvacuity-proves-a-condition-not-a-wired-rule.md). It is Medium
  because nothing here passes over drift that is present — the rules genuinely find
  nothing because they examine nothing, and it is the summary that misrepresents
  that.
- **Origin:** self-found · customer persona, six-persona review of 0127/0128
- **Reported:** 2026-08-12

## Symptom

`packages/ts/src/cli/commands/check.ts:60`:

```ts
// Report the denominator so a fast green is provably non-vacuous, not silence.
```

Four lines later, `:65`:

```ts
const rules = builders.length
const files = args.ruleFiles.length
const scope = `${rules} rule${rules === 1 ? '' : 's'} across ${files} file${files === 1 ? '' : 's'}`
```

Both numbers come from the **invocation**: how many builders the rule file
constructed, and how many paths were passed on the command line. Neither reflects
anything examined. `✓ eess-ts — 25 rules across 2 files · 0 failing` is identical
whether those 25 rules examined 924 elements or zero.

The comment is the defect's own strongest evidence: it states the property the code
does not have, at the site.

## Reproduction

Any rule file whose selector matches nothing:

```bash
# 0127's reproduction A — six rules narrowed to zero elements
npm run check:arch    # ✓ eess-ts — 25 rules across 2 files · 0 failing
```

The line is unchanged from the healthy run but for elapsed time.

## Root cause

`builders.length` is the right denominator for a different question — _did my rule
file load and construct rules?_ — and it does answer that honestly. The claim the
comment makes needs a count from the examining seam, which the kernel does not carry
(`packages/core/src/terminal-builder.ts:159` returns `ArchViolation[]`, with nowhere
to put it) — that is 0127's fix (2), deferred to
[0088](../plans/0088-fold-ts-archunit-into-eess.md) Phase 3/4.

## Why it matters

This is not a property of this repo's dogfood harness. It is in the published
`eess-ts` CLI, so **every adopter gets it**, and it is worst exactly where the
adopter is least equipped to notice.

`eess-ts init` scaffolds a rule file against a guessed layout. A project whose
sources live under `lib/` while the scaffold globs `src/**` runs `eess-ts check`,
reads `✓ eess-ts — N rules across 1 file · 0 failing`, and concludes the tool works.
That is the five-minute path, with no experienced reader on it, and the summary line
is the only feedback it gives.

CLAUDE.md instructs agents to treat this line as the non-vacuity signal — _"If a
count reads zero or far lower than expected, the gate matched nothing"_ — and the
count it names cannot move for that reason.

## Fix

Two, and the first does not wait on the kernel:

1. **Stop claiming what the number is not.** Either correct the comment and the
   summary wording to say what it counts (rules constructed, rule files read), or
   add the one denominator that is available today without a seam change: the number
   of **source files the project loaded**. That is knowable at the CLI layer, it
   moves when a tsconfig loads nothing, and it closes the empty-project case — the
   most likely shape of an adopter's first bad run. Not sufficient (a rule whose own
   glob narrows to zero over a loaded project still reads healthy), and the wording
   must not over-claim a second time.
2. **The real denominator** — examined units at the seam — with the summary
   reporting it. → 0088 Phase 3/4.

Do (1) now regardless of (2)'s schedule: a false claim in a comment costs nothing to
remove, and it is currently the thing telling the next reader the problem is solved.

## Verification

- [ ] Red test written first: a rule file whose selector matches nothing produces a
      summary distinguishable from the healthy run. Identical today but for timing.
- [ ] The comment at `packages/ts/src/cli/commands/check.ts:60` states the property
      the code has.
- [ ] The `--format json` / `github` paths stay machine-clean (the comment's second
      line is correct and must survive).
- [ ] A changeset naming `@nielspeter/eess-ts` — the terminal output is consumer-
      visible surface.
- [ ] `npm run validate` green.

Deferred:

- **The examined-unit denominator** → [0088](../plans/0088-fold-ts-archunit-into-eess.md)
  Phase 3/4, which owns the seam. This record closes on the honesty of the claim,
  not on the measurement it aspires to.
