# Proposal 021 — a code reference points at the code it names

**State:** Draft — filed 2026-10-27 from dogfooding [plan 0550](../plans/completed/0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md)'s fix on this repository; not reviewed.
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
  text names a symbol (`` `name` (`path:line`) ``, ``[`name`](path#Lline)``) is red when the cited
  line no longer holds the symbol, with the line where the symbol now sits named in the finding.
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

- [Plan 0542](../plans/0542-this-repositorys-record-mentions-are-migrated.md) (this repository's record mentions): a separate migration, built first.
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
