# Proposal 021 — a code reference points at the code it names

**State:** Draft — filed 2026-10-27 from dogfooding [plan 0550](../plans/completed/0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md)'s fix on this repository; reviewed 2026-10-27, Split and sequence, all three asks held (see Review).
**Priority:** High — the records cite code as evidence (an ADR's Enforcement row, a bug's root
cause), and a text heuristic finds most of the citations it can pair already pointing at the wrong
line; in live records, which the gate reads, it passes them.
**Origin:** self-found · the maintainer, 2026-10-27: "if we in the md link to code in our codebase,
the link needs to be real and work; this way we can catch wrong or old code refs".
**Affects:** `@nielspeter/eess-md` (pointers and links into code, and a fix), and likely
`@nielspeter/eess-crossvalidate`, where a Markdown string is already resolved against TypeScript
(`packages/crossvalidate/src/md-ts.ts`).

## Problem

A document cites code two ways: a pointer in backticks, `` `packages/md/src/model/mentions.ts:91` ``,
or a link, `[resolve-link.ts](../packages/md/src/model/resolve-link.ts)`. Today `check:corpus`
checks a live pointer's file exists and its line is in range (`pointers().resolve()`,
`packages/md/src/conditions/pointer-resolve.ts`), and a link's file exists
(`links().resolve()`); a link's `#L42` anchor is not read. Neither checks that the line still
holds what the text says it does. Code moves under its citations, and the citation stays green.

Measured over this repository at `10a71839`, 2026-10-27, by throwaway scripts that were not kept;
the sample's rows are recorded by value in the Appendix:

- **1,618 pointers** in backticks, written as 363 distinct paths (a suffix and the full path count
  apart); **15 links** into code files, none with a line anchor. The corpus cites code by pointer.
- **The heuristic.** A backticked identifier of four characters or more, then at most twelve
  characters, then a pointer to a `.ts`, `.tsx`, `.mts`, `.mjs` or `.js` file: 312 such pairs. The
  cited line "holds" the name when the name occurs in it as text. By that test 87 hold, 221 do not
  (95 in live records, which the gate reads; 126 in done ones, which it leaves frozen), and 4 do not
  resolve.
- **What the heuristic leaves out.** The other 1,306 pointers are ones it did not pair, not ones
  without a name: measured, 8 pairs fell to the length rule, 23 point at `.json` or `.yml` files,
  50 have the name right after the pointer and 89 within sixty characters before it, and 1,136 have
  no name nearby. And "holds" is a substring test, so a pointer at a call or a comment naming the
  code counts as holding: the 87 were not sampled and are an upper bound on correct pointers.
- **A sample of 30 of the 221**, seeded `20261027`, read by a judge on a different model from the
  one that wrote the scripts; s03, s08 and s12 checked by hand. **26 stale** (the pointer was meant
  to locate the named thing and it moved), **4 not locators** (s08, s10, s18, s24: the pointer
  cites a neighbouring thing, or, in s18, is pinned to a commit and so cannot drift). The 4 are what
  a check on this heuristic alone would wrongly red: about one in eight. Of the 26, the judge found
  the intended target once in 22 and nowhere in 4 (renamed or moved: `pointers()` became
  `extractPointers`, `CollectResult` moved to its own file). Not all 22 are declarations: in s04 and
  s06 the target is a call to `edgesOf`, imported but not declared there, and in s25 an `it(…)`
  title. A fix that moves a pointer only to a declaration covers at most 19 of the 26.
- Current examples, each green in today's gate, quoted from
  [ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md) line 309,
  [ADR-011](../../adr/011-the-kernels-public-api-is-explicit.md) line 243 and
  [bug 0113](../bugs/0113-correspondence-drops-rule-suggestion.md) line 36, with where the named
  code is declared now:

  ```text
  `CollectResult` at terminal-builder.ts:29             declared in collect-result.ts:26
  `reachableExportNames` at family-re-exports.mjs:111   declared at line 134
  `buildConditionContext()` at rule-builder.ts:283      declared at line 434
  ```

  The heuristic's own "now at" gave lines 12 and 388 for the first and third: an import and a call,
  the first text match. That is the next section's point about text.

