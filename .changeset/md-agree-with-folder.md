---
'@nielspeter/eess-md': minor
---

`docs(c).should().agreeWithFolder({ field, groups, direction, normalize? })`: a document's labelled value and the folder it sits in agree (plan 0495, proposal 017 block 5). Each group binds its values to its folders, one group may bind `'rest'`, and the values are a closed set in every direction: a value of another group is `wrong folder: … belongs in …` (or `belongs outside …` for a `'rest'` value), a value no group names in a bound folder is an unknown spelling, and a bound document with no value is reported under folder → value. `direction` is the kernel's `Direction` (value on the left, folder on the right) and is required. A dead folder glob, two groups binding one document, and a group whose folders hold no document are findings about the declaration that no suppression removes; malformed groups are refused when the rule runs. `examined` counts the documents judged, so a rule that read no value is red.

New types: `AgreeWithFolderOptions`, `FolderGroup`, and `Direction`, re-exported from the kernel.
