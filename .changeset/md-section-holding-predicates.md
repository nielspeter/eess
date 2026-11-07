---
'@nielspeter/eess-md': minor
---

New on the root (plan 0636, proposal 026 ask B): `sectionsWithContent()`, `sectionsWithCodeBlock({ lang? })`, `sectionsWithListItem()`, `sectionsWithLink()` and `sectionsWithCodePointer()`, the section predicates behind `sections().haveContent()`, `haveCodeBlock()`, `haveListItem()`, `haveLink()` and `haveCodePointer()`. They compose with `and()`, `or()` and `not()` and lift through `inSections()`, so a rule can be limited to elements in a section that cites code: `inSections(and(sectionsAtDepth(2), sectionsWithCodePointer()))`. `sectionsWithCodeBlock`'s `lang` is compared in any letter case (ADR-019), and `sectionsWithLink()` is undecided on a section whose only links are HTML links eess-md cannot read, reported at each site (ADR-021). `SectionCodeBlockOptions` is unchanged and still exported.
