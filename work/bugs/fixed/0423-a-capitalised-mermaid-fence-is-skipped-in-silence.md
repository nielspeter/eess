# Bug 0423: a capitalised Mermaid fence is skipped in silence

## Status

- **State:** Fixed — 2026-10-15, in the PR that closes it. Measured the same day by PR #213's
  enforcement review and re-measured by the coordinator.
- **Severity:** High — a false green (`BUGS.md`'s High row). A diagram tagged ` ```Mermaid ` that names
  a class missing from the code is not examined, not counted, and passes.
- **Origin:** self-found · review of PR #213, 2026-10-15.
- **Reported:** 2026-10-15

## Symptom

`embeddedDiagramsMatchCode` selects a fence only when its tag is exactly `mermaid`. A ` ```Mermaid `
fence is neither compared nor counted in `embeddedDiagramStats().skipped`, so a drifted diagram written
with that tag passes with nothing said.

Re-measured by the coordinator on the same branch: a ` ```Mermaid ` fence naming a class missing from
the code gives `embeddedDiagramStats` `{"documents":0,"diagrams":0,"skipped":0}` and no finding naming
the class, where the same fence tagged `mermaid` gives one. When it is the only diagram in the corpus,
the kernel's empty-evidence finding still fires; in a corpus with any other class diagram, the run
passes.

## Root cause

The selector compares `b.lang === 'mermaid'` (`packages/crossvalidate/src/md-mermaid.ts`,
`classDiagramBlocks`). A tag that differs only in case is neither selected nor reported as a near
miss. Plan 0412's `parseCodeBlocks` handles the same case by disclosing a case-folded near-miss tag;
these bindings do not.

## Fix

**Decided 2026-10-15, overrulable: read the tag case-insensitively.** A fence tagged `Mermaid` is plainly
meant as a diagram. Reading it closes the false green with nothing for the author to change. The other
candidate, plan 0412's exact match with the near miss disclosed, would either stay quiet beside read
fences or make authors retag. `isMermaidTag()` in `packages/crossvalidate/src/shared.ts` is used by both
of `md-mermaid`'s selectors, the comparison and `embeddedDiagramStats`.

The ER binding has the same defect on its own path, measured and recorded as
[bug 0424](../0424-a-capitalised-mermaid-er-fence-is-skipped-in-silence.md) rather than folded in.

## Verification

- [x] Red test first: `packages/crossvalidate/tests/md-mermaid.test.ts`, the bug 0423 test, reports the
      ghost class in a fence tagged `Mermaid` and counts two diagrams. Red before the change.
- [x] A sabotage: restoring the exact comparison turns that test red.
- [x] A non-vacuity case: `scripts/nonvacuity/bad-md-mermaid.mjs` case 8,
      `bad-md-mermaid/capitalised-diagram.md`. It fires with the fix and goes vacuous (exit 0) with the
      exact comparison restored.
- [x] `npm run validate` green on this branch.

Deferred: none
