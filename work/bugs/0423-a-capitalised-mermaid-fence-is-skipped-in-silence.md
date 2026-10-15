# Bug 0423: a capitalised Mermaid fence is skipped in silence

## Status

- **State:** Draft — measured 2026-10-15 by PR #213's enforcement review, on the branch fixing bug 0409.
  No red test yet, and the fix is not designed.
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

Not designed. Candidates: count a near-miss tag in the stats and report it, as plan 0412 does, or
select case-insensitively. Either way, a fence that is not read must not be silent.

## Verification

- [ ] Red test first: a ` ```Mermaid ` fence naming a missing class is reported or disclosed, through
      `embeddedDiagramsMatchCode`.
- [ ] `npm run validate` green.

Deferred: none
