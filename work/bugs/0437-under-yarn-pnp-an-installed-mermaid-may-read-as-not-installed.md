# Bug 0437: under Yarn Plug'n'Play an installed `mermaid` may read as not installed

## Status

- **State:** Draft — recorded 2026-10-16 in plan 0413's PR, from its architect review. Not measured.
- **Severity:** Low — no false green: the run is red. If the read fails as expected, the remedy
  ("install both peers") is wrong for an adopter who has.
- **Origin:** self-found · PR review of plan 0413, 2026-10-16.
- **Reported:** 2026-10-16

## Symptom

`mermaidParser()` reads the installed `mermaid`'s version from the first `<dir>/mermaid/package.json`
among `createRequire(workerUrl).resolve.paths('mermaid')`
(`packages/mermaid/src/mermaid-js/create-mermaid-parser.ts`, `declaredMermaid`). Under Yarn PnP
there is no `node_modules` directory, so the read is expected to find nothing and report
`'not installed'`, which would contradict plan 0413's rule that an installed `mermaid` is never
reported as missing (ADR-009 rule 2). Not measured, and nor is whether the worker itself would
resolve `mermaid` under PnP: if it would not, "not installed" may be right for another reason.

## Fix

Measure under PnP first. If confirmed, read the version through PnP's own API when it is present,
or let the worker's loaded version stand when the host cannot read one.

## Verification

- [ ] Measured under Yarn PnP
- [ ] Red test first, if confirmed

Deferred: none
