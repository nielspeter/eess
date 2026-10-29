# @nielspeter/eess-md

## 0.13.0

### Minor Changes

- 8e1c2b3: A mention's link says where it points (plan 0549): `link.text` is the link's whole text, `link.target` is where it resolves (`resolveLink`'s cases: external, self, document, not-in-corpus, directory, missing), and `link.offset` is where the mention starts in the text. `mentions(corpus, { pattern, resolve })` takes the resolve options a `links().resolve()` rule takes. `areLinked()` selects the mentions that sit in a link. With them, a `correspondence()` between your linked mentions and your records checks that a link opens the record it names; `areInTitleLinks({ linkPrefix, titlePrefix })` holds for a mention in a link whose text is its target's title, so a board row quoting another record can be left out of that join. `collectMentions` returns `MdMentionMatch`, with the link's URL only. None of this has been released before, so nothing that shipped changes.
- 10a7183: `beLinked({ fix })` fixes a plain mention (plan 0550): when exactly one record, across every source you declare, holds the mention's key, the finding carries a fix linking it there, which `eess-ts check --fix` lists and `--fix --apply` writes. Anything else is refused, and the finding says why: no record or several, an undefined key, inline code, a `!` or `]` before it, a target no link destination can hold or outside the repository, a mention whose source text is not as written, or `foreign`, your pattern for another project's name, matching in the text around it. `foreign` is required and checked when `beLinked()` is called. Two configuration findings, `md/mention-fix-config`, report a fix that could link nothing. New exports: `MentionFix`, `BeLinkedOptions`, `MENTION_FIX_CONFIG`, and `MdMentionSpan` for a mention's new `span`, its place in the source; the kernel's `Selection` type is re-exported.
- ad032aa: `docs().should().agreeWithPath({ path, title, normalize? })` (proposal 017, block 16): a value read out of a document's own path and the same value read out of its title agree, such as a record's number in its file name and in its H1. Each pattern's named group `value` is the value (a pattern without one is refused at the call), so an alternation reads either form of a title; a value that is not there or is empty is never a value, so two sides that read nothing do not agree. A document whose path, title or title's value cannot be read is reported, never skipped; a pattern that reads nothing across the selection is one finding that no suppression removes, not one per document. The rule's `examined` is the documents selected, as for `agreeWithFolder`. Additive: one method and one type, `AgreeWithPathOptions`.
- 75df1b7: `mentions(corpus, { pattern })`: every match of your pattern in a document's text, with `beLinked()` to say each one sits in a link (plan 0539). Inline code is read, so backticks do not hide a mention; a mention split by emphasis or a soft line break is found when your pattern allows it; a mention in a raw HTML block, a reference-style link, image alt text or a link title is reported as unread (`md/unread-mention`) where the rule reaches it. `areSelfMentions({ mention, document })` lets a record name itself. The pattern and the keys are yours: nothing about records is built in. Presence only: which file a link points at is not judged.
- 87f0643: **Breaking:** a `correspondence()` counts as examined only what its checks read (bug 0400). A one-way `beComplete()` counts the side it checks, a `beComplete()` in both directions counts both sides, and `preserveRelations()` counts the left elements it compared. It used to count both sides whatever the direction, so a `left-to-right` check whose left side was empty passed with `.expectNonEmpty()` declared, because the right side's elements counted as evidence; and `.expectEmpty()` on such a check expired when the side it never reads grew. Now `.expectNonEmpty()` reds over an empty checked side, and `.expectEmpty()` holds while that side is empty. Without a declaration, a one-way check over an empty checked side still passes, as an absence assertion satisfied by emptiness, and so does a `preserveRelations()` whose non-empty sides share no key: `.expectNonEmpty()` is the only protection in both. To migrate: a rule that declared `.expectNonEmpty()` on a one-way check may now report its checked side empty, which was always true; a `preserveRelations()` whose sides share no key now examines zero; a `correspondence()` with no check chained now fails, reporting that it examined zero units, where it used to pass over non-empty sides having asserted nothing. eess-ts and eess-md re-export `correspondence()`, so a rule built through either sees the same change; eess-crossvalidate's `adrCitationsResolve`, `diagramMatchesCode` (with a one-way `completeness`) and `embeddedDiagramsMatchCode` are one-way correspondences and count the same way; only `adrCitationsResolve` takes `expectNonEmpty` (the others: bug 0544). eess-mermaid and eess-gherkin are named, at minor, because they depend on the kernel and ship its break to whoever installs them; their own rules do not change.

  `adrCitationsResolve(corpus, project, { expectNonEmpty: true })` (eess-crossvalidate) declares that the ADRs cite at least one test: zero citations is then a finding. Without it, zero citations passes, as before.

  `mergeCollectResults` declares the merged receipt empty when every member that ran declared, and at least one ran: a `notRun` member is absent and is not asked to declare. It used to require every member to declare, so a merge of one rule switched off beside members that all declared empty reported a pass without evidence. A merge whose members all never ran still declares nothing. This is the kernel's rule for every merge, so any eess-ts preset with a rule switched off and every other member declared empty now passes where it used to report a pass without evidence.

### Patch Changes

- 8685289: Examples, comments, test fixtures and the eess-md README's localized-header example use German, and the locale-collation probes use Czech, in place of the language they used before. No behaviour changes; a patch so the published README and the shipped comments carry the change.
- 569a8e8: A text is parsed once per process (bug 0547). A second `corpus()` over the same files, and `findState` called without its tree, reused nothing and parsed every document again; this repository's `check:ledger` parsed 1,946 times for 502 texts and now parses 505 times, in 5.1 s instead of 12.5 s. Nothing you can observe changes: every document still gets its own tree, which you may edit without touching another document's. The memo holds up to 2^24 characters of text, least recently used dropped first, and eess-ts's `resetProjectCache()` clears it with the kernel's other caches.
- Updated dependencies [8685289]
- Updated dependencies [87f0643]
- Updated dependencies [cc82d23]
  - @nielspeter/eess@0.9.0

## 0.12.0

### Minor Changes

- 09befdb: **Breaking:** box marks beyond GFM's `[ ]` and `[x]` are now read, and an undeclared one is a finding (plan 0454, bug 0445). `- [~] half done` used to be an ordinary list item, so a closed record whose boxes were all `[~]` passed `honestyAtClose`.
  - `taskItems(corpus, { marks })` and `honestyAtClose(corpus, { marks })` take `marks`, e.g. `{ '~': 'open', '→': 'done' }`. A declared open mark is an open box; a declared done mark is a closed one. A declaration that is not one grapheme (one character as a reader sees it), is GFM's own space, `x` or `X`, is a bracket or whitespace, or is neither `'open'` nor `'done'` is refused. Declare the state a mark means: `'done'` claims the work is finished.
  - A box whose mark no one declared is `md/undeclared-box-mark` (once per document and mark); a near-GFM box (`[ x ]`, `[x]done`, an empty `- [ ]` or `- [x]`) is `md/malformed-box` (once per box). Both are configuration findings, so a `.warn()` rule that carries one now fails, and `.excluding()` does not hide them. A rule reports such a box only when its predicates could have reached it.
  - `MdTaskItemRef` gains two required fields, `mark` and `state`. `MdTaskItem` (a `taskItems()` element) no longer extends it: it carries `mark` and a `state` of `'open' | 'done'`. Either breaks a caller who constructs one.
  - `areOpen()` selects `state === 'open'` and `areChecked()` `state === 'done'`: the same boxes as before for GFM boxes.
  - `collectTaskItems(root, { marks, source })` requires the document's `source` (mdast resolves an escaped `\[` away) and returns more elements: undeclared marks, malformed boxes and empty `- [ ]` / `- [x]`, each with `state: 'undeclared' | 'malformed'` and `checked: false`. A caller that counted `!checked` as open sees its count rise.

  To migrate: declare each mark once, as a shared `marks` constant passed to `taskItems()` and `honestyAtClose()` (`{ '<mark>': 'open' | 'done' }`), or rewrite the box as `[ ]` or `[x]`; rewrite a `[ x ]` or an empty box; escape (`\[`) or code-span a bracket that is not a box; add `mark` and `state` to any `MdTaskItemRef` or `MdTaskItem` you construct; pass `source: doc.text` to `collectTaskItems`, and where you counted `!checked` from it, filter on `state`.

  New: `UNDECLARED_BOX_MARK`, `MALFORMED_BOX`, and the types `BoxMarkState` and `TaskItemOptions`.

  Plan 0456 ships a second eess-md break in the same release (a corpus that loaded no document is an empty source). Read both.

- 27e7542: `docs(c).should().agreeWithFolder({ field, groups, direction, normalize? })`: a document's labelled value and the folder it sits in agree (plan 0495, proposal 017 block 5). Each group binds its values to its folders, one group may bind `'rest'`, and the values are a closed set within the bound folders (add a `'rest'` group to close it everywhere): a value of another group is `wrong folder: … belongs in …` (or `belongs outside …` for a `'rest'` value), a value no group names in a bound folder is an unknown spelling, and a bound document with no value is reported under folder → value. `direction` is the kernel's `Direction` (value on the left, folder on the right) and is required. A dead folder glob, two groups binding one document, and a group whose folders hold no document are findings about the declaration that no suppression removes; malformed groups are refused when the rule runs. An agreement that selected documents and judged none is its own unsuppressable finding, whatever conditions sit beside it, naming its cause: it read no value (a misspelt label, the wrong forms or region), or the values it read sit in no group's folders and no group names them.

  New types: `AgreeWithFolderOptions`, `FolderGroup`, and `Direction`, re-exported from the kernel.

- 27e7542: New: `docs(c).should().beUniqueBy(key, what)` states that no two selected documents share `key`'s value, such as a record's number or a page's slug (plan 0459, proposal 017 block 13). Every document of a group is a finding at its line 1, named by its path and naming the others. Values compare exactly (`066` and `0066` differ): normalise in `key`, and select away a document without a value with `.that()` first.
- 73d062e: **Breaking:** a box's `text` is all of its own content (bug 0507): every paragraph of the list item and every sub-item that is not itself a box, with whitespace collapsed across lines. It used to be the first paragraph only, so `honestyAtClose` was green on a closed record whose `Deferred: none` contradicted a `deferred→` written on the box's second line or in a plain sub-bullet, and reported a box as undisposed when its disposition was on the second line. A nested box is still its own box; fenced code and HTML inside an item are not read. To migrate: a closed record whose deferral sits below its box now reds `ledger/deferred-none-lie` until its `Deferred:` line names it; a rule over `taskItems()` that tested `text` sees the box's other lines, joined by single spaces where they used to keep their line breaks. Measured on this repository: `check:ledger` reads the same 444 records and 197 done-items, with 0 findings, before and after.
- 27e7542: New: `corpusFromText(files, options?)` and its `TextCorpusOptions` (plan 0455). A test can build a corpus from a map of repo-relative path → text instead of a directory on disk. It is `corpus()` with the walk swapped out, so links and pointers resolve as they would over the same files: a pointer's line count reads the map, and why an existing file was not loaded is answered as `corpus()` answers it. `roots` defaults to every `.md` key; `frozen` keeps `corpus()`'s default.

  What cannot behave as on disk is refused with an `ArchConfigError`: a waiver directive in a loaded document (the kernel reads waivers from disk, so it would not apply), a key that is not one canonical repo-relative POSIX path, a key that is also the directory of another, two keys that differ only in letter case, a key under a directory `corpus()` never walks, and a `root` that exists on disk. A pointer rule with `externalRoots` over a text corpus is refused too: those roots are read from the real disk.

  `expectEmptyRoots` and `expectEmptyFrozen` keep `corpus()`'s meaning, and the frozen globs you pass are judged as `corpus()` judges them (bug 0499, shipped beside this): an explicit `frozen` glob that marks none of the map's documents is refused unless named in `expectEmptyFrozen`.

  Additive: `corpus()` and the `Corpus` interface are unchanged.

- 4ced684: `corpus()` takes `expectEmptyRoots`, naming roots that are empty on purpose, such as a lane with no records yet or a test fixture that writes only the folder its rule reads (bug 0475). A named root that loads no Markdown document is not refused. The declaration expires: a named root that loads documents is refused, and so is a name that is not one of the roots.

  **Breaking:** `honestyAtClose` reads a state written as a heading in a record's header, `## Status: Done`, under the labels in force (bug 0476). A run of `## Label: value` headings is one header. A record written that way used to go unread, so its state/folder check never ran. It may now report a mismatch or an open box. Under a label not in force, it is reported as `ledger/state-under-another-label`. An out-of-vocabulary heading value is reported as an unknown state. To migrate, pass the label your records use: `label: 'Status'`, or `label: 'Status', aliases: ['State']` if your records mix forms.

- 73d062e: New: a field read inside a named section (plan 0505). `FieldOptions.region` accepts `{ section, depth? }` beside `'header'`, in `fields()`, `docs().haveField()` and `predicateHaveField()`: the value is read only in the body of every section whose heading matches `section` (as `haveSection` matches; `depth` optional), subsections included, and the unnamed-form scan reads the same lines. `haveField` reports a document with no such section as `no section "Status" to read State from (region)` (naming a heading of the name at another depth or inside a list item), never as "no field", and a structured value outside every matching section as `State at line 9 is outside the "Status" section (region)`. A region that is neither `'header'` nor `{ section }`, or a depth that is not 1 to 6, is refused with an `ArchConfigError`. The section name is scanned as every section name a rule reads is (plan 0496). Type: `FieldRegion`.
- 27e7542: New: `fields(c, { label, forms }).should().beUniqueBy(key, what)`, and the same on `terms()`, states that no two occurrences of a labelled value share `key`'s value: "no two records carry the same Id" without a hand-written reader (plan 0459's addendum, proposal 017 block 13). Each occurrence is a finding at its own line, naming the others. Values compare exactly, so normalise in `key` (`(f) => f.value.replace(/^0+(?=\d)/, '')` makes `066` and `0066` collide). A value the rule cannot read is reported on its own, never grouped.
- 128dfc6: **Breaking:** `MdTerm` gains two required fields, `label` and `form` (plan 0468). A test or helper that builds an `MdTerm` literal stops compiling; add `label` (the label as written, without its colon) and `form` (`'pattern'` for a `terms()` element).

  **Breaking:** `TermRuleBuilder`'s constructor takes a different argument. Build one with `terms()` or `fields()`; a subclass or a direct `new TermRuleBuilder(corpus, options)` stops compiling.

  The shared label grammar (`honestyAtClose`, `links().areLabelled()`) now also reads a label after a numbered list marker (`1. **State:** Done`), as it read one after a bullet.

  New: `fields(corpus, { label, aliases?, forms, value?, split?, region? })` reads a labelled value in the forms you name (`'bold'`, `'heading'`, `'bold-line'`, `'plain'`; no default). `resolveAgainst` now takes a `Vocabulary` or a `RegExp`, which must match the whole value; a field's finding names the value, the label and the line. A line in your rule's selection that names the label with markup it does not read is reported (with the form to add, or a rewrite), and a value that is empty after cutting is a finding; plain prose is never taken for a label. CRLF files read as LF ones. Helpers for cutting a value: `cleanValue`, `untilDelimiter`, `longestOf`. Types: `FieldForm`, `FieldOptions`.

  `terms()` reads exactly what it read before.

