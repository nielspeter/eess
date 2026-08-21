# Bug 0200: a failing rule file reports "1 of 0 rules failing"

## Status

- **State:** Draft — one-line reproduction.
- **Deferred:** none
- **Found:** 2026-08-21, while measuring bug 0198.

## Symptom

When a rule file throws during evaluation, the summary line reads:

```
✗ eess-ts — 0 rules across 1 file · 1 of 0 rules failing · 1 violation (156ms)
```

**"1 of 0 rules failing" is arithmetically impossible.** The denominator is the
count of successfully-constructed rules, which is legitimately 0 when the file
threw before returning any — but the numerator counts the rule-file finding
itself, which is not one of them.

## Why it matters here more than it looks

This repo's own `CLAUDE.md` instructs agents to read these denominators as
evidence of non-vacuity, and [bug 0174](./0174-eess-ts-reports-a-clean-gate-with-no-denominator.md)
is the record for exactly that. A denominator that can print an impossible ratio
teaches the reader to discount it — which is worse than not printing one, because
a discounted denominator is still displayed as if it were evidence.

`0 rules across 1 file` is simultaneously the honest and the alarming part: it
says nothing was constructed. That is the number a reader should act on, and it
is undercut by the impossible ratio next to it.

## Repro

Any rule file that throws during evaluation:

```ts
export default [...recommended(p)] // throws on first violation (bug 0199)
```

```
npx eess-ts check arch.rules.ts
→ ✗ eess-ts — 0 rules across 1 file · 1 of 0 rules failing · 1 violation
```

## Fix

Not decided. The rule-file finding is a different category from a rule violation
and probably should not share the ratio at all — e.g.
`✗ eess-ts — 0 rules across 1 file · rule file failed to evaluate · 1 finding`.

## Verification

- [ ] Red test first: a fixture rule file that throws must not produce a
      numerator exceeding its denominator.
- [ ] A file mixing constructed rules with a later throw reports both truthfully.
