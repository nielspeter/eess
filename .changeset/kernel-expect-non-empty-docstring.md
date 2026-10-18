---
'@nielspeter/eess': patch
---

The `expectNonEmpty()` docstring no longer recommends `.expectNonEmpty()` as a glob-typo guard for a `.notExist()`-shaped rule (bug 0466). On such a rule the declaration can never pass: a selected element fails the condition, and an empty selection fails the declaration. The docstring now says so, and points to a positive rule over the same population as the guard.
