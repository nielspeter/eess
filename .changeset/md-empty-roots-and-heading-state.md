---
'@nielspeter/eess-md': minor
---

`corpus()` takes `expectEmptyRoots`, naming roots that are empty on purpose, such as a lane with no records yet or a test fixture that writes only the folder its rule reads (bug 0475). A named root may match no file beside live roots without being refused. The declaration expires: a named root that matches files is refused, and so is a name that is not one of the roots.

**Breaking:** `honestyAtClose` reads a state written as the first section's heading, `## Status: Done`, under the labels in force (bug 0476). A record written that way used to go unread, so its state/folder check never ran. It may now report a mismatch or an open box. Under a label not in force, it is reported as `ledger/state-under-another-label`. To migrate, pass the label your records use (`label: 'Status'`).
