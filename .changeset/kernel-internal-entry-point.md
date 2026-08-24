---
'@nielspeter/eess': minor
'@nielspeter/eess-ts': minor
'@nielspeter/eess-md': minor
'@nielspeter/eess-mermaid': minor
'@nielspeter/eess-gherkin': minor
'@nielspeter/eess-crossvalidate': minor
---

**Breaking** — the kernel splits into two entry points. Family plumbing moves from
`@nielspeter/eess` to `@nielspeter/eess/internal` (ADR-011).

`@nielspeter/eess` had never declared what its public API was. It was implied — the
union of whatever the five dialects happened to import — so nothing could check the
boundary, and 78 engine internals sat on the published surface: `shallowClone`,
`isRecord`, `resetEdgeCoverage`, the glob-tree vocabulary, the suppression and
edge-coverage counters. Because `check:family` required each dialect to re-export
every kernel symbol its own source imports, each of those was published again by
every dialect that touched it.

**What moved.** 78 symbols now live at `@nielspeter/eess/internal`. If you import one
from `@nielspeter/eess`, change the specifier — nothing was deleted or renamed.

**What did not move**, because "unreferenced in this repo" is not "not API":
`correspondence` and `CorrespondenceBuilder` (documented on six pages, and the public
surface of eess-md and eess-crossvalidate), `reportViolations` and `finishPreset`
(named seams in ADR-008), and the `ArchJson*` types, which describe the `--format
json` output that `docs/agent-integration.md` teaches.

**The dialects' surfaces shrink too.** A dialect no longer re-exports kernel plumbing
it only uses internally, so `eess-ts`, `eess-md` and `eess-mermaid` each drop what they
used to forward. For those, the rule above applies — the symbol is a KERNEL symbol and
`@nielspeter/eess/internal` has it.

**That rule does not cover the 37 dialect-local symbols removed in the same release.**
Those were never kernel symbols, so `/internal` does not have them and there is no
replacement path; see the companion changeset for the list and the reasoning.

Measured across the family: exported symbols 627 → 543, and symbols documented nowhere
224 → 139.

`@nielspeter/eess/internal` is a published, versioned contract — breaking it still
needs a changeset. What it is not is API: nothing there is taught by `docs/` or a
README, and a consumer writing rules never names it. That boundary is enforced inside
this repo and is convention outside it, which ADR-011's Enforcement table records as
`manual` rather than claiming otherwise.
