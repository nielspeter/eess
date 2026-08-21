# Plan 0191: Flip the inert finding

## Status

- **State:** Draft — the flip is a one-line change; what this plan exists for is
  that eess currently has **no record that owns it at all**.
- **Priority:** Medium — nothing is broken, and the guard is deliberately off.
  What is wrong is that "deliberately off until later" lives only in a source
  comment, which is the shape of a deferral that never happens.
- **Effort:** Low — a constant, plus the one test its upstream plan explicitly
  deferred to this filing.
- **Created:** 2026-08-21

## Problem

`packages/ts/src/smells/inconsistent-siblings.ts:29` carries:

```ts
const INERT_FINDING_EMIT = false
```

A detector whose stated purpose is "green must mean something" currently
previews the inert case through `diagnose()` without failing `check()`. That is
correct and deliberate — ADR-009's diagnostic-first migration makes the N release
the notice period. The docstring is unusually good about it: the flag is a bare
non-exported module `const` on purpose, "not an env var, constructor option, or
per-project override", because the unsuppressable design depends on there being
no configuration surface someone could helpfully expose. A test-only subclass
exercises the emit path so it is not shipped uncovered.

**None of that is the problem.** The problem is the second half:

> `INERT_FINDING_EMIT` … "has the N+1 release happened yet."

`grep -rl "INERT_FINDING_EMIT" work/ adr/ docs/` returns **nothing**. The answer
to "has it happened yet" is owned by no record, tracked on no board, and
scheduled by nobody. It is a deferral whose only home is the comment describing
it.

## Where it went

Upstream did this correctly and eess did not inherit it.

`ts-archunit/plans/completed/0102-a-detector-that-cannot-fire-says-so.md` — the
plan that built the mechanism — states in its own header that the flip is _"out
of this plan's own scope by design — tracked separately in plan 0105, per this
plan's own Release section"_, and quotes the requirement it was following:

> _"Before N ships, file the N+1 flip as its own tracked plan … so the flip is a
> scheduled deliverable with an owner and a landing point — not a property of
> this plan's prose."_

`ts-archunit/plans/0105-the-inert-finding-flipped.md` is that filing, still open
upstream. It records that a five-persona review of 0102 found, among five
defects, _"a release-mechanism gap (nothing forces the N+1 flip to happen)"_ —
so the hazard this plan is about was identified upstream, fixed upstream by
filing 0105, and then lost in the fold: eess copied the flag and the comment
that cites a plan number, without the plan.

This record is eess's 0105.

## What has to be true before flipping

Not a number of releases. Upstream's reasoning, which applies unchanged:

- **Plan 0102's mechanism must have shipped as an installable release** — with
  the preview path live — before the flip. The notice period is a command someone
  runs, not a warning nobody reads.
- eess has **not published since `eess-ts@0.2.1` / `eess@0.2.2`**; the repo
  carries `0.3.0` with no tag ever pushed. So the notice period has not started,
  and this plan is correctly Draft rather than Ready.

## Implementation phases

### Phase 1 — flip and test

`INERT_FINDING_EMIT = false` → `true`, plus the test upstream 0102 explicitly
deferred to this filing: `check()` fails with the **identical string**
`diagnose()` previewed on N. Sabotage-verify it — flip back, the test must red.

### Phase 2 — retire the flag, or say why it stays

A constant with one live value is a branch nothing takes. Either delete it and
the `inertEmitEnabled()` seam, or record why the seam is worth keeping (the
test-only subclass is one honest reason, and if it is the reason, say so where
the flag is).

## Out of scope

- **Whether the finding is right.** That was plan 0102's question and it is
  settled; this plan only schedules the flip.
- **The other four dialects.** `inconsistentSiblings` is eess-ts's; nothing here
  generalises.

## Success definition

- `check()` fails on the inert case, with the string `diagnose()` previewed.
- Sabotage-proven: reverting the flag reds a named test.
- `grep -rl INERT_FINDING_EMIT work/` finds this plan — i.e. the deferral has a
  home for as long as it exists, and no home once it does not.
- `npm run validate` green.

## Progress ledger

- [ ] Phase 1 — flipped, tested, sabotage-verified
- [ ] Phase 2 — flag retired, or its retention recorded at the site

Deferred: none.
