---
'@nielspeter/eess': patch
---

`beUniqueBy`'s message names the other members of a group in location order, a run of digits compared as a number, instead of in the order the elements loaded (bug 0526). The same duplicates now give the same message on every runtime, and in a group of more than eleven the ten others named are the first by location.
