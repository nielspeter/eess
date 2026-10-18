---
'@nielspeter/eess-md': minor
---

`corpus()` takes `expectEmptyRoots`, naming roots that are empty on purpose, such as a lane with no records yet or a test fixture that writes only the folder its rule reads (bug 0475). A named root that loads no Markdown document is not refused. The declaration expires: a named root that loads documents is refused, and so is a name that is not one of the roots.

**Breaking:** `honestyAtClose` reads a state written as a heading in a record's header, `## Status: Done`, under the labels in force (bug 0476). A run of `## Label: value` headings is one header. A record written that way used to go unread, so its state/folder check never ran. It may now report a mismatch or an open box. Under a label not in force, it is reported as `ledger/state-under-another-label`. An out-of-vocabulary heading value is reported as an unknown state. To migrate, pass the label your records use: `label: 'Status'`, or `label: 'Status', aliases: ['State']` if your records mix forms.
