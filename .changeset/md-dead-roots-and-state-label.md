---
'@nielspeter/eess-md': minor
---

**Breaking:** `corpus()` refuses a root that matches no file, with an `ArchConfigError` that names every dead root (bug 0465). A mistyped root among several used to be dropped without a word, so every rule over the corpus judged less than its author named. To migrate, correct the glob or remove the root. A root that matches files but no Markdown is not refused.

**Breaking:** `honestyAtClose` takes `label` and `aliases` for the state label, so a corpus that writes `**Status:** Done` is read (`aliases: ['Status']`); the default stays `State` (bug 0444). It also reports a lane whose records carry no state line under the label in force, once, because such a lane used to pass the state/folder check having read nothing. To migrate, pass the label your records use, or list non-record documents in `boardFiles`.