## Existing code survey

- **`pointers()`** (`packages/md/src/model/pointers.ts`, `MdPointerRef`: `path`, `startLine`,
  `endLine`, `raw`, `line`, the path's span) and its `resolve()` condition: **broken** (no file),
  **stale** (the file is shorter than the line), **ambiguous** (a suffix matching several files),
  with an autofix that expands a unique suffix to the full path ([plan 0066](../plans/completed/0066-eess-deterministic-autofix.md)). "Stale" is taken: it
  means past the end of the file. What this proposal adds is a pointer whose line exists and no
  longer holds what it cites — call it **drifted**.
- **`links().resolve()`** checks a link's file and ignores its fragment; **`resolveLink`**'s cases
  carry no line.
- **[ADR-018](../../adr/018-a-string-that-names-code-is-resolved-or-the-rule-says-why-not.md)**:
  a string that names code is resolved against what the checker can see, and resolving to nothing
  is a finding. A pointer beside the name it cites is such a string.
- **`adrCitationsResolve`** (`packages/crossvalidate/src/md-ts.ts:147`) resolves an ADR's cited
  `it('…')` title against the real test AST: the one place the family already checks Markdown's
  claim about code by reading the code. eess-ts reads declarations; eess-md reads text.
- **Text is not enough for the fix.** In the sample's s03, `FOREIGN_HEADER` occurs twice in its
  file, its declaration and a use; a fix counting text occurrences refuses it, one reading the
  declaration moves the pointer to it. And in s04, s06 and s25 the target is not a declaration at
  all (a call, a test title), so a declaration is not the only thing a pointer locates.

## Asks

- **A — a code reference that names its code is checked against it.** A pointer or a link whose
  text names a symbol is red when the cited line no longer holds the symbol, with the line where
  the symbol now sits named in the finding. The two forms are a pointer after the name,
  `` `name` (`path:line`) ``, and a link whose text is `` `name` `` and whose target ends in a
  `#Lline` anchor. (The link form is described rather than written: the docs link test reads an
  indented fence as prose, [bug 0416](../bugs/0416-the-link-test-reads-an-indented-fence-as-prose.md).)

  How a reference names its symbol is the caller's ([ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md)), and a pointer naming nothing stays as
  it is checked today.

- **B — a link into code carries a line and is checked.** A link's `#L42` or `#L42-L48` is read: a
  line past the file's end is red, as a pointer's is, and under ask A its line must hold the name.
  A link is what a reader can click, which the maintainer asked for.
- **C — a fix for a drifted reference.** When the thing it names is found exactly once in the file
  (a declaration, and whatever else a reference may locate, open question 5), the finding carries a
  fix rewriting the line number there; renamed, moved or found more than once, no fix, and the
  finding says which.

## Acceptance criteria

- **Break class:** a pointer whose cited line no longer holds the code it names is red, naming the
  line where that code is now; one whose line holds it is green; one naming nothing is checked as
  today. The sample's four that are not locators (s08, s10, s18, s24) are green: a check that reds
  them reds about one in eight correct references.
- **Break class:** a link with `#L` past the file's end is red; under A, one whose line does not hold
  its text's name is red.
- **Break class:** a drifted reference whose named code is found once carries a fix to that line;
  found more than once, or gone, carries none and says why.
- **Non-vacuity:** a fixture row per break class, the Appendix's 30 rows as the first test rows,
  and this repository re-counted by the built check, with the difference from the heuristic's 221
  explained.
- **Dogfood:** this repository's live drifted references (95 by the heuristic) are fixed or reworded
  before the check gates `check:corpus`.

## Open questions

1. **Where it lives.** eess-md alone reads text and can check a name occurs on the line; finding a
   declaration needs an AST, which eess-ts owns. Ask A's check can be eess-md's, ask C's fix wants
   eess-crossvalidate (md ↔ ts), as `adrCitationsResolve` is. Or one cross-dialect binding for
   both.
2. **How a reference names its symbol.** Adjacency in text (a backticked name within a few
   characters) is what the measurement used; a link's text is cleaner. Whether eess-md offers the
   adjacency reading as a block, or the caller's own predicate supplies the name.
3. **Languages.** This repository cites `.ts` and `.mjs`; adopters cite more. A text check works for
   any file; a declaration-aware fix needs a parser per language.
4. **Pointers to a range.** `path:44-48` holds the name somewhere in the range, or on its first line.
5. **What a reference locates.** A declaration, a call, an `it(…)` title: the sample has all three.
   Which the check accepts as holding, and which the fix moves to, decides how much of the 26 it
   catches and repairs.
6. **Pinned references.** A pointer at a commit (s18) cannot drift; it is read as pinned, never as
   stale.

## Out of scope

- [Plan 0542](../plans/completed/0542-this-repositorys-record-mentions-are-migrated.md) (this repository's record mentions): a separate migration, built first.
- Rewriting this repository's 1,618 pointers as links: a choice for after the check exists.

## Appendix — the sample, 2026-10-27

The 30 pairs drawn from the 221 (seed `20261027`), each with the judge's verdict and, for a stale
one, whether the intended target is found once today. Fenced, so no gate reads it.

```tsv
id	location	name	pointer	verdict	fixable	reason
s01	work/proposals/010-ts-performance-at-scale.md:87	Condition	packages/core/src/condition.ts:94	stale	unique	interface Condition now declared once at line 77; cited globs field moved.
s02	work/proposals/010-ts-performance-at-scale.md:234	resideInFolder	packages/ts/src/predicates/identity.ts:104	stale	unique	resideInFolder function declared once at 116; other hits are doc comments.
s03	work/plans/completed/0214-extract-the-diagram-kind-predicate.md:101	FOREIGN_HEADER	packages/crossvalidate/src/md-mermaid.ts:41	stale	unique	FOREIGN_HEADER const declared at 42; 163 is a use.
s04	work/proposals/010-ts-performance-at-scale.md:270	edgesOf	packages/ts/src/predicates/module.ts:45	stale	unique	Pointer meant the importFrom edgesOf call; the single call is at 44.
s05	work/plans/completed/0235-the-emitter-takes-a-receipt.md:448	honestyAtClose	packages/md/src/rules/ledger.ts:580	stale	unique	honestyAtClose exported function now at 885; other hits are comments.
s06	work/proposals/010-ts-performance-at-scale.md:87	edgesOf	packages/ts/src/predicates/module.ts:45	stale	unique	Same as s04: the edgesOf call in importFrom is at line 44.
s07	work/plans/completed/0456-kernel-notexist-and-dead-glob.md:56	evidenceFloor	packages/ts/src/core/vacuity-diagnosis.ts:309	stale	unique	evidenceFloor function declared at 311.
s08	work/plans/0464-the-dialects-notexist-copies-move-onto-the-kernels.md:126	element	conditions/call.ts:44-48	not-a-locator	n/a	Pointer cites the message-elision helper doc; name element is a field, not what the pointer locates.
s09	work/proposals/007-ts-expose-terminalbuilder-declared-state.md:87	DiagnosableRule	packages/ts/src/core/diagnose.ts:23	stale	unique	DiagnosableRule interface declared once at 30.
s10	work/plans/completed/0165-integrate-the-copied-ts-archunit-engine.md:112	RuleBuilder	packages/core/src/rule-builder.ts:167	not-a-locator	n/a	Pointer cites a RuleBuilder method (.that() doc), not the RuleBuilder class.
s11	work/bugs/0175-kernel-configuration-findings-sit-outside-every-census.md:24	zeroExaminedViolation	packages/core/src/vacuity-findings.ts:24	stale	unique	zeroExaminedViolation function declared at 55.
s12	work/bugs/fixed/0287-four-copies-of-one-fence-lexer-across-three-packages.md:138	pointers()	packages/md/src/model/pointers.ts:37	stale	gone	No pointers() function; renamed extractPointers and fencedRanges holds the cited walk.
s13	work/plans/completed/0456-kernel-notexist-and-dead-glob.md:201	RuleBuilder	packages/core/src/rule-builder.ts:103	stale	unique	RuleBuilder abstract class declared at 104.
s14	adr/010-a-pass-is-constructed-from-evidence.md:309	CollectResult	packages/core/src/terminal-builder.ts:29	stale	gone	CollectResult type now defined in collect-result.ts; here only import and re-export.
s15	work/proposals/007-ts-expose-terminalbuilder-declared-state.md:91	matchedPatterns	packages/ts/src/core/execute-rule.ts:140	stale	unique	matchedPatterns declared once at 149; other hits are uses.
s16	work/plans/completed/0456-kernel-notexist-and-dead-glob.md:523	onDocument	code-blocks.ts:21	stale	gone	onDocument no longer exists in the md source; plan 0457 replaced it with inDocuments.
s17	work/proposals/002-comment-embedded-links.md:248	walk()	corpus.ts:50-67	stale	gone	No walk() in corpus.ts; it now calls walkFiles from the kernel.
s18	work/bugs/fixed/0363-a-remedy-that-cannot-remediate-survives-one-input-over.md:124	TerminalBuilder	packages/ts/src/core/terminal-builder.ts:507	not-a-locator	n/a	Pointer is pinned to commit 91b420a and cites the assertsCardinality method, not the class.
s19	work/proposals/promoted/005-crossvalidate-stale-wip-detection.md:835	COVER_RULE	gherkin-ts.ts:44	stale	unique	COVER_RULE const declared at 187.
s20	work/spikes/0394-the-phase-2-design-for-a-file-aware-baseline.md:402	hasIdentityCollision	packages/ts/src/core/terminal-builder.ts:92	stale	unique	hasIdentityCollision function declared at 94.
s21	adr/011-the-kernels-public-api-is-explicit.md:155	KERNEL_PRIVATE_BEFORE_THE_SPLIT	scripts/lib/kernel-surface.mjs:20	stale	unique	KERNEL_PRIVATE_BEFORE_THE_SPLIT declared at 65.
s22	work/plans/completed/0458-the-examples-gate-a-document-shape-from-public-blocks-only.md:250	langTagComparison	arch.rules.ts:41	stale	unique	langTagComparison const declared at 60; 370 is a use.
s23	work/plans/completed/0458-the-examples-gate-a-document-shape-from-public-blocks-only.md:185	importTargetMatcher	packages/ts/src/core/import-candidates.ts:138	stale	unique	importTargetMatcher declared at 137, off by one.
s24	work/bugs/fixed/0242-a-waiver-on-a-non-anchor-file-silently-does-not-apply.md:62	doctor	packages/ts/src/cli/commands/doctor.ts:110	not-a-locator	n/a	Pointer cites doctor.ts call site of orphanExclusions; name doctor is the command.
s25	work/plans/completed/0455-a-corpus-built-from-text.md:33	Corpus	packages/md/tests/resolve-link.test.ts:169	stale	unique	Test with hand-built Corpus is at line 167 (it title); pointer off by two.
s26	work/proposals/017-md-blocks-to-check-a-documents-shape.md:303	haveUniqueTitles	packages/gherkin/src/builder.ts:21	stale	unique	haveUniqueTitles condition declared at 47; 73-74 are the builder wrapper.
s27	work/plans/completed/0458-the-examples-gate-a-document-shape-from-public-blocks-only.md:419	gateArchOneTagComparison	scripts/check-nonvacuity.mjs:752	stale	unique	gateArchOneTagComparison function declared at 863; 4040 is a table entry.
s28	work/proposals/promoted/005-crossvalidate-stale-wip-detection.md:135	ScenarioTestsResolveOptions	gherkin-ts.ts:13	stale	unique	ScenarioTestsResolveOptions interface declared at 29.
s29	work/proposals/promoted/005-crossvalidate-stale-wip-detection.md:136	ScenariosCoveredOptions	gherkin-ts.ts:18	stale	unique	ScenariosCoveredOptions interface declared at 38.
s30	work/proposals/promoted/004-corpus-content-explain.md:235	gateNode	scripts/check-nonvacuity.mjs:252-286	stale	unique	gateNode function declared at 3938; cited range now unrelated constants.
```

## Review — 2026-10-27

**Ruling: Split and sequence**

Reviewed by the architect, product and enforcement lenses, each on its own survey of the code.
All three said ship with changes. They agree the defect is real, well measured and belongs in a
dialect: neither `@nielspeter/eess` nor `@nielspeter/eess-ts` moves for it, and nothing goes into
the kernel. They also agree the proposal holds three shippable things, not one, and that none is
ready to plan as written. So each ask is disposed on its own, and all three are `Held` on the
conditions below.

### Existing code survey, corrected

- **[Bug 0215](../bugs/0215-pointer-gate-proves-existence-not-aboutness.md) already owns this
  defect**, and the proposal did not cite it. It is a live Draft: the pointer gate proves a line
  exists, not that it is the line being cited, measured over three sweeps. It also holds the design
  fork this proposal skips. A reference can carry a line and a name, which can drift, or a name
  alone, which cannot. And it records that `prettier` broke three corrected line numbers again with
  no human edit. Its Verification boxes for this mechanism are `dropped-on-purpose` on a reason it
  says was measured false.
- **`mentions()` already does most of what a code reference needs.** It reads a caller's pattern
  with named groups and no default, over visible text with inline code included. It carries the link
  a match sits in, a source span for a fix, and findings for what it cannot read
  (`packages/md/src/model/mentions.ts`, [plan 0539](../plans/completed/0539-a-mention-of-a-record-is-a-link.md),
  [plan 0549](../plans/completed/0549-a-link-names-the-record-it-mentions.md) and
  [plan 0550](../plans/completed/0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md)). A third
  scanner for "a name, then a pointer" would duplicate it.
- **`beLinked({ fix })` is the precedent for ask C**, not `correspondence()` and not a new
  crossvalidate join. It takes a kernel `Selection` of targets and a key, and joins through
  `matchSelections`, so eess-md never imports eess-ts (`packages/md/src/conditions/be-linked.ts`).
  `correspondence()` carries no fix and cannot express "anywhere in this range". Adding a fix channel
  to it for one md condition would put a dialect concern into the kernel.
- **`adrCitationsResolve` is related, not a template.** It returns `void` and calls `.check()`
  itself, against [ADR-008](../../adr/008-caller-owns-reporting.md). A crossvalidate entry, if one is
  ever added, returns the builder.
- **eess-ts cannot select variables, and `check:corpus` loads no TypeScript project.** There is no
  root `tsconfig.json`, and `scripts/*.mjs` and `arch.rules.ts` sit in no package project. Of the
  sample's 26 drifted rows, a fix through today's eess-ts reaches about 12, not "at most 19". Five
  targets are `const`s and four are in `.mjs` or root files.

### Placement

- **Ask A** belongs in eess-md, as one opt-in condition that works in any language. The cited line
  holds a name the caller supplies, and a reference with no name is checked as today. The caller
  supplies the reading of the name ([ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md)).
  The adjacency forms ship as an example under `examples/md/`, not as root blocks.
- **Ask C** has a text half in eess-md and a declaration half that takes a `Selection` from the
  caller's rule file. Nothing goes into the kernel.
- **Ask B** stays out of `extractPointers`, because `sectionHolds` reads it and its denominator
  would move.

### Critical (must be settled before a plan)

1. **The relation to [bug 0215](../bugs/0215-pointer-gate-proves-existence-not-aboutness.md)** is
   declared, and its fork is decided: a line and a name, or a name alone. The decision has to meet
   0215's `prettier` finding. A line number moves under the formatter this repository runs, so ask
   A reds the build on every code edit above a cited, named line in a live record. That couples code
   and records in a way the proposal never states. Either the fix ships with or before the gate, or
   the gate warns until it does.
2. **Acceptance criterion 1 cannot be met by a text check.** All 30 sample rows were drawn from the
   221 whose cited line does not hold the name. So any text test reds the four not-locators (s08,
   s10, s18, s24) by construction, and their verdict was a judge's, which is Tier 4, not Tier 1.
   Either the criterion becomes "red, and the remedy is to reword", or the verdict needs a
   declaration span, which only the AST can give. Open question 1 is blocking in practice, not open.
3. **The green side has no break class, and "holds" fails open.** The enforcement lens rebuilt the
   heuristic and classified the lines that hold. 25 of 81 (about 31%) hold on an import, a comment
   or a call rather than where the name is declared. Two hold only as a substring of a longer word
   (`link` in `linksOf`). The proposal measured the false-red rate and not the false-green one.
   Needed: a judged sample of the holders, as for the 221; green-side rows (an import of `X`, a
   comment naming `X`, `X` inside a longer identifier), each red or accepted on purpose by open
   question 5's answer; and a token match, never a substring and never a `RegExp` built from a name.
4. **"Now at line N" from a text search manufactures a false green.** The proposal's own example
   shows it. Text puts `CollectResult` at an import and `buildConditionContext()` at a call. An
   author who follows that rewrites the pointer to the wrong line, and the check then stays green for
   good, the remedy-that-cannot-remediate class of
   [bug 0363](../bugs/fixed/0363-a-remedy-that-cannot-remediate-survives-one-input-over.md). A text
   check says "the cited line no longer contains `X`" and names no single line. Only a
   declaration-aware resolver may say where the code is now.
5. **Zero pairs is a pass.** The drift check needs its own rule id, its own selection and its own
   `examined`, counting named references rather than pointers. Zero examined must be a finding unless
   `.expectEmpty()` is declared, with a `check:nonvacuity` row that empties the pairing and reds
   `check:corpus`. "Has a name" is decided before the condition runs (a predicate or the element
   itself), so a dead pattern cannot hide behind 1,618 pointers.

### Important

- **Tier honesty.** The title claims a Tier-4 judgment, "points at the code it names". Its mechanism
  is a Tier-1 proxy, and the Enforcement row it lands in names the proxy.
- **[ADR-018](../../adr/018-a-string-that-names-code-is-resolved-or-the-rule-says-why-not.md) is not
  a warrant.** It is Proposed ("nothing below binds") and covers the strings a rule is written in,
  not prose. Its exact-name clause resolves to a declaration, which a text-only ask A contradicts.
  The proposal stands on [ADR-009](../../adr/009-agent-first-failure-surfaces.md),
  [ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md) and [bug 0215](../bugs/0215-pointer-gate-proves-existence-not-aboutness.md). No new ADR is needed
  for the building block; the citation form this repository adopts is its own configuration.
- **A resolver that cannot see a file says so.** That covers a file in no project, a language with
  no parser, and an absent external root. Each is a finding where the verdict depends on it
  ([ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md),
  [ADR-016](../../adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md)), never a fall
  back to text and never a pass.
- **The sample becomes frozen fixtures**, through `corpusFromText`
  ([plan 0455](../plans/completed/0455-a-corpus-built-from-text.md)) and a fixture code tree. Read
  against the live tree, the rows would heal themselves as the dogfood fixes the 95.
- **The baseline instrument was not kept.** A reconstruction from the prose gives 300 / 215 / 81 / 4,
  not 312 / 221 / 87 / 4. "The difference from 221 explained" cannot fail until the regex and roots
  are committed.
- **The sample's false-red rate is mostly from documents the gate never reads.** 14 of 30 rows, and
  three of the four not-locators, sit in frozen folders. On the 16 live rows it is 1 in 16.
- **A separate rule id** (e.g. `corpus/pointers-hold`), so the existing
  `eess-exclude corpus/pointers-resolve` sanctions do not silently cover drift. Its rows drive
  `check-corpus.mjs` and assert the message. The summary says how much was drift-checked
  ("K name code"), not "all ground in code".
- **Backwards compatibility.** Ask A is a new condition, never a widening of `pointers().resolve()`,
  which would red adopters' existing rules on upgrade. That makes it an eess-md minor. Ask C's
  declaration half, if it lands in crossvalidate, is a crossvalidate minor.

### Minor

- Ranges: "somewhere in the range" is the reading that does not red a block citation, and it is also
  where fail-open concentrates. A fix shifts the whole range or refuses.
- Precedence: broken, then ambiguous, then past the end, then drifted, with one finding per pointer.
- A fix is offered, never applied by the gate, and its refusals are findings: renamed, moved,
  several, not a declaration, cannot judge.
- "Drifted" spends the family's headline word on one finding. The message should carry the meaning.
  The Appendix's verdict column uses "stale" in a third sense and should say "drifted".
- "Code reference" stays a prose word. The entry points remain `pointers()` and `links()`, and a
  rewrite sketches the call.
- A line fragment, if ask B is built: read only on non-Markdown targets (`#l42` in a `.md` link is a
  heading slug). Accept `L42-L48` and `L42-48`, and treat a malformed fragment as a finding.
- "Found once" (ask C) needs one rule each for overloads, a method name repeated across classes, a
  re-export, and which line a declaration starts on.
- `work/proposals/promoted/` is live under `check:corpus`: four of the 16 live sample rows are there.
  Recorded, not decided here.

### Corrections the proposal committed in itself

- It cited [ADR-018](../../adr/018-a-string-that-names-code-is-resolved-or-the-rule-says-why-not.md)
  as grounding while that ADR binds nothing.
- It did not survey the corpus for its own defect, and so missed
  [bug 0215](../bugs/0215-pointer-gate-proves-existence-not-aboutness.md).
- It wrote acceptance criterion 1 as a Tier-1 break class for a verdict a judge made.
- It asked for the form `` `name` (`path:line`) `` while measuring a different one,
  `` `name` at path:line ``.
- It did not keep the instrument its numbers came from.

### Disposition

| Ask                                                       | Disposition | What would unhold it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — a reference that names its code is checked against it | `Held`      | A rewrite that settles critical items 1–5: the relation to [bug 0215](../bugs/0215-pointer-gate-proves-existence-not-aboutness.md) and its fork; criterion 1 restated (red-and-reword, or a declaration span); green-side break classes on a judged sample of the holders, with a token match; a finding that names no text-found line; its own rule id and denominator with a zero-examined row. The shape is one opt-in eess-md condition with a caller-supplied name, choosing between `pointers()` gaining a name and a `mentions()` condition. Then a re-review of A alone |
| B — a link into code carries a line                       | `Held`      | A corpus that links into code with line fragments (none here: 15 links into code, 0 with `#L`), or the decision to rewrite pointers as links, which is out of scope now. Built as an option, never a change to `links().resolve()`'s verdict                                                                                                                                                                                                                                                                                                                                    |
| C — a fix for a drifted reference                         | `Held`      | A built and its count re-taken; then the text half in eess-md on `beLinked({ fix })`'s `Selection` shape. The declaration half also needs eess-ts to select variables and to see `.mjs` and root files, or it states its reach (about 12 of 26 today) and reports what it cannot judge                                                                                                                                                                                                                                                                                          |

The dogfood migration of this repository's live references is its own plan, as
[plan 0542](../plans/completed/0542-this-repositorys-record-mentions-are-migrated.md) is for mentions, so the
eess-md release does not wait on the records.

**Recommended next step:** rewrite this proposal against this review. Settle [bug 0215](../bugs/0215-pointer-gate-proves-existence-not-aboutness.md)'s fork and
criterion 1 from the measurements, run the judged sample of the holders, and commit the instrument.
Then re-review ask A alone. No plan until A is unheld.
