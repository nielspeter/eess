# Bug 0643: whether a class diagram with no class is an empty source

## Status

- **State:** Draft — split out of [bug 0642](./fixed/0642-other-doors-pass-over-an-input-that-loaded-nothing.md) on 2026-11-07; it needs a decision before a fix.
- **Severity:** High if the decision below lands on "a diagram with no class is an empty source":
  then an adopter's own `correspondence()` over eess-mermaid's `classes(diagram('classDiagram')).select()`
  passes over a diagram that declares nothing, a false green. Until it is decided, this is a
  question, not a measured false green: [spike 0640](../spikes/0640-an-input-side-loaded-nothing.md) recorded `diagramMatchesCode` against a project
  with no class in `scope` as "an empty selection over a loaded source, which option A leaves green
  on purpose" (its Corrections, 2026-11-07), and this record does not overrule that.
- **Origin:** self-found · [spike 0640](../spikes/0640-an-input-side-loaded-nothing.md)'s build review, 2026-11-07, recorded in [bug 0642](./fixed/0642-other-doors-pass-over-an-input-that-loaded-nothing.md).
- **Reported:** 2026-11-07

## Symptom

[Spike 0640](../spikes/0640-an-input-side-loaded-nothing.md)'s mechanism needs each dialect to say when its source loaded nothing. eess-mermaid's
class builder cannot yet: a diagram with no class is not shown to be an empty source, since a
diagram may hold other declarations (notes, styles). The deprecated `fromDiagram` bridge
(`packages/mermaid/src/bridge/from-diagram.ts`) returns no selection and carries no such fact either.

A live docs promise depends on it: `docs/crossvalidate.md`'s selection-merge recipe reads
`diagramClasses.sourceEmpty` and says "a diagram that loaded nothing … must still report its empty
source", but eess-mermaid's `select()` never sets that field today.

## Fix

Not designed. The decision: what "this diagram loaded nothing" means for a class builder (no class;
no declaration of any kind; an unreadable file), measured against real diagrams before it is set.
Then `classes(d).sourceEmpty()` says it, and `select()` carries it, as eess-gherkin's builder does.

## Verification

- [ ] The decision recorded in a spike of its own under `work/spikes/`, with what it was measured
      against; this record then owns the build.
- [ ] Red first: a correspondence over a diagram that loaded nothing reports it.
