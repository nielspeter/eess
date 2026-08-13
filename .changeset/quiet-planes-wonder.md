---
'@nielspeter/eess-mermaid': patch
---

Correct the README: cross-validating a diagram against TypeScript code **ships
today**, and the page said it was still planned.

The line described binding a diagram to its implementation — "so either side
drifting fails the build" — and then pointed at plan 0059 as though the work were
ahead of us. It is behind us. That capability is
`diagramMatchesCode()` in `@nielspeter/eess-crossvalidate`, and it has been
gating this repo's own kernel diagram for several releases. The plan link is kept,
now labelled as design history rather than as a roadmap entry.

No code changed. This is a documentation patch, and it ships because `README.md`
is in this package's `files` — the stale sentence is what npm renders on the
package page, so a reader evaluating eess-mermaid was being told the headline
reason to adopt it did not exist yet.

Worth stating plainly, because it is the defect class this project exists to
catch: a shipped capability documented as unbuilt reads exactly like a missing
feature, and nothing in the gate chain notices. Two records filed the same day
are the same shape — a proposal cataloguing a future "GraphQL dialect" that has
shipped in `@nielspeter/eess-ts/graphql` since before the catalog was written,
and a corpus-listing primitive proposed for md/gherkin that is already public API
in both. Prose about what exists is drift like any other; it simply has no rule
watching it yet.
