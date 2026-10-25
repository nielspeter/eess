---
'@nielspeter/eess': minor
'@nielspeter/eess-crossvalidate': minor
'@nielspeter/eess-ts': minor
'@nielspeter/eess-md': minor
'@nielspeter/eess-mermaid': minor
'@nielspeter/eess-gherkin': minor
---

**Breaking:** a `correspondence()` counts as examined only what its checks read (bug 0400). A one-way `beComplete()` counts the side it checks, a `beComplete()` in both directions counts both sides, and `preserveRelations()` counts the left elements it compared. It used to count both sides whatever the direction, so a `left-to-right` check whose left side was empty passed with `.expectNonEmpty()` declared, because the right side's elements counted as evidence; and `.expectEmpty()` on such a check expired when the side it never reads grew. Now `.expectNonEmpty()` reds over an empty checked side, and `.expectEmpty()` holds while that side is empty. Without a declaration, a one-way check over an empty checked side still passes, as an absence assertion satisfied by emptiness, and so does a `preserveRelations()` whose non-empty sides share no key: `.expectNonEmpty()` is the only protection in both. To migrate: a rule that declared `.expectNonEmpty()` on a one-way check may now report its checked side empty, which was always true; a `preserveRelations()` whose sides share no key now examines zero; a `correspondence()` with no check chained now fails, reporting that it examined zero units, where it used to pass over non-empty sides having asserted nothing. eess-ts and eess-md re-export `correspondence()`, so a rule built through either sees the same change; eess-crossvalidate's `adrCitationsResolve`, `diagramMatchesCode` (with a one-way `completeness`) and `embeddedDiagramsMatchCode` are one-way correspondences and count the same way; only `adrCitationsResolve` takes `expectNonEmpty` (the others: bug 0544). eess-mermaid and eess-gherkin are named, at minor, because they depend on the kernel and ship its break to whoever installs them; their own rules do not change.

`adrCitationsResolve(corpus, project, { expectNonEmpty: true })` (eess-crossvalidate) declares that the ADRs cite at least one test: zero citations is then a finding. Without it, zero citations passes, as before.

`mergeCollectResults` declares the merged receipt empty when every member that ran declared, and at least one ran: a `notRun` member is absent and is not asked to declare. It used to require every member to declare, so a merge of one rule switched off beside members that all declared empty reported a pass without evidence. A merge whose members all never ran still declares nothing. This is the kernel's rule for every merge, so any eess-ts preset with a rule switched off and every other member declared empty now passes where it used to report a pass without evidence.