- 27e7542: **Breaking:** `corpus()` now judges the `frozen` globs you pass it (bug 0499). One that can never match a path under `cwd` (a leading `/`, a `../` segment, a `./` after the first) is refused with an `ArchConfigError` that gives the corrected glob, and one that marks none of the documents the corpus loaded is refused, naming it. Before, either emptied `areFrozen()`, so an absence rule such as `taskItems(c).that().areOpen().satisfy(inDocuments(areFrozen())).should().notExist()` was green with nothing examined. A corpus that loads no document is left to the empty-source report, as a dead root is.

  The same judgement applies to `corpusFromText` (plan 0455, shipped beside this), which shares `corpus()`'s assembly: its explicit `frozen` globs are judged against the map's documents, and it takes `expectEmptyFrozen` too.

  New: `corpus({ expectEmptyFrozen })` names frozen globs that mark nothing on purpose, such as a lifecycle folder with no record yet. Each name must be one of `frozen`, and the declaration expires: once its glob marks a document, `corpus()` refuses until you drop it from `expectEmptyFrozen`.

  To migrate: correct a faulted glob as the message says. For a lifecycle glob whose folder holds no record yet (`'**/wont-do/**'` before anything is filed there), name it in `expectEmptyFrozen`. Do not remove it: removed, a record filed there later is read as live, and an absence rule over the frozen documents never sees it, which is the false green this fix closes. Writing the default list out makes it yours, and it is judged; the omitted default is not, so if you passed `frozen: ['**/completed/**', '**/archived/**']` and lack one of those folders, omit `frozen` or declare the missing one.

- da311ea: New: `docs(c).haveField({ label, forms, value?, split?, region?, oneOf? })`, dual-use like `haveSection` (plan 0469). After `.that()` it selects the documents whose labelled value resolves (and, with `oneOf`, is allowed); after `.should()` it asserts every selected document has one. One value per document: a structured form beats plain prose, two structured values are a conflict. A document whose value cannot be read (a conflict, a form the rule does not read, a value outside the header, an empty value, a value after a code fence that never closes) is reported in either position, and so is prose that disagrees with a resolved value. As a selector, a document with no field at all is left out like any document the filter does not keep: pair it with a `.should().haveField()` rule over the same documents. Type: `HaveFieldOptions`. Also exported as a predicate, `predicateHaveField(options)` (ADR-023 clause 2: a twin of the `docs().haveField()` method takes the prefix), for `satisfy()`, the combinators and a lift onto a document's elements (ADR-021, plan 0486): a document whose value cannot be read is undecided, neither selected nor dropped, and each cause is one unsuppressable finding wherever the rule's verdict depends on it; a value that resolved is decided. `.select()` over an undecided document throws, naming the cause. `fields()` and `taskItems()` report an undecided document's causes beside their own findings. Type re-exported: `Undecided`.
- 7ef7a1d: New: `inDocuments(p)` lifts a document predicate onto any element that carries its document (boxes, links, pointers, rows, terms, code blocks), through `satisfy()`: `taskItems(c).that().areOpen().satisfy(inDocuments(areLive())).should().notExist()`. A document the predicate cannot judge (`predicateHaveField` over a Status given twice) leaves its elements undecided and is reported, never dropped (ADR-021). On a positive rule, a scope that matched no document is named in the zero-examined finding, with the corpus's document count; a live scope whose documents hold none of the selected elements says how many documents it matched. On a `notExist()` rule a scope that matches nothing is green, as an absence rule over nothing is: guard it with a positive rule (the docs show the pair).

  New: `areFrozen()` and `areLive()`, document predicates over the `frozen` globs passed to `corpus()`, and `predicateHaveSection(name)`, the predicate twin of the `haveSection` condition (ADR-023: a twin takes the prefix).

  New: `ParsedCodeBlocks.documents`, every document the corpus loaded. A hand-built object typed as `ParsedCodeBlocks` needs the field to compile; `codeBlocks()` refuses such an object anyway.

  The kernel's change is a docstring (`deadGlobDiagnosis()`), so it ships nothing.

