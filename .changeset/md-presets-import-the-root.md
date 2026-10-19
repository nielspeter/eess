---
'@nielspeter/eess-md': none
---

ADR-022: `adrEnforcement` and `honestyAtClose` import eess-md's blocks through the package root, and two tests pin the presets and `exports` (no new preset) and the seven internal symbols `honestyAtClose` still imports. Nothing a consumer observes changes: the same symbols are imported by another path, and `findState`'s `root` parameter is typed as `MdDocument['root']`, the same `mdast` `Root` type, instead of importing it from `mdast`.
