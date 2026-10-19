---
'@nielspeter/eess-md': minor
---

New: a field read inside a named section (plan 0505). `FieldOptions.region` accepts `{ section, depth? }` beside `'header'`, in `fields()`, `docs().haveField()` and `predicateHaveField()`: the value is read only in the body of every section whose heading matches `section` (as `haveSection` matches; `depth` optional), subsections included, and the unnamed-form scan reads the same lines. `haveField` reports a document with no such section as `no section "Status" to read State from (region)` (naming a heading of the name at another depth or inside a list item), never as "no field", and a structured value outside every matching section as `State at line 9 is outside the "Status" section (region)`. A region that is neither `'header'` nor `{ section }`, or a depth that is not 1 to 6, is refused with an `ArchConfigError`. The section name is scanned as every section name a rule reads is (plan 0496). Type: `FieldRegion`.