- 73d062e: New: `inSections(p)` (plan 0503) lifts a section predicate onto any element on a line of its document (boxes, links, pointers, rows, terms, fields), through `satisfy()`: `taskItems(c).that().satisfy(inSections(sectionsNamed('Acceptance criteria'))).should().notExist()`. An element is under every section that contains its line, so a box under a subsection of the named section is under it. Membership is decided across the enclosing sections, and a section the predicate cannot judge leaves the element undecided and reported, never dropped (ADR-021). A finding about such an element names the innermost selected section in its message, `(under "Acceptance criteria", line 5)`, never in its element, so `.excluding()` keys do not change. On a positive rule a section scope that selects no section is named in the zero-examined finding, with the corpus's section and document counts; a live one that holds none of the selected elements gives its counts. On `notExist()` an empty scope is green: guard it with a positive rule reading the same `const` (the docs show the pair). A section predicate wrapped in the kernel's `not()`, `and()` or `or()` inside `inSections` is not read by the section-name scan (bug 0512): under `and()` a near miss goes unreported and an absence rule stays green.

  New: the section predicates for it, `sectionsNamed(name)`, `sectionsAtDepth(depth)`, `sectionsInSection(name)` and `sectionsWithSubsection(name, { depth? })`, and `predicateHaveTextMatching(re)`, a predicate over any element with a `text`; `taskItems().haveTextMatching(re)` is its method, in both phases (as a condition, every selected box's text must match). ADR-023 clause 2: the method keeps the plain word, the free predicate takes the prefix. Patterns are read without `g` and `y`. No existing rule changes verdict.

- 73d062e: **Breaking:** `links().areInSection()` reads the sections every other reader reads (bug 0502). A heading inside a list item or a blockquote used to enter a link's section path, replacing the real headings at its depth for the rest of the document: a link under `### Sub` that came after `- ## Listed` was not selected by `areInSection('Sub')` (a rule green on a link it never examined), and was selected by `areInSection('Listed')`. Now a link's `sectionPath` is the sections that contain its line, as a table's is, and a heading in a container scopes no link, inside its container or after it. A rule that names such a heading reports it (`the heading "Listed" at line 7 is inside a list item, which does not start a section`). To migrate: a rule that relied on a heading inside a list or blockquote to scope links moves the heading to the top level; a rule over a real section may now examine, and report, links it used to drop.
- 94685a7: **Breaking:** a corpus that loaded no document is now an empty source (plan 0456). A rule over it reports "this rule's source loaded zero units", which `.expectEmpty()` cannot declare away, and an absence rule over it no longer passes. `honestyAtClose` over such a corpus reports it once, even with `expectEmptyHeaders`. To migrate: if a rule over a corpus that loads nothing relied on `.expectEmpty()`, fix the corpus's `roots`. A `honestyAtClose` lane whose roots match no file now fails; create the folder with its board file, or remove the lane.

  New: `.should().notExist()` on `docs()`, `links()`, `pointers()`, `rows()`, `terms()`, `taskItems()` and `codeBlocks()`. Each selected element is a finding at its own line. On `docs()` and `terms()`, an absence rule whose folder or file glob is broken is reported, naming the call (on `codeBlocks()`, for the glob's text only; on the other builders, only for a predicate that declares its glob): a glob that can never match a path relative to the corpus's `cwd` (a leading `/`, a `../`, a `./` after the first segment), a glob naming Markdown the corpus did not load (outside its `roots`, or `ignore`d), or a `\` written as a path separator. A glob naming nothing in the repository stays green, since that is also what a holding ratchet looks like.

  New on the root: `resideInFolder`, `resideInFile` and `haveNameMatching` as predicates for `satisfy()`, `and` and `or` beside `not`, `globNode`, and the `GlobNode` and `GlobSite` types. eess-md's `resideInFolder('guides/**')` is relative to the corpus's `cwd`; eess-ts's predicates of the same names match absolute paths.

  Plan 0454 ships a second eess-md break (undeclared box marks). If both land in one release, read both.

- 73d062e: New: the rest of proposal 017's blocks 3 and 14 (plan 0522). `docs().haveTitle(name?)`, dual-use, and the root condition `haveTitle`: a document's title is its first heading not inside a list item, blockquote or footnote, which must be at depth 1 and match `name` when given (a string exactly, or a `RegExp`); a document with no heading, or whose first heading is at another depth, is a finding naming which. On `sections()`, dual-use: `haveContent()`, `haveCodeBlock({ lang? })` (the tag compared in any letter case), `haveListItem()`, `haveLink()` and `haveCodePointer()`, each read from the section's heading through its last line, subsections included (a link or pointer in the heading's own text counts, as `inSections` places it). Type: `SectionCodeBlockOptions`. A live code pointer under a named section is `haveCodePointer()` beside `pointers().satisfy(inSections(…)).should().resolve()`.
- 73d062e: New: `sections(corpus)`, a rule over sections (plan 0496). Each heading not inside a list item, blockquote or footnote, at any depth, is an element, `MdSectionElement`: its `name`, `depth`, `line`, the headings that enclose it (`sectionPath`) and `endLine`, the line before the next heading at its depth or shallower. Selectors `areNamed(name)`, `areAtDepth(depth)` and `areInSection(name)`; `haveSubsection(name, { depth? })` in both phases; `haveTable({ columns })`, every selected section holds such a table (a `section` option is refused); `notExist()`. A heading inside a list item, a blockquote or a footnote definition does not start a section, and a rule names it rather than reading past it. Types: `MdSectionElement`, `SubsectionOptions`, `SectionTableOptions`, `SectionRuleBuilder`.

  New: `haveSection(name, { depth })`, on the condition, `docs().haveSection()` and `predicateHaveSection()`: only a heading at that level counts, and a heading of the name at another level is named in the finding. A depth that is not an integer from 1 to 6 is refused with an `ArchConfigError`. Type: `HaveSectionOptions`. Without the option, verdicts are unchanged; a `missing section "X"` finding gains a note when a heading of the name sits in a list item or blockquote, or differs from it only by case or spacing.

  New: one section-name scan for every corpus builder. Every section name a rule reads (`sections()`' selectors and `haveSubsection`, `links().areInSection()`, the `haveSection` condition with a `depth`, and `predicateHaveSection`, which `docs().that().haveSection()` uses, with or without one) is scanned in the documents the rule can see (those its `inDocuments` scopes admit, leaving out a scope that itself reads a section name; every document when it has none): a heading that misses a string name only by case or spacing, a heading of the name inside a container, or present only at other depths. A condition's finding names such a heading itself, and the scan does not repeat it. `links().areInSection()`'s case/spacing findings are unchanged for a rule with no `inDocuments` scope; a scoped one no longer reports a near miss in a document its scope excludes.

  **Breaking:** a section name given as a `RegExp` with the `g` or `y` flag is read without it (bug 0506's eess-md half). The flag made `.test()` carry `lastIndex` from one heading to the next, so `docs().haveSection(/^Phase \d/g)` skipped every other document, and a table's `section` and `links().areInSection()` likewise. A rule that skipped documents can now report them. To migrate: drop `g`/`y` from section names; nothing else changes. Crossvalidate's own section matcher drops `g`/`y` too since #251; it takes eess-md only as an optional peer, for types, so it does not move because of this change.

- d6978d3: **Breaking:** `honestyAtClose` reports records whose state it cannot read (bug 0444). It used to skip them, so their state/folder check never ran and nothing said so. There are two new findings:
  - `ledger/state-under-another-label`: a record with no `State:` line whose header holds a state from your vocabulary under another label, such as `**Status:** Done`. Pass `aliases: ['Status']`, or `label: 'Status'`, so it is read.
  - `ledger/no-readable-state`: a call in which no document has a state line at all. It is raised once per call. Usually the call covers folders that hold no records (drafts, extractions): narrow the corpus you pass to the record folders, or pass `ignore`.

  `honestyAtClose` and `ledgerStats` take `label` (default `State`) and `aliases`; a blank label is refused. `findState` takes an optional fourth argument, the label names.

  **Breaking:** `corpus()` refuses a root that matches no file, or only ignored files, when another root does load (bug 0465). It throws an `ArchConfigError` naming each dead root. A mistyped root among several used to be dropped without a word, so every rule over the corpus judged less than you named. To migrate, correct the glob or remove the root. A corpus whose every root is dead still loads, and its rules report zero examined units. A root that matches files but no Markdown, such as a code glob, is not refused.

- 7ef8e39: A box mark can be declared `'unjudged'` (bug 0525): `taskItems(c, { marks: { '?': 'unjudged' } })`, and the same for `honestyAtClose()`. An unjudged box is neither open nor done: `honestyAtClose` does not report it as a silent open box, it does not count as finished work, and `areOpen()` and `areChecked()` do not select it. It is still a `taskItems()` element, so a rule selects it by its mark or by `state === 'unjudged'`. Use it for a mark your records use, on purpose, for a box nobody should judge, where `'open'` would demand a disposition and `'done'` would claim work that was never done.

  Only a declaration makes a mark unjudged; an undeclared mark is still `md/undeclared-box-mark`, whose remedy now names `'unjudged'` beside `'open'` and `'done'`. A declaration whose state is not one of the three, `undefined` included, is refused, and `collectTaskItems()` now refuses one too. Additive against the published release: `BoxMarkState`, and the `state` of a `taskItems()` element, gain `'unjudged'` beside the `'open' | 'done'` that `box-marks-are-the-callers` introduces in this same release.

  The remedy states what `'unjudged'` costs: declare it only if the box never blocks a close in any record, because it then leaves every close rule for good. It is never the declaration for unfinished work such as `[~]`, which is `'open'`.

  `collectTaskItems()` reads only the own keys of `marks`, the ones it validated, so a state inherited from the object's prototype is not read: such a mark is undeclared.

### Patch Changes

- 27e7542: A preset given a `report` mode other than `'throw'`, `'return'` or `'warn'` now throws `ArchConfigError` naming the value (bug 0508). It used to print the violations and pass, so a JavaScript rule file or a mode read from config that misspelt `'throw'` exited 0 over real violations. Omitting `report`, or passing `undefined` or `null`, still means `'throw'`.
  - eess-ts's presets (`recommended`, `agentGuardrails` and the rest) refuse the same way, and their message lists `'builders'` beside the other three, since they take it too.
  - eess-md's presets `honestyAtClose` and `adrEnforcement` finish through `finishPreset`, so a misspelt mode now throws there too (`honestyAtClose(c, { report: 'thorw' })` is this bug's reproduction).
  - eess-crossvalidate's bindings that finish through the kernel's `finishPreset` (`scenarioTestsResolve`, `scenariosCovered`, `scenarioExemptionsCurrent`, `scenarioCitationsResolve`, `tableErAgree`) refuse a misspelt mode the same way.

  TypeScript already rejected these values, so a caller whose rule file type-checks sees no change.

- Updated dependencies [e80aeb8]
- Updated dependencies [d6978d3]
- Updated dependencies [94685a7]
- Updated dependencies [9675402]
- Updated dependencies [27e7542]
- Updated dependencies [27e7542]
- Updated dependencies [7ef7a1d]
  - @nielspeter/eess@0.8.0

## 0.11.0

### Minor Changes

- ec60dd4: `parseCodeBlocks` reads a code block's language tag in any letter case

  **Breaking (@nielspeter/eess-md) — a block that was only disclosed is now checked, and an export is
  gone.** Fixes [bug 0426](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0426-parsecodeblocks-and-md-mermaid-read-the-mermaid-tag-differently.md),
  under [ADR-019](https://github.com/nielspeter/eess/blob/main/adr/019-a-code-blocks-language-tag-is-read-in-any-letter-case.md).

  A fence tagged ` ```Mermaid ` or ` ```MERMAID ` is now read as `mermaid`, as eess-crossvalidate
  already read it. Nothing else in the tag is normalised: ` ```mmd ` is not `mermaid`, and
  ` ```json5 ` is not `json`. The caller's side is folded too, so `language: 'JSON'` selects
  ` ```json ` blocks; `ParsedCodeBlocks.language` and `summary()` keep the caller's spelling.

  What changes for you:
  - A block whose tag differed only in letter case used to be skipped and named in `summary()` or the
    zero-examined finding as a near miss. It is now parsed, so a green build can go red on it.
  - A rule that declared `.expectEmpty()` because its corpus's only blocks were capitalised now has
    blocks, and the declaration is reported as expired. Remove it.
  - `NearMissTag` and `ParsedCodeBlocks.nearMisses` are removed, with the near-miss text in
    `summary()` and in the zero-examined finding.

### Patch Changes

- a7420c2: The family loads under Bun again

  Fixes [bug 0439](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0439-the-family-fails-to-load-under-bun-from-eess-0-5-1.md).
  From eess 0.5.1 on, importing most entries under Bun failed at link time with
  `SyntaxError: Export named 'registerHooks' not found in module 'node:module'`, including eess-md's
  `corpus()`, which has nothing to do with the CLI: the kernel imported `registerHooks` by name for the
  CLI's resolve hook, and Bun's `node:module` has no such export. The kernel now imports `node:module`
  as a namespace. All 28 published entries and both CLIs load under Bun 1.4.3, and CI checks that on
  every change (plan 0448). This is a load guard, not a claim: no package claims Bun support yet
  (ADR-020), and Node stays every package's runtime.

- Updated dependencies [a7420c2]
  - @nielspeter/eess@0.7.1

## 0.10.0

### Minor Changes

- b32426a: Add `parseCodeBlocks()` and `codeBlocks()`: every fenced block of one language is checked with a
  parser you name.

  `parseCodeBlocks(corpus, { language, parser, budget })` parses the language's blocks in one batch and
  returns a frozen `ParsedCodeBlocks`. `codeBlocks(parsed)` returns a `CodeBlockRuleBuilder`, and its
  `.should().parse()` is an ordinary synchronous rule over what was parsed. `.that()` narrows it with
  `resideInFile` or `resideInFolder`. eess-md loads no parser itself.
  - **The port.** A `CodeBlockParser` is `{ name, version, canaries, parse(texts, { signal, budgetMs }) }`.
    It returns one `CodeBlockVerdict` per text, `valid`, `invalid` or `unrecognised`, synchronously or
    as a promise. Its `CodeBlockCanary` entries are blocks it must reject.
  - **Failures are never a pass.** Each of these is one unsuppressable finding per rule, with the rule
    id `eess-md: code-block parser`, exported as `CODE_BLOCK_PARSER_INSTRUMENT`:
    - the parser throws;
    - it runs past its `CodeBlockBudget`;
    - it returns a malformed or missing verdict;
    - it answers one of its own canaries wrongly.
  - **Configuration errors throw `ArchConfigError`:**
    - a parser with no name, no version or no canaries;
    - a canary that allows a pass;
    - an empty `language`;
    - a budget a timer cannot hold.
  - **`summary()`** gives "N json blocks parsed with …". After a failure it gives "0 of N … checked"
    with the cause. A tag that matches only when case-folded (`Json` for `json`) is not read. It is
    named there, and in the zero-examined finding when it is why nothing was examined.
  - **The default budget** is `DEFAULT_CODE_BLOCK_BUDGET`: 10 s plus 250 ms a block.
  - **Also exported:** the types `ParseCodeBlocksOptions`, `ParsedCodeBlock`,
    `CodeBlockInstrumentFailure` and `NearMissTag`.

  Additive: nothing that exists changes.

- 9287323: `codeBlocks` holds every code block at any depth, a block in a list item or a blockquote included

  **Breaking (@nielspeter/eess-md) — a check that missed a diagram now reads it.** Fixes
  [bug 0290](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0290-a-code-block-nested-in-a-list-is-never-checked.md).

  `MdDocument.codeBlocks` held the document's top-level code blocks only. A `mermaid` diagram inside
  a list item or a blockquote never reached `eess-crossvalidate`'s `embeddedDiagramsMatchCode` or
  `tableErAgree`: a diagram naming a class the code does not have passed, and the document did not
  count in `embeddedDiagramStats`.

  Now `codeBlocks` lists every code block, in document order, with its fence line. A nested block's
  `value` has the container's markers (`> `, the list indent) removed. If you use the md↔mermaid
  bindings, you may see findings on nested diagrams you were not seeing before; they are real. If you
  read `codeBlocks` yourself, expect the nested blocks too.

  An illustrative diagram you put in a list now counts too. Nesting does not mark a diagram as an
  example. For `tableErAgree`, an earlier `erDiagram` in the document can supply the entity match or
  the line a finding is reported at, as a top-level one already could.

  `@nielspeter/eess-crossvalidate` is named so its changelog records the break: its rules are where
  the new findings appear. Its own code does not change.

- 16a5aec: **Breaking (@nielspeter/eess):** an exclusion comment (`eess-exclude`, `eess-exclude-start` /
  `-end`) is now read only in files the kernel can lex: JavaScript and TypeScript (including Vue and
  Svelte) and Markdown. In any other file, such as `.feature`, `.yml`, `.py`, `.mmd` or `.graphql`, no
  directive is read.

  This fixes a false green (bug 0419). Such files used to be read as if they were JavaScript, so `//`
  text inside a Gherkin doc string or a YAML block scalar, which is data and not a comment, was taken as
  a waiver and suppressed a real finding. Gherkin's own `#` comment was never read either.

  If a build relied on a waiver in one of these files, written with `//` or as `<!-- eess-exclude … -->`, its
  finding now reports again. There is no
  supported waiver syntax for these file types yet. Fix the finding, or narrow the rule's selection.

  Every dialect that reads exclusion comments through the kernel ships this break to its adopters,
  so each takes a minor bump: `@nielspeter/eess-ts` (for findings in files other than code), `@nielspeter/eess-gherkin`
  (findings in `.feature` files, fixed by this), `@nielspeter/eess-mermaid` (`.mmd` files) and
  `@nielspeter/eess-crossvalidate`. `@nielspeter/eess-md` reads only Markdown, which is unaffected; it
  is bumped only because it depends on the kernel.

### Patch Changes

- Updated dependencies [16a5aec]
  - @nielspeter/eess@0.7.0

## 0.9.0

### Minor Changes

- cb336f4: `honestyAtClose` reads a closed state the same way in both of its checks

  **Breaking — a finding that went missing now fires.** Fixes
  [bug 0379](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0379-a-case-variant-across-the-vocabulary-pair-drops-the-placement-check.md).

  With the same token spelled differently in the two lists — `states: ['Draft', 'done']`
  beside `terminalStates: ['Done']` — the placement check read a record's `State: Done` as
  `done`, compared it to `Done` case-sensitively, and treated the record as open. A closed record
  left outside a done-folder lost its `ledger/state-folder-mismatch` finding; one inside a
  done-folder got a false one. The box checks, which read the state against the terminal set
  alone, already answered correctly, so the two halves of the preset disagreed about the same
  record.

  Now the state is read once, against both lists, longest token first, and compared to
  `terminalStates` with case and apostrophe glyph folded — by both checks and by `ledgerStats`.
  That also fixes a declared multi-word state that begins with a terminal token
  (`Done pending review` beside a terminal `Done`), which the box check read as closed.

  If your lists spell a token differently, you may see an orphaned-close finding you were not
  seeing before; it is real. If you use a multi-word state like the one above, a record of it no
  longer has its open boxes checked as a closed record's.

- 8677fd8: `honestyAtClose` and `ledgerStats` refuse `states` without `terminalStates`, and the reverse

  **Breaking.** Fixes
  [bug 0284](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0284-a-declared-vocabulary-disjoint-from-its-terminal-set-turns-the-gate-off.md).

  The two options defaulted independently. Pass `states` alone — which is what
  `ledger/unknown-state`'s advice leads to, "declare the token" — and the default
  `terminalStates` stayed in force, so a closing token you added (`Promoted`, say) was readable
  but never terminal. Its records were never treated as done, their open boxes were never
  checked, and the gate reported a clean pass with a denominator: no finding at all. Pass
  `terminalStates` alone and the mirror happened: the default `Done` stayed a known state that
  no longer closed.

  Now either one alone throws an `ArchConfigError` naming both options and how to keep the
  defaults while adding your own:

  ```ts
  honestyAtClose(corpus, {
    states: ['Draft', 'Ready', 'Open', 'Done', "Won't-do", 'Promoted'],
    terminalStates: ['Done', "Won't-do", 'Promoted'],
  })
  ```

  `docs/markdown.md`'s own example passed `terminalStates` alone, so a config copied from the
  guide is the likeliest to be caught; it passes both now.

  What this removes is the route where a default chose for you. If you pass both and leave a
  closing token out of `terminalStates`, its records are still never treated as done — the tool
  cannot tell that from a token that really does not close, so declare closing tokens there.

  Passing neither, or both, behaves as before — including `terminalStates: []` for a lane where
  nothing is ledger-closed by design. If your config passes only one of the two, it now fails on
  the first run; add the other.

- 2b6f491: `links()` gains `areLabelled(label)` and `areInSection(name)`, which select the links a record
  declares under a label or under a heading:

  ```ts
  links(c).that().areLabelled('Related to').should().resolve().check()
  ```

  A label is read in any of four forms (`**Label:**`, `**Label**:`, `__Label__:`, `Label:`), after a
  list marker, task box or blockquote marker. Walking out from a link through the blocks enclosing it,
  the nearest label decides, so an annotated item (`bug 0402: [b](b.md)`) stays in its declaration. A rule built with either
  selector also reports what it cannot read: a label or heading that misses the declared spelling by
  case or spacing, a different label nested inside the declaration, the label where no block starts
  (mid-paragraph, in a table cell or heading) or in a form it does not read, a declaration holding reference-style links, and a
  correctly spelt label with nothing under it. Each finding names its kind in its element, so one `.excluding()` sanctions one
  kind, and carries its remedy as the suggestion. `MdLink` gains the optional `block`, `blockPath`
  and `sectionPath` fields; the block type `MdLinkBlock` is exported. The ledger's `State:` reader shares the same
  label grammar, with no change in what it reads.

- 3057a31: `links()` gains `beLinkedBack(options?)`, a condition that each selected link's target links back to
  the record that declared it, and `haveLiveTargets(options?)`, a selector that leaves out links into
  frozen records, which cannot answer:

  ```ts
  links(c).that().areLabelled('Related to').and().haveLiveTargets().should().beLinkedBack().check()
  ```

  Any link back answers. A target that cannot — frozen, outside the corpus, missing, a directory, the
  record itself, or an external URL — is one finding naming its cause, with its remedy as the
  suggestion. An empty selection fails with the zero-examined finding. Both take the options
  `resolve()` takes.

- 16f2c1a: `adrEnforcement` no longer resolves cited `it('…')` titles — only cited file paths

  **Breaking.** Fixes
  [bug 0111](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0111-md-adr-citations-resolve-by-prefix.md).

  `adr/citations-resolve` read test files as text and matched a cited title as a **prefix**:
  `it('r')` resolved against any test whose title began with `r`, so a renamed test kept its
  citation green. Making it exact was not enough — read as text, a title in a commented-out
  test, a string or `submit('…')` still resolved, and telling those apart needs a TypeScript
  lexer that a markdown dialect should not carry.

  So `eess-md` now checks only that the file paths a Mechanism cell cites exist. Whether a cited
  title names a real test is answered by `eess-crossvalidate`'s `adrCitationsResolve`, which
  reads the test AST.

  **If your ADRs cite test titles, run `adrCitationsResolve` as well.** With `eess-md` alone,
  nothing verifies a title. Previously something did, wrongly; a citation that only resolved by
  prefix was never checked at all.

- 47236ee: `resolveLink(link, corpus, options?)` is exported: the one resolver `links().resolve()` uses, so a custom rule over links can ask where a link points without re-implementing resolution. It returns a named case — `document`, `not-in-corpus` (with every reason: `not-markdown`, `ignored`, `outside-roots`), `directory`, `missing` (with every candidate tried), `self` or `external` — and never throws. `.resolve()` behaves as before, except that a link with malformed percent-encoding is now reported as broken instead of aborting the run. Plan 0404.

### Patch Changes

- 0660234: YAML front matter is no longer read as a section. A document opening with `---` front matter used
  to report a depth-2 section named with the YAML's own text, which `docs().haveSection()` could
  match and a table's `sectionPath` inherited (bug 0087). Now a line-1 `---` block is front matter —
  a `yaml` node, not a section — when it is a YAML mapping that parses without error and holds no task
  box and no link into the repository. Any other `---` block is read as Markdown, as before, so a
  document that merely opens with a horizontal rule keeps every box and link checked, and front matter
  that is not valid YAML still shows its old phantom section. `terms()`, `pointers()` and the ledger
  read front-matter lines either way. Adds `micromark-extension-frontmatter`, `mdast-util-frontmatter`
  and `yaml`.
- Updated dependencies [b1335f5]
  - @nielspeter/eess@0.6.1

## 0.8.0

### Minor Changes

- 22bd95d: A path glob can name segments above the tsconfig root

  **Breaking (@nielspeter/eess, @nielspeter/eess-ts):** a path glob led by `**/` is now
  matched against a third spelling of each path — the path named from your **repository
  root** (the nearest `.git` or workspace marker above the tsconfig) — as well as the
  absolute path and the tsconfig-relative one.

  **Are you affected?** Yes if your checkout path contains a dot-segment
  (`~/.worktrees/…`, a cache directory, some CI workspaces) **and** any rule spells a
  `**/` glob naming a package directory, such as `'**/apps/api/src/**'`.

  **Find out before you upgrade.** Run your gates on the version you have and count the
  selectors reporting "can never match anything in this project". Those are the rules
  that go live. An adopter measured 61 of them in a dot-directory worktree against 0 in
  a plain one — and, worse, one rule that caught a planted import in the plain run and
  **passed** in the dot run.

  **When you upgrade:** run your gates and **read the new findings before you regenerate
  a baseline.** Regenerate first and you bake the vacuous pass in permanently.

  Fixes [bug 0348](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0348-a-glob-naming-segments-above-the-tsconfig-root-still-dies-under-a-dot-directory.md).
  `'**/apps/api/src/**'` — how a monorepo addresses its own packages — selected
  **nothing** under such a checkout, and the rule **passed**. Neither existing spelling
  could express it: the absolute path carries the checkout's dot-segment, which
  picomatch's default `dot: false` will not let `**` cross, and the tsconfig-relative
  path has `apps/api/` stripped off the front — the very segments the glob names.
  eess-ts 0.8.0 shipped
  [0339](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0339-globs-match-nothing-when-the-project-sits-under-a-dot-directory.md)
  as the fix for this symptom and covered only globs written relative to a package root.

  **What changes for you.** Under an ordinary checkout, nothing: the repo-relative path
  is a suffix of the absolute path and `**` crosses any dot-free segment, so the third
  spelling selects nothing the first did not — measured over a fixture rather than
  argued. Under a checkout with a dot-segment above the repository root, globs that
  silently matched nothing now match, so **a rule that was passing vacuously can start
  failing and a baseline can gain entries.** That is the defect being fixed, and it is
  why this is a break rather than a patch.

  A **project-relative** glob (`'src/**'`) is deliberately unchanged: that spelling means
  "relative to the project root", the project root is the tsconfig's directory, and giving
  it a second root would make one glob name two different directories in a monorepo. Only
  the `**/` spelling, which says "anywhere", reaches above the tsconfig.

  The third spelling is only as stable as your repository root. `.git` absent and no
  workspace marker — a Docker build, a `git archive` tarball, some CI source artifacts —
  resolves the package instead, and the spelling collapses onto the tsconfig-relative
  one. It is only ever additive, so nothing breaks; a rule can select differently in CI
  than locally.

  **API, for anyone building on the kernel:** `PathUniverse` gains two **required**
  fields, `repoRelativeFilePaths` and `repoRelativeParentDirs`, and `viewsFor` gains a
  **required** third parameter saying whether the matcher reads them. Both are required
  rather than optional on purpose — a caller that forgets would get the generous union,
  and a view the matcher has and the universe lacks reports a working rule as one that
  "can never match anything in this project". `viewsFor` ships from
  `@nielspeter/eess/internal`, so an external two-argument call no longer typechecks.

  The four sibling dialects are named at `minor` because they re-export the kernel and an
  adopter may install one of them holding no range on `@nielspeter/eess` at all — a break
  announced only where it happened would reach them as an inherited patch, under a
  changelog reading "Updated dependencies". Nothing in their own behaviour changes.

### Patch Changes

- Updated dependencies [22bd95d]
  - @nielspeter/eess@0.6.0

## 0.7.0

### Minor Changes

- 3ec8082: **Breaking (@nielspeter/eess-md):** `honestyAtClose` reads a record's own `State:` and `Deferred:` lines
  the way CommonMark reads the document, through the markdown parser its task-box pass already uses (bug
  0286). An example of a State line in a code block — fenced with any run of backticks or tildes, or
  indented — is no longer read as the record's own. Before, a closed record showing an example of an open
  one in a four-backtick or four-tilde fence, or an indented block, was not classified done, and every
  silent box on it went unreported. HTML blocks are read as before.

  Two new findings report a record whose State line the parser reads as code, which would otherwise pass
  with nothing checked:
  - `ledger/unterminated-fence` — a fenced code block that never closes and runs to the end of the
    document, so the State line and boxes below it are code. Before, the State line after it was read but
    the boxes, code to the parser, were not, so the record passed with nothing checked. Close the fence
    where the example ends.
  - `ledger/state-in-code` — a document whose header has a `State:` line only inside a code block. Four
    spaces of indent make one: a `State:` line indented that way was read before and is code now, so it is
    reported rather than silently dropped. A `State:` line in a three-backtick fence was already skipped
    before, and the document read as no item; it is reported now too. The gate cannot tell a record from a
    document that only shows the template, so a guide in the lane with a State line in a code block in its
    header reds where it was green: name it in `boardFiles`.

  A green gate may report new findings: silent boxes on records the misreading hid, and the two above.
  Messages of the existing findings are unchanged. `findState(text, vocabulary)` keeps its form and takes
  the parsed tree as an optional third argument; it returns `null` for a State line found only in code.

- 78974f8: **Breaking (@nielspeter/eess-md, @nielspeter/eess-crossvalidate):** `terms()` and
  `scenarioCitationsResolve` set fenced examples aside with the markdown parser instead of a regex (bug
  0287). The regex read a triple-backtick run inside a longer fence as a closer, so it blanked the real
  reference or citation below such an example and read the ones written inside it. Both are corrected, so a
  green rule may report a reference it could not see, and a red one may lose a finding that was an example.

  A fenced example inside an HTML block is set aside however far the block's body is indented, and whatever
  the length of its fence — where the regex set aside a simple one and mis-read a longer one; an indented
  example outside an HTML block is read, as before.
  unclosed, or ended by its list item or blockquote — is read past\*\*, where the regex's behaviour depended
  on whether a later fence happened to pair with it: for `terms()` and `scenarioCitationsResolve` that
  means a reference or citation under such a fence is now checked rather than silently dropped, which can
  add a finding.

  `@nielspeter/eess-md/internal` is a new entry point: family plumbing for eess-crossvalidate and for
  gate scripts, not public API, as the kernel's `/internal` is (ADR-011).

  eess-crossvalidate's `md-gherkin` entry imports `@nielspeter/eess-md/internal` at runtime, so it needs
  the eess-md release that ships it. Its peer floor on eess-md is raised to that release in the release
  commit (`RELEASING.md` step 3a).

## 0.6.1

### Patch Changes

- 14137a6: **Correction: two names on the `@nielspeter/eess-ts` removal list are back.**

  The `0.5.0` entry in this changelog published a list of nineteen
  `@nielspeter/eess-ts` symbols removed from that package's barrel. Two of them —
  `isStrictFamily` and `resolveFlag` — were removed by mistake and are restored.
  The other seventeen are still gone.

  This package itself is unchanged; the bump exists so the correction reaches the
  readers the claim reached. A removal list published in a sibling's changelog has
  no other way to be corrected, because only the package that shipped the fix would
  otherwise bump — the reverse of the rule that makes a breaking change name its
  dependents.

  The full, current list of what left each barrel in `0.5.0`, and which symbols
  still resolve from `@nielspeter/eess/internal`, is in the
  [0.5 migration guide](https://github.com/NielsPeter/eess/blob/main/docs/migrating-to-0.5.md).

- Updated dependencies [bc38ee1]
  - @nielspeter/eess@0.5.1

## 0.6.0

### Minor Changes

- ca4e19b: **Breaking (behavioural):** an ambiguous code pointer is now a violation instead of being skipped

  `pointers().should().resolve()` in `suffix` mode classified a pointer matching
  two or more files as `ambiguous` and returned no violation for it — the source
  comment read "reported elsewhere, never failed". There was no elsewhere: nothing
  counted, printed or surfaced an ambiguous pointer, and it stayed inside the
  denominator the caller reports. In this repo's own corpus that was **16 of 463
  live pointers** sitting inside a summary line reading "all ground in code",
  having grounded in nothing. Two resolved by hand were pointing at the wrong
  file's line and could not have failed.

  An ambiguous pointer now produces a violation naming every candidate and the
  remedy:

  ```
  ambiguous code pointer: "rule-builder.ts:1" matches 2 files
  (packages/core/src/rule-builder.ts, packages/ts/src/core/rule-builder.ts)
  — cite a longer suffix so it names one
  ```

  This matches `@nielspeter/eess-crossvalidate`, which has always reported an
  ambiguous citation as a violation with the same remedy.

  **Why this is marked breaking on a `0.x` minor rather than a patch:** it can turn
  a green build red without the consumer changing a line. If your corpus has bare
  filenames that match several files, `check()` will now fail on them. Three ways
  out, in order of preference:
  1. **Cite a longer suffix** — the message names the candidates, so the shortest
     disambiguating prefix is visible without opening either file.
  2. **Sanction the region** where the citation is deliberately historical:
     `<!-- eess-exclude-start <rule-id>: reason -->` … `<!-- eess-exclude-end -->`.
     **This requires `.rule({ id })` on the chain**, because an exclusion comment
     matches a violation by rule id and a chain without `.rule()` has none — the
     comment is then silently inert, with no diagnostic. So
     `pointers(c).that().areLive().should().resolve().check()` (the form this
     README shows) must become
     `pointers(c).that().areLive().should().resolve().rule({ id: 'my/pointers' }).check()`
     before any sanction takes effect. This prerequisite is not new, but it was
     only ever written down in `docs/violation-reporting.md`, far from the place
     you need it.
  3. **Move that rule to `.warn()`** while you work through them — reports without
     touching the exit code.

  No autofix is attached, deliberately — choosing among the candidates is a
  judgement, and a deterministic rewrite would pick whichever sorted first.
  `exact` mode is unaffected — it never consulted suffix matching, so it cannot
  produce an ambiguity.

  With `externalRoots` configured, a root that **resolves** the pointer still wins:
  an in-repo ambiguity is not evidence about an external checkout. If the roots do
  not resolve it — including when none of them is present on disk — the ambiguity
  is reported, naming the roots that were searched. Those two exits used to skip
  silently and to report a false `not in the repo` respectively; both are fixed
  here and both now have tests.

  `@nielspeter/eess-crossvalidate` is named as a courtesy, not because the gate
  required it: its dependency on `eess-md` is an **optional peer**, and every
  import is `import type`, so `check:release`'s dependents graph (which is scoped
  to real `dependencies`) never asked for it. Its own ambiguous-citation handling
  is separate, pre-existing code. **Nothing about its behaviour changes** — if you
  use crossvalidate, there is nothing here to migrate.

- 48bf698: **Breaking (@nielspeter/eess):** an empty source can no longer be declared away, and it gets its own finding

  ADR-014 §4 states the precedence: "an empty source (`sourceEmpty`) outranks any declaration and names
  the source." The evidence gate honoured `declaredEmpty` before it ever read `sourceEmpty`, so a
  hand-assembled receipt could set both and pass. Measured before this change:

  ```js
  finishPreset(collectResult([], { examined: 0, sourceEmpty: true, declaredEmpty: true }))
  // -> green
  ```

  That is a verdict declaring away a source that loaded nothing — the escape hatch the comment beside
  that branch claimed this ADR had closed. It now reds, and so does the same receipt with `notRun`.

  **New finding id: `emitter/source-empty`.** An empty source previously produced the generic
  `emitter/pass-without-evidence`, whose remedy is "widen the selection, or declare it" — both wrong
  here, because no declaration can make an absent source into evidence. The new finding names the
  source and says so: fix the project, the tsconfig, or the glob. If you match on `ruleId`, this case
  moves from `emitter/pass-without-evidence` to `emitter/source-empty`.

  **The zero-examined message no longer names a preset's option.** It said `expectEmpty: true in a
preset's report options`, which ADR-014 §4 forbids at a seam that is frequently not a preset — the
  same defect that made `checkAll([])`'s remedy unreachable. It now names what a hand-assembled receipt
  can actually do: `collectResult(violations, { examined, declaredEmpty: true })`, or `.expectEmpty()`
  on a builder.

  **Every dialect is named at `minor` because every dialect ships this break.** They depend on the
  kernel, so an adopter installing one of them takes the new precedence without asking — and
  changesets propagates a dependency bump as a patch regardless, which is the release a `^0.x` range
  accepts silently (bug 0185's shape).

  **Both seams, not just one.** `mergeCollectResults` exempted a `sourceEmpty` member from its
  dead-member filter — correct for "did this member say why it contributed nothing", wrong once §4
  makes that answer a fault. Fixing only the gate left the two doors disagreeing about one receipt:
  `finishPreset` reddened it while `mergeCollectResults([thatMember, aHealthyOne])` stayed green. The
  merge names an empty-source member now.

  **`sourceEmpty` can now be contradicted, like every other flag that quiets a zero.** A source that
  loaded nothing cannot have yielded units to examine, so `{ examined: 900, sourceEmpty: true }` is
  `emitter/contradictory-evidence` — it used to be silent. `notRun` and `declaredEmpty` beside evidence
  already reddened; this was the one flag in the vocabulary with no falsifier.

  **The contradiction names the flag it contradicts.** `emitter/contradictory-evidence` hardcoded
  `notRun` in its message, so a contradicted `sourceEmpty` told you to "drop the notRun flag" — one you
  never set. It names the actual flag now, with the matching remedy.

  **Not affected:** every builder-produced verdict. A terminal that loaded nothing already carried its
  own source finding and exits before this gate. The population this changes is the hand-assembled
  receipt, which is what ADR-014's gate exists for.

- 725281f: **Breaking** — the published barrels stop re-exporting 37 internal helpers.

  These were on the entry point but were never API: nothing outside their own
  package's `src/` referenced them, no `docs/` page or README taught them, and every
  test that used one reached past the barrel into the source module already. Measured
  before the change: 253 of 664 exported symbols appeared in no documentation at all,
  and these 37 were the subset that no reader could have found and no consumer could
  have learned to use.

  `eess-mermaid` loses the free predicate/condition functions — `haveNameMatching`,
  `areAbstract`, `notDependOnStereotype` and the rest of that block. The documented
  surface is the fluent builder that wraps every one of them
  (`classes(d).that().areAbstract()`), per ADR-003; the free functions were the
  plumbing behind it. Names like `haveNameMatching` looked documented only because
  `docs/classes.md` and `docs/api-reference.md` are the **TypeScript** dialect's pages
  and the names collide.

  `eess-ts` loses glob-evaluator, disk-set, project-registration and diagnosis
  internals. `eess-md` loses nothing (`presentExternalRoots` was removed and then
  restored — see below).

  Kept deliberately, because "unreferenced in this repo" is not the same as
  "accidental" for a library: `taskItems()` and `TaskItemRuleBuilder` are a builder
  entry point exactly like `docs()` and `links()`, `RowMatchOptions` is a **required**
  argument to `rows()`, and `parseClassDiagram` throws the already-documented
  `MermaidUnitParseError`. Seven more went back on the barrel because removing them
  turned them from undocumented API into dead code, which is a different decision than
  this one — they stay visible as undocumented surface in `check:docs-code` rather
  than being quietly deleted.

  `eess-crossvalidate` is named here because it peer-depends on all three dialects.
  It imports none of the removed symbols and needs no change — but a consumer reading
  its changelog should see the break named, not "Updated dependencies" (bug 0185).

  ## Removed with no replacement — the full list

  These 37 are dialect-local. They were never kernel symbols, so
  `@nielspeter/eess/internal` does **not** have them and no import path reaches them any
  more. If you used one, the fluent builder is the supported route.

  **`@nielspeter/eess-ts` (19)** — FAULT_ADVICE, ON_DISK_ADVICE, buildDiskSet, collectCalls, collectObjectLiteralFunctions, diagnoseGlob, emptyProjectAdvice, fromObjectLiteralFunction, globSitesOf, isDeadGlobTree, isDeadSite, isStrictFamily, isTypeOnlyReExport, loadedNothing, registerProjectRoots, registerRootCompilerOptions, resolveFlag, splitGlobArgs, verbatimModuleSyntaxFor

  **`@nielspeter/eess-mermaid` (18)** — areAbstract, conditionHaveStereotype, dependOn, extendClass, extendName, haveAtLeastOneMethod, haveMemberNamed, haveMethodNamed, haveNameEndingWith, haveNameMatching, haveNameStartingWith, haveNoMembers, notDependOn, notDependOnStereotype, notExist, notExtendStereotype, notHaveStereotype, predicateHaveStereotype

  The mermaid list is the free predicate/condition block in full. Every one is available
  as a builder method (`classes(d).that().areAbstract()`, `.should().notHaveStereotype(x)`)
  — that is the documented surface per ADR-003, and it is unchanged.

  Two eess-ts entries are worth calling out because their siblings survived:
  `collectCalls` went while `fromCallExpression` from the same module stayed, and
  `fromObjectLiteralFunction` went while `fromFunctionDeclaration` and
  `fromMethodDeclaration` stayed. In both cases the survivor is reachable from a
  documented path and the removed one was not.

- 725281f: **Breaking** — the kernel splits into two entry points. Family plumbing moves from
  `@nielspeter/eess` to `@nielspeter/eess/internal` (ADR-011).

  `@nielspeter/eess` had never declared what its public API was. It was implied — the
  union of whatever the five dialects happened to import — so nothing could check the
  boundary, and 78 engine internals sat on the published surface: `shallowClone`,
  `isRecord`, `resetEdgeCoverage`, the glob-tree vocabulary, the suppression and
  edge-coverage counters. Because `check:family` required each dialect to re-export
  every kernel symbol its own source imports, each of those was published again by
  every dialect that touched it.

  **What moved.** 71 symbols now live at `@nielspeter/eess/internal`. If you import one
  from `@nielspeter/eess`, change the specifier — nothing was deleted or renamed.

  If you consume a DIALECT and hit one of these, note that `@nielspeter/eess/internal`
  resolves for you only if the kernel is hoisted to your `node_modules` root. Under
  pnpm's isolated layout or Yarn PnP it will not: add `@nielspeter/eess` to your own
  dependencies. That is a direct dependency the family otherwise does not ask of you,
  and it is the honest cost of reaching plumbing.

  **What did not move**, because "unreferenced in this repo" is not "not API":
  `correspondence` and `CorrespondenceBuilder` (documented on six pages, and the public
  surface of eess-md and eess-crossvalidate), `reportViolations` and `finishPreset`
  (named seams in ADR-008), and the `ArchJson*` types, which describe the `--format
json` output that `docs/agent-integration.md` teaches.

  Also still on the root, and worth naming because an earlier draft of this changeset
  said otherwise: `globNode` and `globAnyOf` (the constructors a user-written
  `definePredicate` needs to declare its globs — a documented extension point), and
  `CorrespondenceOptions`, `RelationSpec` and `KeyBy` (the parameter types of
  `correspondence()` and `preserveRelations()`, both public). **Do not rewrite imports
  of those five to `/internal`** — they are not there.

  **The dialects' surfaces shrink too.** A dialect no longer re-exports kernel plumbing
  it only uses internally, so `eess-ts`, `eess-md` and `eess-mermaid` each drop what they
  used to forward. For those, the rule above applies — the symbol is a KERNEL symbol and
  `@nielspeter/eess/internal` has it.

  **That rule does not cover the 37 dialect-local symbols removed in the same release.**
  Those were never kernel symbols, so `/internal` does not have them and there is no
  replacement path; see the companion changeset for the list and the reasoning.

  Measured at release: the kernel root goes 156 → 86 exports, with 673 scanned across
  the family's published entry points. All 86 root exports are documented; 116
  dialect-side exports are still undocumented and are reported rather than gated — ADR-011 clause 1
  covers the kernel root, and no ruling covers the dialects yet (bug 0220).

  `@nielspeter/eess/internal` is a published, versioned contract — breaking it still
  needs a changeset. What it is not is API: nothing there is taught by `docs/` or a
  README, and a consumer writing rules never names it. That boundary is enforced inside
  this repo and is convention outside it, which ADR-011's Enforcement table records as
  `manual` rather than claiming otherwise.

  **Also in this release, and narrower than it sounds:** `@nielspeter/eess-crossvalidate`
  raises its peer floors on the four dialects from `>=0.1.1` to the versions current at
  release. `>=0.1.1` admitted any dialect ever published, which since the kernel split can
  resolve **two copies of `@nielspeter/eess`** — and the kernel holds module-level state
  (coverage counters, suppression counters, identity collisions, the cache registry), so
  that state splits silently. If you pin an older dialect alongside crossvalidate you will
  now get an `ERESOLVE` instead, which is the point.

- 4fa5e84: **Breaking (@nielspeter/eess):** every builder's `violations()` returns a
  receipt, and the emitters take one.

  [ADR-014](https://github.com/nielspeter/eess/blob/main/adr/014-the-emitter-refuses-a-verdict-without-evidence.md):
  evidence is required at every seam where a verdict leaves eess, not only at the
  terminal. `CollectResult` is now an `ArchViolation[]` carrying `examined`,
  `sourceEmpty` and `declaredEmpty` as own properties. `finishPreset`,
  `reportViolations` and `throwIfViolations` accept and return it.

  **Why this break exists.** A consuming project shipped four corpus gates as
  hand-rolled loops, importing eess's types and its printer and never a
  `RuleBuilder`. Three went inert in one week — a `continue` on a malformed row, a
  counter that fell from 38 compared against 0, a header count compared against
  nothing. Each printed green. The agent that wrote them had been told to use eess
  properly and had a working rule file in the same directory, so neither
  documentation nor example reached it. The seam had to refuse.

  **What breaks for you.**
  - `.violations()` returns `CollectResult`, not `ArchViolation[]`. It is still an
    array — `.length`, iteration, `map`, `filter` and `for…of` are unchanged — so
    most call sites keep compiling. Across this whole workspace the retype produced
    **15 type errors**, which is the measured size of the migration.
  - **`expect(x.violations()).toEqual([])` now fails.** A deep-equal against a bare
    `[]` compares the receipt's own properties too. Use `toHaveLength(0)`, or
    `expect(v.map((x) => x.ruleId)).toEqual([])` to keep asserting identity.
  - A custom builder's `collectViolations()` must return `collectResult(violations,
{ examined })` instead of an object literal. You get one compile error naming
    the member.
  - Handing an emitter a bare array is now a type error, and at runtime a
    configuration finding — `emitter/no-receipt`.

  **Three new unsuppressable rule ids**, the kernel's first hardcoded ones:
  `emitter/no-receipt` (no evidence at all), `emitter/pass-without-evidence` (zero
  examined, zero violations, no declaration) and `emitter/expired-declaration`
  (declared empty, then examined something).

  **A preset that examines nothing now says so**, which is the point and the part
  most likely to redden an existing build. If your corpus legitimately has none of
  a preset's subject — no ER diagrams, no exemptions — declare it with
  `expectEmpty: true`, now on `PresetReportOptions` and therefore on every preset
  in the family. The declaration **expires**: the day the subject appears, it reds
  with `emitter/expired-declaration`. That expiry is what makes it a declaration
  rather than a mute button, and it is why `overrides: { id: 'off' }` is not
  accepted as one — an instruction eess would have to read intent into, and a claim
  nothing can contradict.

  `--format json`'s `summary` gains `examined` (`null` when the caller supplied no
  evidence), because `JSON.stringify` drops an array's own properties.

  The five dialects are named because the break is the kernel's and their
  changelogs should say what changed rather than "Updated dependencies"
  (bug 0185). The four with a barrel — `eess-ts`, `eess-mermaid`, `eess-md` and
  `eess-gherkin` — also re-export the receipt seam, so a standalone consumer of one
  of them never needs a second kernel install to build, merge, report or finish
  one. `eess-crossvalidate` is the exception: it ships flat entry files rather than
  a barrel, and each carries only what its own bindings use, so reaching the
  constructors from there may still need the kernel directly.

- 4fa5e84: **Breaking (@nielspeter/eess):** `presetConstructsNothingViolation` is removed
  from `@nielspeter/eess/internal`.

  It had **no call site anywhere**: not in any of the five dialects, not in this
  repo's scripts, not in a test. Measured before removal — the only occurrence of
  `presetConstructsNothingViolation(` in the workspace was its own definition. It
  was a constructor for a finding nothing constructed, which is
  [bug 0190](https://github.com/nielspeter/eess/blob/main/work/bugs/0190-the-preset-constructs-nothing-finding-cannot-fire.md):
  an id with no producer reads as coverage while certifying nothing.

  **Deleted rather than wired**, and that is the decision worth naming. The obvious
  fix was to give it a caller. It was rejected because the finding it produces
  names `(presetName, optionsHint)` — dialect vocabulary the kernel emitter cannot
  know — and because
  [ADR-014](https://github.com/nielspeter/eess/blob/main/adr/014-the-emitter-refuses-a-verdict-without-evidence.md)
  makes the emitter refuse an evidence-free verdict directly, which reaches every
  hand-assembler rather than only the presets someone remembered to guard. A
  finding with an id and no producer is bug 0190's shape with a label on it.

  The preset-shaped diagnosis it was meant to carry already exists dialect-side and
  is unchanged: `eess-ts`'s `assertEnabled` builds it with its own `ruleId`,
  `bypassFilters` and remedy.

  **Nothing that ran before stops running.** `dispatchRule`, `validateOverrides`,
  `throwIfViolations` and `finishPreset` are untouched, and the `'off'` /
  `'warn'` / `bypassFilters` precedence in `dispatchRule` is unchanged — the test
  pinning it still passes.

  The five dialects are named because they depend on the kernel and this is a
  removed export, so their changelogs should say what changed rather than
  "Updated dependencies" (bug 0185). None of them imported it; none needs a source
  change.

  **New (@nielspeter/eess, @nielspeter/eess-ts):** `EMITTER_CONTRADICTORY_EVIDENCE`
  (`emitter/contradictory-evidence`) joins the three emitter rule ids on both roots.

  It fires when a receipt marked `notRun: true` carries a non-zero `examined` or a
  violation — a rule that never ran can have neither. `notRun` is the flag that
  exempts a member from `mergeCollectResults`'s dead-member filter, so without this
  it was the one thing in the evidence vocabulary that could quiet a zero and could
  not be contradicted. `declaredEmpty` always had its expiry; this is the same
  property for the third state.

  Additive: nothing that was green goes red unless it was already claiming both
  that a rule did not run and that it examined something.

- 99a00d4: **Breaking (@nielspeter/eess, @nielspeter/eess-ts): `throwIfViolations` is removed from the public surface.**

  It is gone from three barrels: the kernel root (`@nielspeter/eess`), the
  `eess-ts` root, and the `@nielspeter/eess-ts/presets` subpath.

  **What to do instead.** The call was a one-line alias for `finishPreset` in its
  default mode, and always had been. Replace

  ```ts
  throwIfViolations(violations)
  ```

  with

  ```ts
  import { finishPreset } from '@nielspeter/eess-ts/presets'

  finishPreset(violations, { report: 'throw' })
  ```

  It is on all three barrels, so the import line does not move wherever you took
  the old one from:

  ```ts
  import { finishPreset } from '@nielspeter/eess'
  import { finishPreset as fromTsRoot } from '@nielspeter/eess-ts'
  import { finishPreset as fromPresets } from '@nielspeter/eess-ts/presets'
  ```

  Behaviour is identical — emit to stderr, then throw one aggregated
  `ArchRuleError`. Taking the option explicitly is the point: you can choose
  `report: 'return'` or `'warn'` at the same seam, which the alias hid.

  On `@nielspeter/eess-ts/presets` that became true in this release: the alias was
  published on that subpath and its replacement never was, so `finishPreset` is
  added there now. If you import from `/presets`, you need this version or later
  for the migration to resolve.

  **Why an alias was worth removing.** Not because it was unsafe — your current
  call is type-correct and always has been. It goes because it was a second name
  for one door, and the name hard-coded a choice that belongs to you: whether a
  preset throws, returns its violations, or warns. `finishPreset` makes that an
  argument you pass rather than a decision baked into which function you call.

  The four dialects take a **minor**, not a patch. They do not use the symbol, but
  they depend on the kernel, so this break reaches an adopter through whichever
  dialect they installed. A patch would not be enough: changesets propagates an
  inherited bump as a patch whatever the config says, and a patch is the release
  your caret range takes without asking, under a changelog reading "Updated
  dependencies". Naming them at minor is the only way you get told.

### Patch Changes

- 725281f: Every package removes `dist/` before it builds.

  `tsc -p` overwrites; it never deletes. A source file that is deleted or moved left
  its `.js` and `.d.ts` behind forever, and `dist/` is gitignored, so nothing showed
  it. Measured before the fix: **36 orphaned `.d.ts`** across the workspace — 34 in
  `eess-ts` — the oldest from plan 0165's engine copy, whose `src/` counterparts no
  longer exist.

  That is shipped output, not a local artifact: `dist/` is what a consumer installs.
  It also silently corrupts any measurement that reads the emitted types — a survey
  of the dialects' public type surface was run against `dist/` during this work and
  answered from files whose source had been deleted.

  `check:integrity` now requires every package that builds to clean first. It checks
  the mechanism rather than scanning for stale files: after this change there are
  never any, and a check that cannot fail is worth less than no check (ADR-009). What
  can still regress is a package added later with no `prebuild`, and that is what it
  catches.

- 8247a3c: Document how to resolve a citation form `adrEnforcement` does not know.

  The preset's citation check recognises a backticked file path and an `it('…')`
  title. A Mechanism cell citing a rule id from your own architecture tool matches
  neither, and three places — the docs page, this README and the preset's own
  docstring — said "compose your own gate" without showing how. A consuming project
  read all three, concluded the dialect could not do it, and wrote fifty lines of
  its own.

  The compose path is two primitives that already ship: `rows()` over the Mechanism
  column, and `correspondence().beComplete({ direction: 'both' })` against the set
  you hold. The docs page gains the worked recipe; `adrEnforcement`'s docstring and
  the README point at it. No code changes. The docstring ships in the published
  types, which is why this is a patch rather than `none`.

- 488931a: Document the corpus listing surface.

  `corpus()` returns a `Corpus` you can inspect — `documents()`, `root`, `fileIndex` — and
  `features()` returns a `FeatureSet` with `root`, `features()` and `scenarios()`. Both were
  public API and documented nowhere: measured before this change, `documents()`, `root` and
  `fileIndex` appeared in **0** files under `docs/` and **0** package READMEs.

  This is what you reach for when a gate passes and you want to know what it passed _over_ —
  a `0` from `documents().length` means the globs matched nothing, not that all is well.

  No code changes; the README that ships with each package gains a section, which is why
  this is a patch rather than `none`.

- 00b7720: Correct the `frozen` documentation: pointers in frozen documents are not examined at all

  `CorpusOptions.frozen` and `MdDocument.frozen` both documented frozen documents
  as ones "whose drift is reported but never failed", and the package README said
  the same in a copy-pasteable example. Measured: the pointer rule selects
  `.areLive()`, so a frozen document's pointers are filtered out before evaluation
  — nothing is reported. Links in frozen documents _are_ still gated, which is the
  half that was always true.

  No behaviour changes. The docs now say what the code does, and point at the
  one-line recipe for the report the old wording implied you already had:

  ```typescript
  pointers(c).that().areFrozen().should().resolve().warn()
  ```

  `.areFrozen()` and `.warn()` both already shipped; they were undocumented, which
  is why the capability read as missing.

- 39517a3: One path-suffix resolver, shared by the dialects that had written it twice

  `eess-md` resolved `path:line` code pointers against the repo's file index;
  `eess-crossvalidate` resolved `.feature` citations against a feature set. Same
  algorithm, same three-way answer (exact / unique suffix / ambiguous), same
  exact-wins precedence — and, after the ambiguity work in bug 0254, the same
  "cite a longer suffix" remedy. Two implementations of one idea.

  `pathSuffixIndex` now lives in the kernel behind `@nielspeter/eess/internal`, and
  both dialects call it. It is pure string work over a list of paths — no
  `ArchProject`, no ts-morph — which is the same argument `PathUniverse` already
  makes for living there.

  **No behaviour changes.** Both dialects' existing tests pass unchanged (119 and
  89, none edited — no test file under either package is in the diff), and the
  messages were already identical. Confirmed independently by differential fuzzing
  old against new over 20,000 generated citations. `eess-crossvalidate`'s
  internal `resolveFeature` is deleted; it was not reachable through the package's
  `exports` map, so nothing an adopter could import has moved.

  One small improvement rode along: `resolveFeature` rebuilt its path list on every
  citation, and the index is built once per binding.

  `@nielspeter/eess` takes a `minor` because `/internal` is a published subpath and
  this adds an export to it. The dialects take a `patch` — they lost private code
  and gained nothing an adopter can observe.

- Updated dependencies [48bf698]
- Updated dependencies [3a68b5c]
- Updated dependencies [8934365]
- Updated dependencies [725281f]
- Updated dependencies [abc5957]
- Updated dependencies [e82c27d]
- Updated dependencies [95bedfb]
- Updated dependencies [725281f]
- Updated dependencies [725281f]
- Updated dependencies [d4e586c]
- Updated dependencies [3c58845]
- Updated dependencies [39517a3]
- Updated dependencies [4fa5e84]
- Updated dependencies [4fa5e84]
- Updated dependencies [99a00d4]
  - @nielspeter/eess@0.5.0

## 0.5.0

> **Upgrading from 0.3.0? Read the 0.4.0 section below as well.**
> 0.4.0 was versioned but **never published to npm** — the last release
> of this package was 0.3.0, so this release carries two minors' worth of
> changes. A `## 0.4.0` heading normally means "a version you already
> have"; here it does not, and some of the changes that will affect your
> build are in it.

### Minor Changes

- 7031427: A rule that selects subjects and asserts nothing about them now fails — bug 0155.

  **Breaking (0.x — minor signals it, not a 1.0 stability claim):** a rule
  written as `.that().<predicate>.should()` with no condition after it used to
  pass in **total silence**. It now produces an unsuppressable configuration
  finding, so a build that was green on such a rule will go red on upgrade with
  no code change of its own.

  That is the fix working. Such a rule cannot fail, so it certifies nothing while
  reading as coverage — the false-green class ADR-009 and ADR-010 exist to make
  unrepresentable.
  - **The guard was unreachable, not merely quiet.** It tested
    `_conditions.length === 0 && _phase === 'predicate'`, and `should()` sets the
    phase to `'condition'` — so for every rule shape the DSL documents it could
    never fire. Even the stderr warning it was routed to never appeared. The
    `_phase` term is gone.
  - **A finding, not a warning**, per ADR-009 rule 1's discriminator: the remedy
    is not optional. There is no state in which "keeps asserting nothing" is
    correct — add a condition, or delete the rule. (`no-silent-catch` and
    `no-empty-bodies` stay `warn` precisely because they carry suppressible false
    positives a reader must judge one by one. This carries none.)
  - **`bypassFilters`**: `error` regardless of `.asSeverity('warn')`, refused by
    `.excluding()`, skipped by diff and baseline. It reports that the rule's own
    instrument is broken, not a fault in what was examined.
  - **A dead selector still reports as a dead selector.** This finding fires only
    when subjects were actually selected; a rule with a dead glob and no
    condition reports the dead glob, the more useful root cause.
  - **Every builder gives the same answer.** `slices()`, `schema()`,
    `schemaFromSDL()` and `resolvers()` carried the identical branch as a stderr
    warning and now fail too, each with its own remedy. Fixing only the kernel
    would have left one DSL with four different answers to the same mistake.

  **Every dialect is named deliberately.** The behaviour change is in the kernel,
  but an adopter installs `eess-ts` (or `-md`, `-mermaid`, …) and reads _that_
  package's changelog. Declaring only the kernel would route this text to a
  package they may not know exists, while their own changelog said "Updated
  dependencies" — the standalone-sufficiency failure `check:family` exists to
  prevent, in documentation rather than code.

  **Migration:** each finding names the rule and both remedies. Add the condition
  you meant to assert, or delete the rule. If a rule was deliberately held as a
  reusable _selection_, keep holding it — the finding fires only when a rule is
  actually executed, not when a selection is derived from.

  Measured before landing: **zero** assertion-less rules across this repo's own
  five gate files, and one affected test — a kernel contract test that was green
  for the wrong reason and is rewritten here to prove its contract directly.

- 5c4a3ec: New kernel re-exports closing real standalone-sufficiency gaps — plan 0089 Phase 1.

  **Fixed (0.x — minor signals the addition, not a 1.0 stability claim):** each
  sibling dialect promises to be a complete tool on its own — a user installing
  only one package gets everything they need, with no second, direct
  `@nielspeter/eess` install. A new `family.rules.ts` dogfood gate
  (`check:family`) now asserts this mechanically, and running it against the
  real repo for the first time surfaced genuine gaps in every dialect:
  - **`@nielspeter/eess-mermaid`** was missing `marksAssertsCardinality` — the
    one kernel symbol `conditions/class.ts` used internally that its own
    `core/index.ts` barrel didn't carry.
  - **`@nielspeter/eess-gherkin`** had **zero** kernel re-exports before this
    fix, despite its own `builder.ts` importing `RuleBuilder`, `Condition`,
    `Predicate`, and `ArchViolation` directly. All four are now re-exported.
  - **`@nielspeter/eess-crossvalidate`** — the family's binding tool, and the
    one dialect with no allowlist exception — had none of its 7 flat entry
    files (`mermaid-ts`, `md-ts`, `md-mermaid`, `files`, `md-gherkin`,
    `gherkin-ts`, `md-mermaid-er`) re-exporting the kernel symbols each one
    imports (`correspondence`, `finishPreset`, `ArchViolation`, `Direction`,
    `Selection`, `ElementInfo`, `PresetReportOptions`). Each subpath now
    re-exports exactly what it itself imports.
  - **`@nielspeter/eess-md`** had **zero** kernel re-exports before this fix,
    despite `rules/ledger.ts`/`rules/adr.ts` using `RuleBuilder`, `Predicate`,
    `Condition`, `ConditionContext`, `ArchFix`, `PresetReportOptions`,
    `PresetBaseOptions`, `finishPreset`, `generateCodeFrame`, `not`,
    `dispatchRule`, `validateOverrides` internally. All now re-exported. Also:
    `correspondence`/`CorrespondenceBuilder` — required by this package's own
    README example (`rows()` + `correspondence()`, the flagship way to bind a
    markdown table to code) but never actually re-exported, so that documented
    example did not compile against `@nielspeter/eess-md` alone; found in
    review, fixed the same way.
  - **`@nielspeter/eess-ts`** gained its whole preset-authoring toolkit
    (`reportViolations`, `dispatchRule`, `validateOverrides`,
    `throwIfViolations`, `finishPreset`, `presetConstructsNothingViolation`,
    `RuleSeverity`, `PresetBaseOptions`, `PresetReportOptions`, `ReportMode`,
    `ReportOptions`) at the package root — a convenience, not a gap fix: these
    were already reachable via the `/presets` subpath, and 0088 already
    ratified "root or presets" as satisfying standalone sufficiency for this
    package. No second install was ever required here.

  **Migration:** none needed — every change here is a new, additive re-export.
  Nothing that worked before stops working.

- 7031427: **Breaking (@nielspeter/eess)** — a second `.should()` no longer discards the
  first assertion (bug 0156, the kernel half). 0.x, so a minor signals it.

  The kernel's `RuleBuilder.fork()` cleared the condition list, so
  `.should().X().should().Y()` silently dropped `X`. A rule that asserted two
  things asserted one, and nothing reported the loss — a false green in the
  engine itself.

  **Read this if you write rules with `eess-md`, `eess-mermaid` or
  `eess-gherkin`.** All three extend the kernel's `RuleBuilder`, so all three
  carried this. On upgrade, a rule spelled with two `.should()` calls starts
  enforcing the assertion it was silently dropping, and **can report violations it
  never reported before**. Those findings were always real; they were being
  discarded. Check each one on its merits rather than re-baselining.

  The dialects are named at `minor` rather than inheriting a `patch` because the
  change is observable in their output (bug 0185).

  **`eess-ts` is named too, and it is the one dialect this does not actually
  change.** It carries its own copy of the builder stack, already fixed, so its
  behaviour is identical before and after. `check:release` required it anyway and
  is right to: the rule reads the dependency graph, and eess-ts really does depend
  on `@nielspeter/eess`, so an adopter of eess-ts would otherwise inherit this
  release as a silent patch. That the declaration over-states what changes _for
  that one package_ is a consequence of the duplication, not of the rule — the
  gate cannot know a dialect quietly stopped using the kernel module it depends
  on. Recorded rather than waived.

  **Why it was one-sided.** `eess-ts` got this fix when plan 0165 copied the
  upstream engine in; the kernel did not, and nothing recorded the split. The
  duplication that allows it is [plan 0188](https://github.com/nielspeter/eess/blob/main/work/plans/0188-unify-the-duplicated-engine-modules.md).

- 121f46b: `honestyAtClose` is now expressed through the builder DSL (`docs()` / `taskItems()`), not raw corpus iteration — bug 0131.

  **Breaking (0.x — minor signals it, not a 1.0 stability claim):** a corpus that
  previously passed `honestyAtClose` silently on a dead or misconfigured selector
  can now fail on upgrade with no code change of its own — this is the same
  "a rule that examines zero units now throws by default" mechanism plan 0088
  landed on the kernel, now reaching this preset.
  - **The header/placement check (`ledger/state-folder-mismatch`) now inherits the fold's fail-closed evidence gate.** Previously `honestyAtClose` hand-iterated the corpus directly, calling no `RuleBuilder`/`TerminalBuilder` — invisible to every kernel-level guarantee, including the zero-examined guard plan 0088 landed. A dead selector (e.g. a `boardFiles` config that absorbed every real document) could pass silently forever. It is now caught by default: an examined-zero header selection fails loudly instead of reading as "nothing to report."
  - **New option `expectEmptyHeaders`.** A corpus that may legitimately hold zero non-board documents right now — a freshly-bootstrapped lane before its first real item is authored — needs to declare this explicitly (it isn't inferrable). Per ADR-010 the declaration expires: the day a real document appears, it must be removed or the build fails on the stale declaration itself.
  - **The two done-item-scoped checks (`ledger/silent-open-box`, `ledger/deferred-none-lie`) are also now protected against a broken selector** — but narrower than the header check: they're guarded against corruption of the specific predicates that scope them (`belongsToADoneItem`, `hasDeferredDisposedBox`), verified by independent sabotage-testing of both, not against corruption of the shared `isDoneItem`/`collectTaskItems` machinery all three checks ultimately depend on. A corpus with an established history (never legitimately zero done-items) should assert that on top, the way `scripts/check-ledger.mjs` now does for this repo's own corpus — see that file for the pattern.
  - Detection logic and messages are unchanged — same regexes, same `findState`/`isDoneItem` helpers, same violation text. Only the iteration mechanism changed; output over the real corpus is byte-identical to before this fix.

  **Migration:** if your own corpus has a lane that may legitimately be entirely board files right now (e.g. a `kit/`-seeded lane before its first item), pass `{ expectEmptyHeaders: true }` to `honestyAtClose` for that lane and remove it once the lane has real content. If a lane's done-item checks previously relied on a silently-broken `belongsToADoneItem`/`hasDeferredDisposedBox`, that's now reported rather than silent — fix the underlying selector.

### Patch Changes

- Updated dependencies [7031427]
- Updated dependencies [7031427]
- Updated dependencies [26f7352]
- Updated dependencies [7031427]
  - @nielspeter/eess@0.4.0

## 0.4.0

### Minor Changes

- 928ce4a: Fold ts-archunit's fail-closed engine into the kernel (plan 0088), porting
  its ADR-008/ADR-009 doctrine as eess ADR-009 (Agent-First Failure Surfaces)
  and ADR-010 (A Pass Is Constructed From Evidence).

  **Breaking (0.x — minor signals it, not a 1.0 stability claim):**
  - **A rule that examines zero units now throws by default.** Previously,
    many rule shapes silently passed when a predicate matched nothing, a
    glob resolved to no files, or a project loaded no source at all —
    indistinguishable from "correctly found nothing wrong." That's now an
    unsuppressable configuration finding (`bypassFilters: true` on the
    violation) unless declared intentional with the new `.expectEmpty()`
    chain method. `.excluding()` and inline exclusion comments cannot
    silence it; ordinary `.check({ baseline })`/`.check({ diff })` filtering
    doesn't either.
    **Migration:** if a rule you own legitimately expects an empty corpus
    right now (mid-migration, a folder not yet populated), add
    `.expectEmpty()` to the chain. Everything else needs no change — the
    new throw only fires where the rule's own instrument was already silently
    broken.
  - **A held selection is no longer mutated by chain methods.**
    `.that()`/`.excluding()`/`.rule()`/`.because()`/`.expectEmpty()` (and
    `RuleBuilder`'s `.addPredicate()`/`.addCondition()`) now return an
    independent copy instead of mutating `this` — a real bug fix (a second
    rule built from a held selection could previously inherit the first
    rule's narrowing/exclusions/id silently). Code that relied on the old
    in-place mutation (holding a builder variable across multiple mutating
    calls and expecting each call's effect to be visible through the
    original reference) will behave differently — correctly. No known
    consumer code does this; it's named here in case any does.
  - **`eess-ts`'s `layeredArchitecture()` preset's `restrictedPackages`
    option now correctly enforces.** It silently under-enforced before (a
    discarded accumulator only worked by accident under the old mutation
    semantics) — an existing ruleset using this option may see new,
    correct violations it was never actually checking for.

  **Unchanged:** predicate/condition semantics and names, rule syntax,
  `// eess-ts:disable` comment syntax, `arch-baseline.json`'s format,
  `ruleId`/`because`/`Fix:`/`Docs:` violation fields, the existing
  `eess-ts` test suite (1961 tests) — only ~13 of which needed updating,
  each because it asserted the old silent-pass as if it were a feature,
  not because any rule-authoring API changed.

  **New, exported from both `@nielspeter/eess` and `@nielspeter/eess-ts`:**
  `CollectResult`, `.expectEmpty()`/`.expectNonEmpty()` (the latter is the
  sharper opposite — it overrides a `.notExist()`-shaped condition's own
  cardinality exemption, reddening if the corpus you declared "must have
  subjects" doesn't), `marksAssertsCardinality`/`assertsCardinality` (the
  extension point for a custom `defineCondition()` to gain the same
  exemption `.notExist()` has), `Matcher`, `BaselineFilter`/`DiffFilterLike`.
  `reportViolations`/`finishPreset` are now also reachable from
  `@nielspeter/eess-ts/presets` for a standalone consumer building a custom
  preset.

  `@nielspeter/eess-md`, `-mermaid`, `-gherkin`, `-crossvalidate` ship no
  source changes of their own in this release — the minor bump tracks the
  kernel's dependency range (their `RuleBuilder<T, P>`/`correspondence()`
  usage inherits the new evidence gate for free) and, per plan 0088's own
  "family boundary" note, is a live capability the moment a consumer
  upgrades: an existing rule in any of these dialects that silently passed
  on an empty corpus will now throw too, not staged behind a later opt-in.

### Patch Changes

- Updated dependencies [928ce4a]
  - @nielspeter/eess@0.3.0

## 0.3.0

### Minor Changes

- 3a4600b: `resolve()` can now resolve a link naming a real directory, even with no index
  file: `LinkResolveOptions.resolveDirectories` (default `false`).

  A link to `./fixed/` (or `./fixed`, no trailing slash — both forms resolve)
  was always reported broken if `fixed/` had no `tryIndex` file inside it, even
  though the directory genuinely exists and GitHub/GitLab render it fine as a
  listing. There was no resolvable shape for "this is a directory" at all —
  `tryIndex` only covers "this directory's page is its index file," a different,
  narrower claim.

  ```ts
  links(c).that().areInternal().should().resolve({ resolveDirectories: true })
  ```

  Directory existence is derived from the corpus's own file index — every
  indexed file's ancestors are known directories — so this costs no new
  filesystem access.

  **Off by default, deliberately.** Widening what "resolves" means is a false
  green waiting to happen: correct for a repo-hosted corpus (GitHub, GitLab
  render any real directory), wrong for a static-site corpus where a bare
  directory with no index is not a page the site would actually serve. Existing
  callers see no behaviour change unless they opt in.

### Patch Changes

- cd0361b: `linkResolves()`'s broken-link message now names the near-miss when the
  target is a real directory: `broken link: "./guide/" does not resolve to a
file in the repo — "docs/guide" is a real directory; this check runs with
resolveDirectories off`.

  Before this, a link to a real directory with `resolveDirectories` off and a
  link to a target that doesn't exist at all reported the identical generic
  message. A corpus that deliberately runs different resolution profiles for
  different regions (a static-site guide vs. repo-hosted markdown, say) gave an
  author no way to tell, from the message alone, which case they'd hit.

  The hint only appears when it's true — a genuinely nonexistent target keeps
  the plain message unchanged — and is computed lazily, only when a violation
  is actually being reported, so a clean corpus pays nothing extra.

- d54b041: Fix `honestyAtClose`/`ledgerStats` silently misreading a `**State:**` line when
  `states` is an empty array — a legitimate config for a lane where nothing is
  ever ledger-closed (a corpus-content vocabulary this repo now uses for its own
  proposals lane, where the review outcome is a separate field, not a second
  `State` token).

  `stateMatcher([])` built its regex's capture group from zero alternatives —
  `()`, a zero-width match that fires at almost any position — so every genuine
  `State:`-shaped line was read as "readable, value `''`" instead of falling
  through to the unreadable-token fallback. Callers passing a non-empty
  `terminalStates` were never affected. A caller passing `terminalStates: []`
  (the only way to trigger this) still got the right answer from `isDoneItem`,
  but only because `[].includes('')` happens to be `false` — not because
  `findState` reported "no known state" for the right reason. `ledgerStats`'s own
  `withReadableState`/`unreadableState` counts were wrong for such a lane: a
  directory full of `State:`-shaped records would report as `withReadableState`
  instead of `unreadableState`, which matters to any caller distinguishing "has
  state-shaped content" from "has content in my declared vocabulary" — exactly
  the distinction a coverage-style check needs.

  Fixed with a one-line guard: an empty vocabulary now never matches, forcing the
  documented unreadable-token fallback for every path. No change to any existing
  caller with a non-empty `states`/`terminalStates`.

## 0.2.0

### Minor Changes

- b8d8517: `honestyAtClose` now actually runs its state↔folder placement check, and lets a
  corpus declare its own `State:` vocabulary (bugs 0118, 0119).

  **Read this before upgrading — the placement check may have been silent in your
  corpus too.** It located the `State:` token by scanning from the top of the
  document and stopping at the **first** `##` heading. The common template puts it
  one heading further down:

  ```markdown
  # Plan 0060: …

  ## Status

  - **State:** Done
  ```

  For any document in that shape the token was never found, so the check returned
  without a word. In the repo this preset was written for, that was **every single
  record** — 55 of 55 with a `State:` line — and the gate reported `0 findings` for
  its entire existence. The region is now the preamble **and the first section**,
  so both shapes are read. Expect placement findings on first run; they are drift
  that was always there.

  **New: `states` and `terminalStates`.** The vocabulary was hard-coded to
  `Draft | Ready | Open | Done | Won't-do`. A corpus with a different one — a bug
  lane closing on `Fixed`/`Rejected`, say — can now declare it:

  ```ts
  honestyAtClose(corpus, {
    states: ['Draft', 'Ready', 'Fixed', 'Rejected', 'Parked'],
    terminalStates: ['Fixed', 'Rejected'],
  })
  ```

  **The value is matched against your declared vocabulary**, not grabbed as the
  next whitespace-delimited run — so `**State: Done**`, `- **State:** Done.`,
  `**State**: Done`, an emphasised `**Done**`, a lowercase `done` and a
  smart-quoted `Won’t-do` all read as the states they obviously are. A colon is
  required, so a prose line like `Stateless rendering is the default` is not a
  state declaration. Multi-word states (`In progress`) work.

  **New finding: `ledger/unknown-state`.** A `State:` token outside the declared
  vocabulary is now reported rather than skipped. Previously an unrecognised token
  looked identical to "no state at all" and disabled the placement check for that
  document silently — a check that stops running without saying so is the failure
  this preset exists to prevent. If you use tokens outside the default set, declare
  them in `states` or correct them; do not expect silence.

### Patch Changes

- Updated dependencies [0385ecb]
  - @nielspeter/eess@0.2.2

## 0.1.2

### Patch Changes

- Updated dependencies [2f219de]
  - @nielspeter/eess@0.2.0

## 0.1.1

### Patch Changes

- Verify the tokenless release pipeline (OIDC trusted publishing + provenance) end-to-end. No API changes.
- Updated dependencies
  - @nielspeter/eess@0.1.1
