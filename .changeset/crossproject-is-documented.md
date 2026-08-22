---
'@nielspeter/eess-ts': minor
---

`crossProject()` is documented, and `crossLayer()` is marked deprecated with a
successor.

`crossProject` shipped as a public API with no page, no sidebar entry and no worked
example — discoverable only from a deprecation callout on the page for the API it
replaces. It now has [its own page](https://nielspeter.github.io/eess/cross-project),
with three examples that compile in CI and a migration table from `crossLayer`.

`crossLayer()` carries an `@deprecated` tag naming `crossProject()` as its
successor. Nothing about `crossLayer` changes — it still works, and no API moves.

**Declared `minor`, not `patch`, and the reason is the tag.** If you lint with
`@typescript-eslint/no-deprecated`, this reddens your build the moment you upgrade —
and `patch` is the bump renovate and dependabot auto-merge. It is not a break, so it
carries no breaking marker; it is a `minor` so the upgrade is a decision.

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
