---
'@nielspeter/eess-md': patch
'@nielspeter/eess-mermaid': patch
'@nielspeter/eess-crossvalidate': patch
---

**Correction: two names on the `@nielspeter/eess-ts` removal list are back.**

The `0.5.0` entry in this changelog published a list of nineteen
`@nielspeter/eess-ts` symbols removed from that package's barrel. Two of them —
`isStrictFamily` and `resolveFlag` — were removed by mistake and are restored.
The other seventeen are still gone.

This package itself is unchanged; the bump exists so the correction reaches the
readers the claim reached. A removal list published in a sibling's changelog has
no other way to be corrected, because only the package that shipped the fix would
otherwise bump — the reverse of the rule that makes a breaking change name its
dependents.

The full, current list of what left each barrel in `0.5.0`, and which symbols
still resolve from `@nielspeter/eess/internal`, is in the
[0.5 migration guide](https://github.com/NielsPeter/eess/blob/main/docs/migrating-to-0.5.md).
