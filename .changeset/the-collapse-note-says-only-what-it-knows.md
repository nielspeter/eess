---
'@nielspeter/eess': patch
'@nielspeter/eess-ts': patch
'@nielspeter/eess-md': none
---

A configuration finding that several rules report, collapsed to one by `eess-ts check` and `checkAll`, no longer says "this one option generated N rules that cannot enforce anything" (bug 0461). That sentence was written for a preset's dead glob and was appended to every collapsed finding: an undeclared box mark reported by three hand-written rules that each enforce read as three dead rules. The note now says only what the collapse knows: "N rules reported this same finding; it is listed once because it is one edit." A dead selector's own message still says its rules cannot fail. A caller that matches the old note's text must update its pattern.
