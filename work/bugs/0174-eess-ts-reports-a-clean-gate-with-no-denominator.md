# Bug 0174: eess-ts reports a clean gate with no denominator

## Status

- **State:** Draft — reproduced and measured; fix not built.
- **Found:** 2026-08-20, enforcement review of the `fold-audit-0154-0160` branch
  (finding M4). The reviewer's stated cause was wrong — it concluded no emitter
  existed anywhere — which is why this record leads with the measurement.
- **Severity:** the repo's central instruction about vacuity points at a line
  that two of the three gates it names never print.

## Symptom

`CLAUDE.md` tells every agent working in this repo:

> `check:arch` / `check:spec` → `✓ eess-ts — N rules across M files · 0 failing
(Xs)`; `check:diagram` → the same for `eess-mermaid`.
>
> If a count reads zero or far lower than expected, the gate matched nothing —
> treat that as a red flag (a vacuous rule or wrong glob), not a pass.

Measured at `4a0e26c`, a clean `npm run check:arch`:

```
stdout: 0 bytes
stderr: only the `[eess] 21 findings suppressed by inline // eess-exclude` notice
exit:   0
```

No summary. Same for `check:spec` and `check:family`. `check:diagram` does print
one, because the emitter exists in exactly one place —
`packages/mermaid/src/cli/commands/check.ts:41` — and was never ported to
`eess-ts`'s CLI.

So the two gates that carry this repo's architecture and spec enforcement
announce "zero findings" as a **bare exit code**, and the documented way to tell a
real green from a vacuous one is unavailable precisely where it matters most.

## Repro

```bash
npm run check:arch 2>/dev/null   # stdout is empty
npm run check:arch 2>&1 >/dev/null | grep '✓'   # no match
npm run check:diagram 2>&1 >/dev/null | grep '✓'
# ✓ eess-mermaid — 1 rule across 1 file · 0 failing (246ms)
```

## Root cause

`packages/ts/src/cli/commands/check.ts`'s `runCheck` returns the error count
directly after `writeReport` and the two footnote notices. There is no summary
branch. `packages/mermaid/src/cli/commands/check.ts:39-52` has one, added with
the sibling dialect and never mirrored.

## The part that is NOT just a missing port

Porting the mermaid line verbatim would make `CLAUDE.md`'s _sentence_ true and its
_instruction_ still false. Mermaid's denominator is `builders.length` rule objects
across `args.ruleFiles.length` files — neither number moves when a glob goes dead.
A rule whose selector matches nothing still counts as one rule. So:

> "If a count reads zero or far lower than expected, the gate matched nothing"

cannot be acted on with a rule count. The number that answers vacuity is
`examined` — the ADR-010 evidence quantity the floor already reads. It is not
reachable from the CLI today: `RuleBuilderLike` (`packages/core/src/rule-builder-like.ts:9`)
declares only `violations()`, deliberately, so presets can satisfy it without
depending on CLI types.

That makes this a design question, not a copy-paste, and it is why the fix is not
built here:

- widen `RuleBuilderLike` with an optional `examinedUnits?: () => number` (the
  duck-typed shape `core/diagnose.ts:62` already uses), or
- have the CLI count source files in the loaded project, which is honest about
  corpus size but says nothing about what any rule selected, or
- decide the rule/file count is the intended signal and correct `CLAUDE.md`'s
  instruction to match what it can actually detect.

Whichever is chosen applies to `eess-mermaid` too — its existing line has the
same blind spot.

## Fix

Not built. `CLAUDE.md` has been corrected in the meantime to describe what the
gates actually print, so nothing false ships while this is open.

## Verification

- [ ] `check:arch`, `check:spec` and `check:family` print a success summary.
- [ ] The denominator responds to a dead glob — sabotage a selector to match
      nothing and the number drops. (This is the row that makes it a
      non-vacuity signal rather than a decoration; without it, close this as
      `won't-do` and keep the corrected `CLAUDE.md` instead.)
- [ ] `--format json` / `github` on stdout stays machine-clean; the summary is
      stderr, terminal-only.
- [ ] `CLAUDE.md` restored to describing the real behaviour.
