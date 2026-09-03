---
'@nielspeter/eess': minor
'@nielspeter/eess-ts': minor
---

**Fixed: `--changed` hid the duplicate you had just created.**

A duplicate-body finding concerns two or more files and carries one `file`, which
is where it is reported. `diffAware()` keeps a violation when that one path is in
the changed set — so if you pasted a body into a second file, the finding sat on
the file you had _not_ touched and was filtered away. Which file that was came
down to source walk order, i.e. to how the OS enumerated a directory.

This was true for a plain two-body duplicate, which is the common case, and the
pair-to-cluster collapse widened it: a family of three reported at one file
instead of two.

**New on `ArchViolation`: `relatedFiles?: readonly string[]`** — the other files
one finding concerns. Optional and additive: a single-file finding omits it,
existing producers keep compiling, and a consumer that ignores it behaves exactly
as before. `diffAware()` now keeps a violation when its own file _or_ any related
file changed. `smells.duplicateBodies()` populates it for pairs and clusters.

Output volume is unchanged — a finding that names three files is still one
finding, not three. The alternative considered was emitting the finding once per
member file, which fixes the filter and gives back part of the 11.7x reduction
the cluster collapse exists for.

If you consume violations and filter them by file yourself, read `relatedFiles`
too, or you will reproduce this bug in your own tooling.
