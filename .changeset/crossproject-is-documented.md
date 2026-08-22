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

**It is a rewrite, not a rename**, and the docs say which parts. The file pairing
moves from `.mapping(fn)` into the key function, and a key function may return an
**array**, which is what lets `haveConsistentExports` translate: one file expands
into one key per exported symbol, with the pairing folded into the key's prefix.
Capability is preserved; what degrades is violation attribution — the composite key
lands in the message rather than the `element`.
