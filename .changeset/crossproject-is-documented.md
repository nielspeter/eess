---
'@nielspeter/eess-ts': patch
---

`crossProject()` is documented, and `crossLayer()` is marked deprecated with a
successor.

`crossProject` shipped as a public API with no page, no sidebar entry and no worked
example — discoverable only from a deprecation callout on the page for the API it
replaces. It now has [its own page](https://nielspeter.github.io/eess/crossproject),
with three examples that compile in CI and a migration table from `crossLayer`.

`crossLayer()` carries an `@deprecated` tag naming `crossProject()` as its
successor. Nothing about `crossLayer` changes — it still works — but your editor
will now say so, and point at the migration.

**It supersedes `crossLayer` for pairings that are key equality — most of them, not
all — and it is a rewrite rather than a rename.** The page states the precondition
and what falls outside it, so you can tell before you start:

- A key function may return an **array**, which is what lets `haveConsistentExports`
  translate: one file expands into one key per exported symbol, with the pairing
  folded into the key's prefix.
- A `.mapping(fn)` that is **not** key equality — prefix matching, directory
  nesting, "imports its schema" — has no key encoding. Keep `crossLayer`.
- `satisfyPairCondition` builds its own violation, including `measured` /
  `metricUnit` for the baseline ratchet. No equivalent. Keep `crossLayer`.
- A chain of 3+ layers becomes N−1 separate rules.

Where it does apply, attribution degrades (the composite key lands in the message
rather than the `element`), unpaired files go from silent to one finding per symbol,
and **your baseline does not survive** — identity is `rule::element::message` and
migrating changes all three.
