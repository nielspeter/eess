# Proposal 021 — a code reference that names its code is checked against the code

**State:** Draft — filed 2026-10-27 from dogfooding [plan 0550](../plans/completed/0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md)'s fix on this repository; reviewed 2026-10-27, Split and sequence, all three asks held (see Review). **Rewritten 2026-11-08 against that review, by the coordinator session, at the maintainer's request** ("rewrite Proposal 021"): it settles the review's five critical items from a committed instrument and two judged samples, and asked for a re-review of ask A alone. **Re-reviewed 2026-11-08, Split and sequence** (see the second Review): ask A is split into A1 (eess-md) and A2 (the TypeScript code facts), both held behind one spike. **Spiked 2026-11-08** ([spike 0646](../spikes/0646-what-ask-a1-of-proposal-021-reads-and-judges.md)): it decides the four critical items for A1, so they can be overruled: an opt-in `mentions()` reading that keeps inline-code delimiters (467 of 485 before-form pairs), only the named declaration's doc comment green and never its body (16 of 16 right, 8 of 14 body greens wrong), an eess-md `CodeFacts` contract with coverage per file and the kernel's `sourceEmpty`, and named `.warn()` non-vacuity rows. **Re-reviewed 2026-11-08, Rewrite needed** (see the third Review): the direction holds, but the severity split and the empty-facts finding cannot be built as decided, the contract misses doc-comment coverage and the declaration's end, and A1's plan could not close as scoped; ask A1's section is to be rewritten with those decided, then re-reviewed. **A1 rewritten 2026-11-09** ("Ask A1, rewritten 2026-11-09"): two conditions, each its own rule (`resolveAgainst` for a rename or a move, `holdAtTheirLines` for drift); the facts' emptiness read by the builder; A1 closing on package tests and `check:examples` rows, with this repository's wiring moved to A2's plan; a `CodeFacts` contract with doc-comment coverage and the declaration's end. It asks for a re-review of those decisions only. Asks B and C stay held. The 2026-11-08 text of ask A is kept as Appendix C; the first submission is preserved as Appendix A; the judged samples are recorded by value in Appendix B.
**Priority:** High — unchanged. The records cite code as evidence, a check that the line exists is all the gate gives, and a consuming project has now hit the same defect.
**Origin:** self-found · the maintainer, 2026-10-27: "if we in the md link to code in our codebase,
the link needs to be real and work; this way we can catch wrong or old code refs". 2026-11-08: a
consuming project reported the same defect (below).
**Affects:** `@nielspeter/eess-md` (ask A1: an opt-in `mentions()` reading, two conditions and the
`CodeFacts` contract, a minor), and the source of the code facts it reads (ask A2: eess-ts, or a
helper beside `adrCitationsResolve` in `@nielspeter/eess-crossvalidate`; open question 1).

## Problem

[Bug 0215](../bugs/0215-pointer-gate-proves-existence-not-aboutness.md) owns the defect: the pointer
gate proves a cited file exists and its line is in range, not that the line is the code the sentence
names. This proposal is its mechanism. That bug's deferred boxes move to the plan this proposal
becomes, if it is accepted.

**A consuming project's case, 2026-11-08** (unnamed, as this lane does). A README entry cited a
function by name with a `path:line` pointer. The file and the line resolved, so its gate was green;
the code the entry described had moved into another function, at line 492 of the same file. Only a
human review caught it.

**Measured over this repository at `f5b5469d` (v0.22.0), 2026-11-08,** by
`scripts/measure-code-reference-names.mjs`, committed with this rewrite. It reads the corpus
`check:corpus` reads, through eess-md's own `pointers()`, and pairs a pointer with a name in three
forms: a backticked identifier ending at most 12 characters before the pointer's code span
(`` `name` (`path:line`) ``, `` `name` at `path:line` ``), an identifier after the pointer inside the
same code span ([bug 0215](../bugs/0215-pointer-gate-proves-existence-not-aboutness.md)'s `` `path:line name` ``), and a backticked identifier starting at most 12
characters after it. It matches a name as a whole token, never a substring. For a TypeScript or
JavaScript target it reads the file's AST (ts-morph) for every declaration of the name and its span,
and for what each occurrence on the cited lines is. 9.2 s for the run.

- **2,140 pointers** (1,155 live, 985 frozen); **660 paired with a name**: 457 before, 192 after,
  **0 inside**. [Bug 0215](../bugs/0215-pointer-gate-proves-existence-not-aboutness.md)'s form is not used anywhere. 649 of the 660 resolve to one file in range
  (7 ambiguous, 4 past the end); 643 of the 649 are TypeScript or JavaScript.
- **The cited line holds the name as a token in 148** (88 live) and misses it in **501** (248 live).
  The file still holds it in 423 of the 501.
- **What the AST says about the 148 that hold:** 93 hold it on a declaration of the name, 8 on an
  import, 23 on another use, 22 only in a comment or a string.
- **What it says about the 501 that miss:** 41 sit inside the named declaration's own span (a line
  in its body); 230 have the name declared exactly once elsewhere in the file; 37 more than once;
  189 not at all (a call or an import elsewhere, a rename, or a name the sentence uses as context).
- **Two judged samples of 30**, seeded `20261108` (Appendix B), read by a judge on a different model
  from the one that wrote the instrument:
  - **of the holders:** 26 correct, 3 wrong (the line mentions the name in a doc comment or a string
    while the sentence means the declaration elsewhere: a text check is green on each), 1 a pairing
    the instrument made between unrelated text. Of the 26 correct, **16 cite the declaration and 10
    an import, a use, a line of text or a YAML key**: a check that accepts only the declaration line reds about a third of
    correct references.
  - **of the misses whose name is declared once elsewhere:** 23 drifted (the sentence means the
    named thing, which moved), 6 cite inside or just above it (5 of the 6 cite its own doc comment,
    a few lines above the declaration), 1 cites a neighbouring thing (the name is context).

So a text check is wrong in both directions here: it is green on a doc comment or a string that only
mentions the name, and red on a correct line in the named function's body or doc comment (41 in the
corpus, 6 of 30 in the sample). The first submission's 221 / 87 came from an instrument that was not
kept and a substring match (Appendix A); the review's reconstruction gave 215 / 81. These counts
replace both, from an instrument anyone can rerun.

## Ask A1, rewritten 2026-11-09

This section replaces the 2026-11-08 text from "What the measurement settles" to "Open questions",
which is kept as Appendix C. It decides the third review's four critical items and folds its
important items in as named requirements, each decided so it can be overruled. The figures come
from [spike 0646](../spikes/0646-what-ask-a1-of-proposal-021-reads-and-judges.md)'s instrument
run at `main` f17759a6 (481 before-form AST pairs, 244 live), unless marked otherwise.

### What A1 is

A1 is an eess-md minor. Nothing else moves:

- an opt-in reading on `mentions()`;
- two conditions over the mentions it reads;
- a consumer-side contract for the code facts those conditions are given.

The facts' TypeScript producer is A2, and the wiring of this repository's own gate goes with it.
The kernel does not move.

### The reading

- **The opt-in keeps backticks.** `mentions(corpus, { pattern, keepBackticks: true })` runs the
  caller's pattern over the run's text with inline code's backticks kept, as `MdMentionLink.text`
  already keeps them (`packages/md/src/model/mentions.ts:43-47`). The default reading is unchanged.
- **The groups.** The conditions refuse, at configuration, a pattern without the `name`, `path` and
  `line` groups. `end` is optional. The name-alone form, which no reference here uses, is deferred:
  a pattern whose `line` group fails to capture can never switch a check silently.
- **Each group must sit inside one code span.** A mention whose `name` or `path` group is not
  wholly inside a single inline-code span is not read, and is reported once as unread
  (`md/unread-mention`, the existing finding). This closes the forged-backtick case (1 in 472) that
  `inCode` cannot catch: an escaped backtick earlier in the paragraph shifts the code spans. The
  test runs on the joined text's group offsets (the `d` flag), so it needs no source offsets.
- **Per-group source offsets move to ask C**, the only consumer. The walk's inline code carries
  none (`packages/md/src/model/phrasing.ts:171-172`).
- **What the reading finds.** Through eess-md's own walk, the stock pattern finds 455 of the 485
  before-form pairs (234 of 246 live), as measured by the third review. The 14 it misses have the
  name and the pointer in adjacent table cells, and a match does not cross a cell
  (`packages/md/src/model/phrasing.ts:279`). Those pointers stay checked by `pointers().resolve()`
  as today, and the stock pattern's documentation says so. The rest is mostly member and chained
  calls the pattern does not read (`.expectEmpty()`, `.select({…})`).
- **Dotted names.** A `name` group of `a.b.c` is judged as its last segment, `c`, and the message
  says so. `fs.readFileSync` is judged as `readFileSync`; the qualifier is not checked.
- **The stock pattern ships under `examples/md/`**, never in eess-md's root
  ([ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md)). This is its shape, over this
  repository's own reference form:

```ts
import { corpus, mentions, type CodeFacts } from '@nielspeter/eess-md'

const c = corpus({ roots: ['docs/**'] })
// A name, then its pointer: `pathSuffixIndex` (`packages/core/src/path-suffix.ts:48`).
const NAMED =
  /`(?<name>[A-Za-z_$][\w$.]*)(?:\([^`)]*\))?`(?<gap>[^`\n]{0,12})`(?<path>[\w./@-]+\.[A-Za-z]+):(?<line>\d+)(?:-(?<end>\d+))?`/
declare const code: CodeFacts // hand-built here; eess-ts's producer is ask A2

// The file still holds the name: a rename or a move. Cannot drift under a formatter.
mentions(c, { pattern: NAMED, keepBackticks: true })
  .should()
  .resolveAgainst(code)
  .rule({ id: 'docs/code-names-resolve' })
  .check()

// The cited line still holds it: drift. The caller picks its severity.
mentions(c, { pattern: NAMED, keepBackticks: true })
  .should()
  .holdAtTheirLines(code)
  .rule({ id: 'docs/code-lines-hold' })
  .warn()
```

### Critical 1: two conditions, each its own rule

Severity belongs to the rule, not the finding. `.check()` throws on any finding
(`packages/core/src/execute-rule.ts:403`), and `.warn()` escalates only a configuration finding
(`packages/core/src/execute-rule.ts:440-442`). So the split is two conditions, and the caller gives
each rule its own id and severity. A kernel per-finding severity, or content findings marked
`bypassFilters`, would each be a binding decision taken for one dialect; neither is taken.

- **`resolveAgainst(code)`**, the file condition. A reference holds when its cited file holds the
  name as a fact of any kind: a declaration, an import or a use.
  - **Red** when the file is covered and the name is no fact in it: a rename, or a move to another
    file. It cannot come from a formatter.
  - **Measured: 27 such references (9 live).** That count is the references whose name is not even
    a token in the cited file. A name present only in a comment is also no fact, so 27 is a lower
    bound; the built condition's count replaces it.
  - **The verb.** This takes `fields().resolveAgainst()`'s verb. A name resolved within one cited
    file is narrower than [ADR-018](../../adr/018-a-string-that-names-code-is-resolved-or-the-rule-says-why-not.md)'s
    "an exact name resolves to a declaration", deliberately: the reference names the file, and an
    import or a use there is what it can cite.
- **`holdAtTheirLines(code)`**, the line condition. A reference holds when its cited line holds the
  name as code (a declaration, an import or a use), or lies in the named declaration's own doc
  comment ([spike 0646](../spikes/0646-what-ask-a1-of-proposal-021-reads-and-judges.md)'s S2).
  - **A body line is never green.**
  - **Red otherwise**, as drifted or text-only. Text-only means the cited line holds the name only
    in a comment or a string.
  - **Both classes are line drift**, so both come from a formatter too. Of the old split's 46 live
    error findings, 8 had the name as code within 3 lines, and Appendix B's text-only h02 and h20
    are drift. So they share one rule and one severity.
  - **Measured over the before form:** 117 hold as code, 61 lie in the doc comment, and 276 are red
    (268 drifted, 8 text-only); live 64, 35 and 136.
- **Each condition is complete on its own.** Used alone, neither passes what it cannot judge, so a
  rename is red under both. Used together, it reports under both ids, each true of its own claim,
  and the kernel's deduplication keys on the rule id
  (`packages/core/src/dedupe-config-findings.ts:80`), so both stay. The same holds for every
  not-judged cause below: one finding per cause per rule, since each rule's verdict depends on it.

**The consuming project's case, placed.** Its entry named a function with a `path:line`, and the
code described had moved into another function, on line 492 of the same file.

- If the named function is still on its line, both rules are green. Whether the prose still
  describes it is a Tier-4 judgement and stays out of scope.
- If the named function itself moved, `holdAtTheirLines` reds it.
- If it was renamed or removed, `resolveAgainst` reds it.

### Critical 2: the empty facts are the builder's finding

A condition never runs over an empty selection (`packages/core/src/condition.ts:117`), and with
anything selected `.expectEmpty()` is already red. So the facts' emptiness is read by the builder,
not the condition, in [spike 0640](../spikes/0640-an-input-side-loaded-nothing.md)'s shape:

- **The builder reads the facts from its conditions.** Each condition registers the facts it was
  given on itself, as `declaresSections` registers a section declaration
  (`packages/md/src/model/section-declarations.ts:24`). `MentionRuleBuilder` reads them in its
  `collectViolations` (`packages/md/src/builders/corpus-rule-builder.ts:100`, which it inherits).
- **Facts that loaded nothing** (an empty `coverage`) add a `{ examined: 0, sourceEmpty: true }`
  member, merged by `mergeCollectResults`. That is one unsuppressable finding, which outranks
  `.expectEmpty()` and fires over zero references too.
- **"None of the cited files is covered"** is a configuration finding of its own: "the code facts
  cover none of the N files these references cite; check the facts' roots". It fires only when at
  least one reference is examined. It replaces that rule's per-file not-judged findings, so it is
  the one finding the author reads.
- **A covered file the facts hold no name for** is one configuration finding per file ("the code
  facts cover F but hold no name in it"), reported instead of a red for its references.

### Critical 3: where A1 closes

A1 closes on eess-md's package tests plus one test under `examples/md/` with hand-built facts. Its
`check:nonvacuity` rows run against `check:examples`, which already carries an eess-md row of this
kind (`examples/md-mention-fix-exactly-one`, `scripts/check-nonvacuity.mjs:6317-6320`). Each row
sabotages one mechanism and asserts that the test naming the finding by rule id and severity goes
red, never only that the exit code changed (the trap at `scripts/check-nonvacuity.mjs:1583-1589`):

1. A renamed reference: `resolveAgainst`, at error.
2. A drifted reference: `holdAtTheirLines`, with a message that names the declaration's line.
3. A text-only reference: `holdAtTheirLines`.
4. The doc-comment clause widened to the whole declaration: a body citation must stay red.
5. The coverage check emptied: a reference into an uncovered file must give its not-judged finding.
6. Facts that loaded nothing: the source-empty finding under `.expectEmpty()`.
7. A pattern that examines nothing: the zero-examined finding.
8. A forged backtick: the group outside a code span is reported unread, not judged.

The text-only fixture uses hand-built facts that list no use on the line. Whether a real producer
counts `{@link X}` as a use is A2's fixture: `getDescendants()` counts it, `forEachDescendant()`
does not.

**This repository's wiring is not A1.** The plan that brings A2's facts adds it as its own gate
(`check:code-references`), outside `check:corpus` and `check:fast`, with its own `check:nonvacuity`
rows. The facts cost 3.0 s against `check:corpus`'s 8.6 s, and `check:nonvacuity` runs
`check:corpus` about 52 times. At HEAD that gate would report:

- 9 live renames at error;
- 136 live drifted or text-only references at warning;
- not-judged findings for 12 files (20 live pairs), until they are left out or covered.

The migration ([bug 0215](../bugs/0215-pointer-gate-proves-existence-not-aboutness.md)'s deferred
boxes) is owned there. It also owns the warning's exit: the date `holdAtTheirLines` turns to error
here, or the reason it does not, decided when ask C is.

### Critical 4: the contract

The contract lives in eess-md and is defined on the consumer side, as `MentionFix` is
(`packages/md/src/conditions/be-linked.ts:30`):

```ts
export type CodeFactKind = 'declaration' | 'import' | 'use' | 'doc'

export interface CodeFacts {
  /** For messages: "the code facts from tsconfig.json". */
  readonly label: string
  /**
   * Each covered file, repository-relative and POSIX, as the corpus's file index writes it, mapped
   * to the kinds of fact known for it. Empty when the facts loaded nothing.
   */
  readonly coverage: ReadonlyMap<string, ReadonlySet<CodeFactKind>>
  readonly names: readonly CodeName[]
}

export interface CodeName {
  readonly file: string
  readonly name: string
  readonly kind: 'declaration' | 'import' | 'use'
  /** The line of the name itself. */
  readonly line: number
  /** Declarations only: the declaration's last line. */
  readonly end?: number
  /** Declarations only: where a declaration sits. `member` is a class or interface member, never an object key. */
  readonly scope?: 'module' | 'member' | 'local'
  readonly container?: string
  /** Declarations only: the documentation attached to it. It ends before `line`. */
  readonly doc?: { readonly start: number; readonly end: number }
}
```

- **Data, not a `Selection` or a function.** The facts are not one side of a join, and a
  `Selection.sourceEmpty` beside `coverage` would be two truths about emptiness. As a map, coverage
  can be listed and checked. This departs from the second review's "a `Selection`, the `beLinked`
  precedent" and is recorded as such.
- **`doc` is a coverage kind.** On a file covered without it, a reference that would need the
  doc-comment clause cannot be judged, rather than reading as drift. Without the kind, a producer
  with no doc spans (ctags, a regex) reds every correct doc-comment citation: 61 of the 103
  span-greens here, 35 of them live.
- **A `doc` span that does not end before its declaration's line** is a configuration finding of the
  facts, once per name. A whole-declaration span would bring the body-green rule back. So would a
  file-header `/** */`, which ts-morph attaches to the first declaration, whose start is then
  line 1.
- **A declarations-only producer.** On a file covered without `use` or `import`, a cited line that
  holds the name as a token in its text cannot be judged. That is a finding which fails `.warn()`
  ([ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) clause 5), never a
  pass and never "never a red", as [spike 0646](../spikes/0646-what-ask-a1-of-proposal-021-reads-and-judges.md) had it. A line without the token is judged red from
  the text: the token's absence proves the use's absence.
- **Kind of finding.** The not-judged findings are the
  [ADR-016](../../adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md) and
  [ADR-009](../../adr/009-agent-first-failure-surfaces.md) kind, raised by a condition, not [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)'s
  predicate machinery. They are marked `bypassFilters`, so `.excluding()` cannot drop them
  (`packages/core/src/execute-rule.ts:60-68`).
- **No eess-ts import.** eess-ts cannot import eess-md (the `eess/ts-isolated` rule in
  `arch.rules.ts`), so A2's producer satisfies the shape structurally. A typecheck binds the two:
  `examples/cross-dialect.md-ts.test.ts` assigns the producer's output to `CodeFacts`, and it
  compiles under `check:examples`. That holds wherever A2 lives.
- **The producer's obligations**, written in the type's doc and pinned by A2's fixtures:
  - `{@link X}` is never a use;
  - `doc` is the attached doc comment only, never leading trivia;
  - `line` is the name's own line;
  - `member` never means an object-literal key.

### Important items, decided

- **Paths resolve once, as the pointer gate resolves them.** A1 extracts one shared path
  classifier out of `pointerResolves` (`packages/md/src/conditions/pointer-resolve.ts`), with its
  external-roots skip turned into a not-judged cause. Both conditions use it before they look up a
  fact.
  - A pointer that is broken, ambiguous or stale (past the end; the family's existing word) is
    reported by each condition under its own id, so a condition used alone never passes it.
  - Beside `pointers().resolve()` that is a second report under a second id. The changeset says so,
    and says that existing `corpus/pointers-resolve` waivers do not cover the new ids.
  - Precedence on one reference: broken, ambiguous, stale, then the condition's own verdict. One
    finding per reference per rule. The element carries the name and the pointer, so findings on
    one line do not collide (52 lines here carry more than one pair).
- **The remedies send the author to the right fix, never to a line that goes green while wrong**
  ([bug 0363](../bugs/fixed/0363-a-remedy-that-cannot-remediate-survives-one-input-over.md)'s class):
  - Declared once at `module` or `member` scope: "the cited line does not hold `X`; `X` is declared
    at line N. Cite line N if the sentence means the declaration, or the line of the use it
    means." Never "move the pointer to N".
  - Only imported or used in the file: "`X` is imported here and declared in another file; cite
    that file". No line is named.
  - Declared more than once, or only as a local: "declared K times (in `container`…)" or "declared
    only inside `container`", and no line.
  - A body line: "the cited line lies inside `X`'s body (lines N–M); name the inner thing, or cite
    line N". This uses the declaration's `end`.
- **A range is judged by its first line.** It holds when its first line holds the name as code or
  lies in the named declaration's doc comment.
  - Over the before form there are 64 ranged pairs. 24 hold on some line, and 9 of those on the
    first.
  - The rule [spike 0646](../spikes/0646-what-ask-a1-of-proposal-021-reads-and-judges.md) decided ("any line") hides drift: the third review found
    `SIBLING_NOT_CONSTRUCTORS` cited at `scripts/vacuity-matrix.mjs:562-569` and declared at line 428.
  - The 15 ranges that newly red get the message "`X` is at line M, inside the range; start the
    range there". This reopens [spike 0646](../spikes/0646-what-ask-a1-of-proposal-021-reads-and-judges.md)'s decision 3. None of the 15 was judged, so it is
    decided from the mission: a range is where a reader lands.
- **Leaving a file out is a selection.** A caller leaves out references into files the facts do not
  cover with `.that().satisfy(…)` over the mention's `path` group, the kernel's own composable
  predicate. The rule's `examined` then shrinks honestly, and the success line counts what it
  judged.
  - No condition option and no receipt field is added, since the receipt has none for "left out"
    (`packages/core/src/collect-result.ts:28-32`).
  - The stock example shows the predicate. This repository's gate prints its own "left out" count.
- **The disputed doc-comment rows stay green.** Rows s14 and s28 of
  [spike 0646](../spikes/0646-what-ask-a1-of-proposal-021-reads-and-judges.md) (Appendix B's m22 and
  m10) cite a doc comment's closing line, with the declaration on the next line. S2 makes them
  green by its stated guarantee, "lies in `X`'s own doc comment", which is what the rule claims and
  all it claims. The judged figure is about 20 of 22, with two disputed.
- **Tier.** Both conditions are Tier 1 (static). They prove that a line or a file holds a name as
  code, not that the sentence describes it.

## Acceptance criteria

- **Break classes, at their rule's severity in the example's test:**
  - a rename and a move: `resolveAgainst`;
  - drift, text-only, a body line and a range that holds only after its first line:
    `holdAtTheirLines`;
  - broken, ambiguous and stale pointers: each condition, under its own id.
- **Not judged:** an uncovered file, a file covered without the kind its verdict needs, and a file
  under an external root. Each is one finding per cause per rule, failing `.warn()`.
- **Configuration findings:**
  - facts that loaded nothing (outranking `.expectEmpty()`);
  - facts that cover none of the cited files;
  - a covered file with no names;
  - a `doc` span that does not end before its declaration;
  - a pattern without the `name`, `path` or `line` group.
- **The green side as fixtures:**
  - Appendix B's 26 correct holders;
  - the 16 doc-comment rows of [spike 0646](../spikes/0646-what-ask-a1-of-proposal-021-reads-and-judges.md)'s sample, including the two disputed ones, recorded as
    such;
  - an import line;
  - a use line.
- **Evidence:** `examined` counts references read, and zero examined is a finding unless declared.
- **Non-vacuity:** the eight `check:examples` rows above, each asserting rule id and severity.
- **Fixtures are frozen:** they are built through `corpusFromText`
  ([plan 0455](../plans/completed/0455-a-corpus-built-from-text.md)) with hand-built facts, so no
  migration can heal them.
- **The instrument reconciles.** Run over this repository with hand-built facts from the
  instrument's own AST read, the built conditions' counts per class equal the instrument's, with
  every difference listed as a count and a reason.

## Open questions

1. **Where the code facts come from (A2)** stays the author's, as before. Rewriting A1 adds only a
   constraint: the producer is held to `CodeFacts` by a typecheck in `examples/`, wherever it
   lives.
2. **The names** are this rewrite's choices, made from the family's vocabulary so they can be
   overruled before they are pinned:
   - `keepBackticks`;
   - `resolveAgainst` and `holdAtTheirLines`;
   - `CodeFacts`, `CodeName` and `coverage`.

## Out of scope

- Asks B and C, held. C now also owns the per-group source offsets.
- The name-alone form, deferred, and references in adjacent table cells, which are not read.
- Whether the prose describes the code: Tier 4, human review.
- This repository's wiring and migration, which belong to the plan that brings A2's facts.

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

## Review — 2026-11-08, ask A, after the rewrite

**Ruling: Split and sequence**

Re-reviewed by the architect, product and enforcement lenses, ask A only, each on its own survey;
asks B and C were not re-reviewed and stay `Held`. All three reran the instrument and got every
count in the rewrite exactly (9.4–9.8 s at `6eaf0122`); the enforcement lens also redrew both seeded
samples and matched Appendix B row for row. They agree the case holds, the kernel stays untouched,
the code facts arrive as a `Selection` (the `beLinked` precedent), and checking against the AST
rather than text is right. They also agree ask A is not ready to plan: the reading it sketches
examines nothing, its new green side was counted and never judged, and it holds two shippable
things. So ask A is split into A1 and A2, both `Held` behind one spike.

### Existing code survey, corrected

- `mentions()` (`packages/md/src/builders/mentions.ts:233`) and `beLinked({ fix })`'s `Selection`
  (`packages/md/src/conditions/be-linked.ts`) are as the survey said. crossvalidate's reads through
  eess-ts are at `md-ts.ts:116` and `gherkin-ts.ts:92`.
- **`mentions()` cannot read the reference the instrument measured, as built.** It joins inline code
  without its backticks (`packages/md/src/model/phrasing.ts:171-172`), so the rewrite's `NAMED`
  pattern, anchored on backticks, examines 0 references: measured by two lenses independently, on a
  `corpusFromText` corpus and on this repository's (where it failed red, by the zero-examined
  finding, so the evidence floor did its job). Without backticks a pattern pairs prose words (2,108
  matches here, names like `type`, `that`, `in`). `inCode` says only that some part of the match is
  code, so a caller cannot require the name to be. A match that crosses an inline-code edge has no
  source span (`packages/md/src/model/mentions.ts:193-207`), so ask C could not write a fix from it.
- **Nothing in eess-ts gives the code facts.** It selects classes, functions (arrow functions
  assigned to `const`s among them) and types, not plain variables, members, identifier occurrences
  or doc-comment spans. Genuinely new.
- **The join that fits exists:** `matchSelections` keyed on file and name, with the line and span
  test inside the condition. `correspondence()` does not fit, as the rewrite said.

### Placement

- **A1, in eess-md, additive:** the reading, the condition, and a contract for the code facts,
  usable from any language with hand-built facts. Nothing in the kernel.
- **A2, the TypeScript code facts.** Open question 1 stays the author's, with a constraint both
  lenses measured: [ADR-007](../../adr/007-isolate-ast-engine-boundary.md) confines ts-morph to
  eess-ts, and eess-ts's public API exposes none of the facts, so a crossvalidate helper can only be
  built over something eess-ts newly exposes. The architect would put the producer in eess-ts (a
  builder with `.select()`, an eess-ts minor); the product lens would put it in
  `@nielspeter/eess-crossvalidate/md-ts` beside `adrCitationsResolve`, promoting it when a second
  consumer appears. Either way the kernel does not move.

### Critical (settled in a spike before any plan)

1. **The reading.** Choose and measure it against the instrument's 649 pairs: an opt-in `mentions()`
   reading that keeps inline-code delimiters (`MdMentionLink.text` is the precedent) and gives each
   named group a source offset, or a name read around a `pointers()` element. The default reading
   must not change, or every existing `mentions()` caller breaks. Measured today, the sketched
   pattern and the instrument agree on 294 of 649 rows: the counts the rewrite rests on, and its 336
   to migrate, describe a population the sketch would not examine.
2. **The span clause is an unjudged green side, and it fails open in containers.** It turns 94 of 497
   AST misses green (54 live): 41 by the body and 53 by the doc comment. The rewrite said 5 for the
   latter, which is the sample's count, not the corpus's. None of the 94 was in a judged pool (the
   misses pool excluded them by construction). The enforcement lens hand-checked 16 of the 41 and
   found 3 or 4 drifted inside the container they name, which the rule passes. One is a live ADR:
   [ADR-024](../../adr/024-a-claimed-files-waivers-are-read-from-its-registered-text.md) line 15 cites `fs.readFileSync` in `applyFilters` at `packages/core/src/execute-rule.ts:150`, now line 184. A class or a
   300-line function is green on every line of its body: `RuleBuilder` spans 49–524. Needed: a
   seeded, judged sample of the span-greens; a rule for containers (the innermost enclosing
   declaration, a member name for a class or interface, or a bound); and the guarantee stated as it
   is, "the cited lines lie inside `X`".
3. **The code facts' contract.** A kernel `Selection` cannot say which files it covers, so a covered
   file where the name is absent looks like an uncovered one, and a source that knows declarations
   but not uses (ctags, for a project without TypeScript) reds every use line (10 of the 26 correct
   holders). Needed: an eess-md contract type, defined consumer-side as `MentionFix` is, carrying the
   symbols and what each file is covered for; and a facts input that loaded nothing as one finding
   that outranks `.expectEmpty()`, the [spike 0640](../spikes/0640-an-input-side-loaded-nothing.md) shape.
4. **Non-vacuity under `.warn()`.** A condition that examines every reference and returns nothing
   stays green in `check:corpus` (a warning never reds) and in `check:nonvacuity` (its one named row
   is zero-examined). `scripts/check-nonvacuity.mjs:1583-1589` already records this trap. Needed:
   rows that plant a drifted, a text-only and a renamed reference and assert each finding by rule id,
   message and severity, the drifted one its "declared at line N", and a row whose facts load
   nothing.

### Important

- **"Wrong 2 in 60" is a hand tally.** The rule run over Appendix B disagrees with the judge on 6
  rows (h30 and m24 false red; h01 not judged, which [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) makes red; m10, m22 and m02 green while
  judged drifted, m02 being the judge's error, inside `fencesInHtml`'s own doc comment). So 3 to 5
  against 11 for text: still a clear improvement, computed and stated over two of five strata only.
  The not-declared stratum (189) is mostly pairing artefacts of the `after` form (5 of 8
  spot-checked).
- **"Not judged"** is one finding per cause, unsuppressable and failing `.warn()` ([ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)
  clause 5), not one per reference; it reds this repository even while drift warns. With the package
  tsconfigs it reaches 33 live pairs (`scripts/`, root files, `.github/`, `package.json`), not 6. A
  pattern that leaves them out is an exclusion, declared and counted ("K judged, U not judged, E left
  out").
- **One resolver and the precedence.** Paths resolve as `pointers().resolve()` resolves them (the
  kernel's `pathSuffixIndex` over the corpus's file index), then look up the facts; resolving against
  the facts' file list can judge an ambiguous suffix against the wrong file (`execute-rule.ts` is in
  two packages). Broken, ambiguous, past the end, then drifted, one finding per pointer.
- **"Declared at line N" can name a local or an object key** (16 of the 230 single declarations), so
  following it can land on the wrong declaration and go green: [bug 0363](../bugs/fixed/0363-a-remedy-that-cannot-remediate-survives-one-input-over.md)'s class, in AST form. Name a
  line only for a module-scope declaration or a class or interface member, carry the enclosing name
  from the first release (58 pairs name something declared more than once), and say "imported at
  line N, declared elsewhere" for an imported name.
- **A doc comment needs a definition.** Only `/** */` attaches; `{@link X}` is an identifier under
  one AST walk and not another, which would turn the text-only red green. Pin that JSDoc identifiers
  are not code, and which clause wins when a mention sits in `X`'s own doc comment.
- **An optional capture group switches the verdict.** Whether `line` captured decides between "the
  lines hold it" and "the file declares it once", so a pattern whose line group fails to capture gets
  the weaker check silently. Make the form explicit (an option, or two conditions). The product lens
  would keep one pattern with an optional line and drop `` `path#name` `` (a fragment, and
  `beLinked`'s writer refuses `#` in a path); the architect would defer name-alone. The author
  decides.
- **The `.warn()` stance has no exit.** Ask C is `Held` with no home, so drift would be caught only by
  a human here. Only in-file drift is coupled to `prettier`; a rename, a move and a text-only mention
  are not. Gate those at error, and the name-alone form, which cannot drift; give the warning a dated
  home.
- **Cost in `check:fast`.** Parsing every file is 1.55 s and 360 MB here (1,290 files, no type
  checker); `check:corpus` loads no TypeScript project today and runs in `check:fast` and in many
  `check:nonvacuity` rows. The plan states the measured delta.
- **Ranges** (92 pairs): decide "a range wider than its declaration" and add a fixture.
- **The consuming project's case:** say which break class it is in, and whether A1 reds it (green, if
  the named function is still on its line). Its names (`judgeTargets`, line 492) are the consumer's,
  so the sketch should use this repository's own cases, as PROPOSALS.md asks.

### Minor

- Naming: reject `holdTheirCode` (a mention holds no code). Candidates: `.should().resolveAgainst(code)`
  (reusing `fields().resolveAgainst()`'s word), or `nameWhatTheyCite`; `codeSymbols(project)` for the
  facts, keeping the kinds `declaration | import | use`.
- A pattern without a `name` or `path` group fails when the rule is configured. Findings on one line
  collide on `relPath:line` (52 lines carry more than one pair): put the name and pointer in
  `element`. The stock pattern ships under `examples/md/` with hand-built facts
  (`arch.rules.ts:192-199` lets it import only eess-md); the TypeScript wiring in
  `examples/cross-dialect.md-ts.test.ts`.
- One sentence on [ADR-018](../../adr/018-a-string-that-names-code-is-resolved-or-the-rule-says-why-not.md)'s
  scope: accepting an import or a use differs from its "an exact name resolves to a declaration".
- Arithmetic: 660 paired, 649 resolved, so 457 + 192 counts the resolved; 93/8/23/22 sums to 146 and
  41/230/37/189 to 497, the AST pairs. "Any difference is explained" cannot fail; make it a count
  reconciliation with a listed delta. The file's slug still says "points at the code it names".
- Instrument defects for the spike to fix: a backticked path paired as the name `ts` or `md` (14
  rows); a name written with arguments dropped; 39 pointers paired twice; a silent `catch` that
  would reclassify a parse failure; `DECL` omits parameters, binding elements, named function and
  class expressions and type parameters.

### Corrections the rewrite committed in itself

- It chose `mentions()` without measuring it, though the review had asked it to choose between that
  and `pointers()`: the sketch examines nothing.
- It gave the doc-comment greens as 5, the sample's count, not the corpus's 53, and called the 41
  body-span greens "measured" when they were counted and never judged.
- Its "wrong 2 in 60" was a tally, not the rule run over the rows.
- Its sketch used the consuming project's names.
- It counted the forms over the resolved pairs and gave the total as 660.

### Disposition

| Ask                                                              | Disposition | What would unhold it                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A1** — the reading and the condition, in eess-md, any language | `Held`      | One time-boxed spike settles critical items 1–4: the reading chosen and measured against the 649 pairs; a judged sample of the span-greens and a container rule; the facts contract with coverage and an empty-input finding; the `.warn()` non-vacuity rows named. Then a re-review of A1 |
| **A2** — the TypeScript code facts                               | `Held`      | Open question 1 decided under [ADR-007](../../adr/007-isolate-ast-engine-boundary.md)'s constraint, with the element shape (enclosing name, module scope, JSDoc span) and the measured `check:corpus` cost                                                                                 |
| **B** — a link into code carries a line                          | `Held`      | Unchanged from the first review                                                                                                                                                                                                                                                            |
| **C** — a fix for a drifted reference                            | `Held`      | Unchanged; it now also needs A1's group offsets                                                                                                                                                                                                                                            |

**Recommended next step:** a spike, about an hour, on the four critical items, with the instrument's
defects fixed. Then re-review A1, and A2 once open question 1 is decided. No plan until A1 is
unheld; A1 and A2 then release together as one adopter batch.

## Review — 2026-11-08, ask A1, after its spike

**Ruling: Rewrite needed**

The architect, product and enforcement lenses re-reviewed ask A1 against
[spike 0646](../spikes/0646-what-ask-a1-of-proposal-021-reads-and-judges.md), each with its own
survey. Ask A2 was argued, not settled, and asks B and C were not reviewed. Two lenses reran the
instrument and got the spike's counts (10.5 to 11.1 s a run); the enforcement lens redrew the span
sample row for row. All three agree on the direction:

- **R1 over R2.** Reading through `mentions()` needs no second scanner.
- **S2 is well judged.** The judged sample supports making only the named declaration's doc
  comment green.
- **Placement.** The kernel does not move, and the contract is consumer-side in eess-md.

All three also agree A1 is not ready to plan. Two decisions cannot be built as written, and the
contract misses facts its own verdicts depend on. None of this needs a new spike: the author
decides it in this proposal's text, against the numbers below. The proposal's Ask and Acceptance
criteria also still describe the rule [spike 0646](../spikes/0646-what-ask-a1-of-proposal-021-reads-and-judges.md) rejected (body lines green, lines 161-162), and
the plan would build from that text. So the ruling is a rewrite of ask A1's section.

### Existing code survey, corrected

- **Severity belongs to the rule, not the finding.** `.check()` throws on any finding
  (`packages/core/src/execute-rule.ts:403`). `.warn()` escalates only a `bypassFilters` finding
  (`packages/core/src/execute-rule.ts:440-442`, through `severityFor` at
  `packages/core/src/violation.ts:166-171`).
- **A condition never runs over an empty selection.** `evaluateConditions` returns at
  `packages/core/src/condition.ts:117`. eess-md's way for a builder to read a condition's own
  declaration is its condition registry (`declaresSections`), read in its corpus rule builder,
  merged with `mergeCollectResults`.
- **A match cannot cross a table cell.** Each cell is its own run
  (`packages/md/src/model/phrasing.ts:279`). Inline-code segments carry no source offsets
  (`packages/md/src/model/phrasing.ts:171-172`).
- **The pointer resolver is inline in `pointerResolves`, not a function to reuse.** It lives in
  `packages/md/src/conditions/pointer-resolve.ts`, with its `externalRoots` skip.
- **`.excluding()` refuses to drop a `bypassFilters` finding.** So "declare an exclusion" has no
  API today.
- **eess-ts cannot import eess-md.** The `eess/ts-isolated` arch rule forbids it, so an eess-ts
  producer cannot name a concrete eess-md type.

### Critical (decided in this proposal before any plan)

1. **The severity split has no mechanism.** Decision 5 of the spike (rename, move and text-only at
   error, drift at warning) cannot come from one rule (all three lenses). Its classes are also not
   defined in terms the condition can compute, and its premise fails.
   - **The premise.** "None of them comes from `prettier`" is false: 8 of the 46 live error
     findings have the name as code within 3 lines of the cited line (the enforcement lens).
     Appendix B's text-only rows h02 and h20 are line drift too.
   - **The classes.** Keyed on "not declared in the file", about 59 of the 86 not-declared misses
     would go to error, though the name is imported or used in that file (the product lens).
   - **What to decide:**
     - two conditions, or one option naming the classes, each with its own rule id and severity;
     - the classes defined by what the facts say about the file (renamed: no fact of the name in
       the file; drifted: a fact elsewhere in it), re-counted with the instrument;
     - which rule carries the "not judged" findings, so none reports twice.
   - **What not to do.** Per-finding severity in the kernel, or content findings marked
     `bypassFilters`, would each be a binding decision taken for one dialect condition. The
     proposal says neither is taken.
2. **The empty-facts finding cannot come from a condition** (the architect lens). With nothing
   selected, the condition does not run. With anything selected, `.expectEmpty()` is already red as
   an expired declaration. So [spike 0646](../spikes/0646-what-ask-a1-of-proposal-021-reads-and-judges.md)'s non-vacuity row 4 cannot fire as written.
   - **The builder reads the facts' emptiness**, through eess-md's condition registry, merged with
     `mergeCollectResults`: [spike 0640](../spikes/0640-an-input-side-loaded-nothing.md)'s shape.
     Or the proposal says that with zero references the facts' emptiness is not this rule's
     finding.
   - **"No cited file is covered" is its own configuration finding**, with its own message. It
     must not be relabelled as source-empty, and it must not fire over zero references under
     `.expectEmpty()` (the architect and enforcement lenses). Its precedence over the per-file
     not-judged findings is written down.
3. **A1's plan cannot close as scoped.** At HEAD the decided rule gives this repository 46 live
   error findings, 12 per-file not-judged findings (unsuppressable, failing `.warn()`) and 99
   warnings, and `check-corpus.mjs` has no warning channel (the enforcement lens). The facts also
   cost `check:corpus` 3.0 s on 8.6 s (+35% in `check:fast`). `check:corpus` runs about 52 times
   in `check:nonvacuity`, which comes to roughly 2.5 minutes a shard, on shards near their limit.
   - **Decide where A1 closes:** on package tests plus an `examples/md/` test with hand-built facts
     (the product lens), with this repository's wiring and its `check:nonvacuity` rows moved to
     the plan that brings A2's facts; or A1 and A2 land together.
   - **Either way, the wiring is a separate gate**, so its cost stays in its own rows.
4. **The contract misses three facts its verdicts depend on.**
   - **Doc comments need a coverage kind.** `covers()` knows declarations, imports and uses, not doc
     comments. A producer without them (ctags, a regex) reds every correct doc-comment citation as
     drift: 61 of 103 span-greens here, 35 of them live (the product and enforcement lenses). Add
     the kind.
   - **The declaration needs its end line.** Without it, a message cannot tell a correct citation
     into a body from drift, so the remedy [spike 0646](../spikes/0646-what-ask-a1-of-proposal-021-reads-and-judges.md) promises cannot be offered (the product
     lens).
   - **`docComment` is free-form, so it can bring S1 back.** The instrument's own span runs from
     the doc comment to the end of the body, and ts-morph attaches a file-header `/** */` to the
     first declaration (the enforcement lens). The condition refuses a doc comment that ends at or
     after its declaration's line.

   Also decided in the contract:
   - `covers` becomes data, not a function, so it can be listed and checked;
   - one emptiness signal, not two (the architect lens);
   - paths are relative to the corpus root;
   - the shape is generic, as `MentionFix<R>` is, or held by a typecheck in crossvalidate or the
     caller's rule file, because eess-ts cannot import it (the architect lens; this does not settle
     A2);
   - the producer's obligations are in the type's doc: `{@link X}` is never a use, `line` is the
     name's line, and `member` never means an object-literal key.

### Important

- **The reading was measured through a stand-in.** The 467 of 485 is a regex over raw lines.
  Through eess-md's actual walk it is 455 of 485 (234 of 246 live); the 14 it misses are table rows
  with the name and pointer in adjacent cells (the architect lens). [Spike 0646](../spikes/0646-what-ask-a1-of-proposal-021-reads-and-judges.md)'s 18-row gap is
  mostly 13 member or chained calls the stock pattern cannot read (`.expectEmpty()`,
  `.select({…})`), not line breaks (the enforcement lens). The rewrite gives the walk's number and
  says how table rows are treated.
- **A kept backtick can be forged.** 1 of 472 matches, in
  [bug 0608](../bugs/0608-an-emitter-finding-prints-its-message-twice.md) at line 25, has both
  groups in prose: an escaped backtick earlier in the paragraph shifts the code spans. The
  condition needs to know, per group, that it lies inside one inline-code span; `inCode` for the
  whole match is not enough (the architect lens).
- **Drop the group offsets and the name-alone form from A1.** Per-group source offsets need the
  walk changed (the `d` flag; inline code's value is not its source) and serve only ask C, so they
  move there. The name-alone form is used 0 times here. A pattern must carry a `line` group, and
  one without it is refused at configuration (all three lenses).
- **Excluding a file has no API.** "Declare it as an exclusion, and count it" cannot use
  `.excluding()`. This repository needs it on day one for 20 uncovered live pairs in 12 files. The
  rewrite defines it at the selection and says who prints the count (all three lenses).
- **Extract the resolver.** Write one shared path classifier out of `pointerResolves`, with its
  external-roots skip becoming a not-judged cause. A broken named pointer then reports under two
  ids; the rewrite says which, and the changeset says old `corpus/pointers-resolve` waivers return
  (the architect and product lenses).
- **Two remedies send the author to a line that goes green while still wrong**,
  [bug 0363](../bugs/fixed/0363-a-remedy-that-cannot-remediate-survives-one-input-over.md)'s class
  (the enforcement lens). "Imported at line N" brings back the first review's critical 4. "Declared
  at line N" for a drifted use must not be worded "move the pointer to N".
- **The range rule hides drift.** 12 of the 21 ranges that hold do so only on a line after the
  first. None was judged, and one hidden drift was found: `SIBLING_NOT_CONSTRUCTORS` cited at
  `scripts/vacuity-matrix.mjs:562-569`, declared at line 428 (the enforcement lens). Decision 3 is
  reopened: judge a sample of ranges, or hold a range to its first line.
- **The four non-vacuity rows leave three emptied mechanisms green** (the enforcement lens):
  - a coverage check that silently passes an uncovered file;
  - the doc-comment clause widened back to the whole declaration;
  - a pattern that examines nothing, which this proposal requires.

  The text-only row is meaningful only with A2's real producer: `getDescendants()` counts
  `{@link X}` as an identifier and `forEachDescendant()` does not.

- **"Never a red" contradicts [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md).** For a declarations-only producer, [spike 0646](../spikes/0646-what-ask-a1-of-proposal-021-reads-and-judges.md) makes a use
  line "a cause the condition cannot judge, never a red", but a not-judged finding fails `.warn()`
  ([ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) clause 5). A line
  without the name's token can also still be judged from text (the product lens). The not-judged
  finding is [ADR-016](../../adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md)'s and [ADR-009](../../adr/009-agent-first-failure-surfaces.md)'s kind, raised by a condition, not [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)'s predicate
  machinery (the architect lens). It is marked `bypassFilters` (the enforcement lens).
- **A dotted name has no rule.** About 20 pairs name `a.b` ([ADR-024](../../adr/024-a-claimed-files-waivers-are-read-from-its-registered-text.md)'s `fs.readFileSync` among
  them). The rewrite says how a qualified name matches through `container` (the architect and
  product lenses).
- **The consuming project's case is still the consumer's.** Lines 96-97 and 124 still carry its
  `judgeTargets` and line 492 of its ledger module, and the case is not placed in a break class (the product
  lens).

### Minor

- **Names, pinned once published** (the product lens):
  - the condition `.should().resolveAgainst(code)`, as `fields().resolveAgainst()`;
  - `coverage` for `covers`;
  - `CodeName` for `CodeSymbol` (a use is not a symbol);
  - an opt-in worded like its precedent (`keepBackticks: true`);
  - "stale" for a range past the end, the word the family already uses.

  `holdTheirCode` is still a placeholder in the proposal.

- Findings on one line carry the pointer and name in `element`, as `pointerResolves` does.
- "Before form only" describes the example's pattern, not the condition.
- The [ADR-018](../../adr/018-a-string-that-names-code-is-resolved-or-the-rule-says-why-not.md)
  scope sentence is still owed.
- No decision in the spike needs an ADR. The two ways of building it that would (per-finding
  severity in the kernel, a dialect-to-dialect type) are named above as not taken.

### Corrections [spike 0646](../spikes/0646-what-ask-a1-of-proposal-021-reads-and-judges.md) committed in itself

- Its 467 of 485 was measured over raw lines, not through `mentions()`. Its gap was attributed to
  line breaks, but it is mostly member and chained calls.
- Its "16 of 16" leaves out a conflict. Rows s14 and s28 are Appendix B's m22 and m10, which the
  earlier judge called drifted (a doc comment's closing line, its declaration on the next line).
  Read as about 20 of 22, with two disputed.
- Its "none of them comes from `prettier`" was asserted, not measured. It is false on 8 of 46.
- Its "never a red" for a declarations-only producer contradicts [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) clause 5.
- Its non-vacuity row 4 cannot fire from a condition.

### Disposition

| Ask                                                              | Disposition | What would unhold it                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A1** — the reading and the condition, in eess-md, any language | `Held`      | The rewrite of ask A1's section decides critical items 1–4 against the numbers above, folds the important items in as named requirements, and replaces the Ask and Acceptance text that still describes the rejected rule. Then a re-review of those decisions only. No spike |
| **A2** — the TypeScript code facts                               | `Held`      | Unchanged: open question 1, decided under [ADR-007](../../adr/007-isolate-ast-engine-boundary.md)'s constraint and the `eess/ts-isolated` rule, with the element shape and the measured cost                                                                                  |
| **B** — a link into code carries a line                          | `Held`      | Unchanged from the first review                                                                                                                                                                                                                                               |
| **C** — a fix for a drifted reference                            | `Held`      | Unchanged; it now also owns the per-group source offsets                                                                                                                                                                                                                      |

**Recommended next step:** rewrite ask A1's section of this proposal, about an hour against these
numbers, with critical items 1–4 decided. Then re-review those decisions only. No plan until A1 is
unheld.

## Appendix A — first submission (superseded 2026-11-08)

> Preserved below the review rather than edited away, per the lane's rule (the shape
> [proposal 010](./010-ts-performance-at-scale.md)'s Appendix A uses). **One mechanical change:** its
> headings are one level deeper, so they nest under this appendix. Everything else is verbatim, and
> the review above cites this text.

### Proposal 021 (first submission) — a code reference points at the code it names

**State:** Draft — filed 2026-10-27 from dogfooding [plan 0550](../plans/completed/0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md)'s fix on this repository; reviewed 2026-10-27, Split and sequence, all three asks held (see Review).
**Priority:** High — the records cite code as evidence (an ADR's Enforcement row, a bug's root
cause), and a text heuristic finds most of the citations it can pair already pointing at the wrong
line; in live records, which the gate reads, it passes them.
**Origin:** self-found · the maintainer, 2026-10-27: "if we in the md link to code in our codebase,
the link needs to be real and work; this way we can catch wrong or old code refs".
**Affects:** `@nielspeter/eess-md` (pointers and links into code, and a fix), and likely
`@nielspeter/eess-crossvalidate`, where a Markdown string is already resolved against TypeScript
(`packages/crossvalidate/src/md-ts.ts`).

### Problem

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

### Existing code survey

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
- **`adrCitationsResolve`** (`packages/crossvalidate/src/md-ts.ts:159`) resolves an ADR's cited
  `it('…')` title against the real test AST: the one place the family already checks Markdown's
  claim about code by reading the code. eess-ts reads declarations; eess-md reads text.
- **Text is not enough for the fix.** In the sample's s03, `FOREIGN_HEADER` occurs twice in its
  file, its declaration and a use; a fix counting text occurrences refuses it, one reading the
  declaration moves the pointer to it. And in s04, s06 and s25 the target is not a declaration at
  all (a call, a test title), so a declaration is not the only thing a pointer locates.

### Asks

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

### Acceptance criteria

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

### Open questions

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

### Out of scope

- [Plan 0542](../plans/completed/0542-this-repositorys-record-mentions-are-migrated.md) (this repository's record mentions): a separate migration, built first.
- Rewriting this repository's 1,618 pointers as links: a choice for after the check exists.

### Appendix — the sample, 2026-10-27

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

## Appendix B — the judged samples, 2026-11-08

Drawn by `node scripts/measure-code-reference-names.mjs --sample 30 --seed 20261108 --pool holders`
and the same with `--pool misses`, at `f5b5469d`, and judged by a judge on a different model from the
one that wrote the instrument, reading each citing sentence and the cited lines. The `ast` column is
what the AST found on the cited lines (holders) or where the name is declared (misses). Line numbers
are as of that commit; several citing documents are frozen history, judged against today's file.
Fenced, so no gate reads it.

```tsv
id	doc	name	pointer	ast	verdict	reason
h01	work/bugs/0599-nothing-local-proves-the-nonvacuity-merge-job-loads-without-node-modules.md:18	nonvacuity	.github/workflows/ci.yml:161	n/a	correct	Line is the nonvacuity job declaration.
h02	work/proposals/promoted/004-corpus-content-explain.md:106	documents	packages/md/src/corpus.ts:36-40	text-only	wrong-holder	Cited lines are CorpusOptions docblock saying "documents"; documents() declared at line 71.
h03	work/plans/completed/0582-md-a-document-has-a-section-that-satisfies-a-predicate.md:74	sectionsHolding	packages/md/src/predicates/section.ts:80	declaration	correct	Declaration line.
h04	work/bugs/fixed/0403-the-vacuity-matrix-probes-one-dialect-of-five.md:32	scenarios	packages/gherkin/src/index.ts:14	import	correct	Barrel export line of scenarios.
h05	work/bugs/fixed/0364-doctor-states-the-cause-and-never-the-remedy.md:22	FAULT_ADVICE	packages/ts/src/core/diagnose.ts:614-623	use	correct	Lines build advice from the FAULT_ADVICE table; sentence is about that use.
h06	work/plans/completed/0456-kernel-notexist-and-dead-glob.md:93	marksAssertsCardinality	packages/core/src/cardinality.ts:73	declaration	correct	Declaration line.
h07	work/bugs/fixed/0622-an-indented-line-like-a-heading-ends-the-field-header.md:75	DEEP_HEADING	packages/md/src/model/fields.ts:148	declaration	correct	Declaration line.
h08	work/proposals/020-a-fix-dry-run-a-reader-can-review.md:119	file	packages/md/src/conditions/pointer-resolve.ts:226-233	declaration,use	correct	match.file is the value the sentence names, on cited lines.
h09	work/bugs/0168-no-unused-exports-misses-barrel-re-exports-and-inline-type-imports.md:17	FunctionCollectionOptions	packages/ts/src/index.ts:155	import	correct	Barrel export; sentence says where symbol is used.
h10	work/proposals/017-md-blocks-to-check-a-documents-shape.md:131	depth	packages/md/src/model/document.ts:10	declaration	correct	depth field declaration.
h11	work/bugs/0626-the-field-header-end-is-a-line-pattern-not-a-parse.md:38	headerEnd	packages/md/src/model/fields.ts:158	declaration	correct	Declaration line.
h12	work/bugs/fixed/0410-front-matter-read-as-markdown-says-nothing.md:49	frontMatterNotRead	packages/md/src/model/prose.ts:110	declaration	correct	Declaration line.
h13	work/proposals/010-ts-performance-at-scale.md:265	globNode	packages/core/src/glob-site.ts:254	declaration	correct	Declaration line.
h14	work/bugs/0591-the-empty-corpus-message-names-a-tsconfig-to-a-markdown-user.md:46	sourceEmptyViolation	packages/core/src/emitter-findings.ts:156	declaration	correct	Declaration line.
h15	work/plans/0581-md-a-field-written-empty-can-mean-absent.md:71	resolveField	packages/md/src/model/field-resolve.ts:48	declaration	correct	Declaration line.
h16	work/proposals/promoted/004-corpus-content-explain.md:107	features	packages/gherkin/src/load.ts:18-20	declaration	correct	Interface members features()/scenarios() are the exposure meant.
h17	work/bugs/0168-no-unused-exports-misses-barrel-re-exports-and-inline-type-imports.md:18	ObjectLiteralFunction	packages/ts/src/index.ts:156	import	correct	Barrel export line.
h18	work/bugs/0517-a-gates-json-past-64-kib-is-cut-through-a-pipe.md:47	write	scripts/check-bun-load.mjs:893	use	correct	Cited line is the stdout write the sentence means.
h19	work/bugs/fixed/0477-a-correspondence-of-two-empty-sides-passes-so-two-crossvalidate-presets-pass-on-nothing.md:19	diagramMatchesCode	packages/crossvalidate/src/mermaid-ts.ts:47	declaration	correct	Declaration line.
h20	work/plans/completed/0454-box-marks-are-the-callers.md:262	state	ledger.ts:914	text-only	wrong-holder	Line 914 is a ledger finding suggestion mentioning state; the openTaskItems peek is at ~1093.
h21	work/plans/completed/0457-a-rule-limited-to-the-documents-the-caller-chooses.md:146	areExported	packages/ts/src/index.ts:86	import	correct	Barrel export entry for areExported.
h22	work/bugs/fixed/0403-the-vacuity-matrix-probes-one-dialect-of-five.md:31	diagram	packages/mermaid/src/index.ts:37	import	correct	Barrel export line.
h23	work/plans/completed/0458-the-examples-gate-a-document-shape-from-public-blocks-only.md:388	examined	packages/md/src/corpus.ts:12-37	text-only	pairing-error	Pointer is CorpusOptions; examined accessor is a separate thing, not on those lines.
h24	work/plans/completed/0448-a-bun-load-guard-and-bug-0439s-fix.md:17	registerHooks	packages/core/src/cli-config.ts:3	text-only	wrong-holder	Line 3 now is a comment about registerHooks; the named import it meant is gone.
h25	work/bugs/fixed/0572-a-definition-in-front-matter-hides-a-reference-in-the-body.md:17	checkedMarkdownIn	packages/md/src/model/prose.ts:41	declaration	correct	Declaration line.
h26	work/proposals/025-md-a-field-written-empty-can-mean-absent.md:58	resolveField	packages/md/src/model/field-resolve.ts:48	declaration	correct	Declaration line.
h27	work/bugs/0338-a-match-with-no-enclosing-declaration-has-a-positional-identity.md:80	identifyMatches	packages/ts/src/conditions/match-identity.ts:44	declaration	correct	Declaration line.
h28	work/proposals/010-ts-performance-at-scale.md:232	names	packages/ts/src/core/module-edges.ts:146	declaration	correct	names field declaration on ModuleEdge.
h29	work/bugs/0587-the-evidence-gate-adds-a-finding-again-on-a-second-pass.md:78	sourceEmpty	packages/core/src/report.ts:148	use	correct	The sourceEmpty branch condition the sentence describes.
h30	work/proposals/010-ts-performance-at-scale.md:236	HEAD	packages/core/src/diff-aware.ts:86	text-only	correct	Cited line runs git diff ...HEAD, as the sentence says.

id	doc	name	pointer	ast	verdict	reason
m01	work/bugs/fixed/0374-eess-mermaid-extend-reads-one-edge.md:18	extendName	packages/mermaid/src/predicates/class.ts:67	declared at 69	drifted	Blank line; extendName declared at 69.
m02	work/proposals/promoted/022-md-a-raw-html-link-is-resolved.md:74	fencesInHtml	packages/md/src/model/prose.ts:235	declared at 253	drifted	Mid-comment of another function; fencesInHtml at 253.
m03	work/proposals/010-ts-performance-at-scale.md:253	findUnusedExportsInFile	packages/ts/src/conditions/reverse-dependency.ts:247	declared at 292	drifted	Comment fragment; function declared at 292.
m04	work/bugs/fixed/0604-a-field-heading-in-a-non-ascii-label-ends-the-header.md:38	opensWithLabelShape	packages/md/src/model/label.ts:103-105	declared at 107	in-body	Cited lines are the function docblock, just above its declaration.
m05	work/bugs/fixed/0594-a-stale-exemption-passes-on-a-project-with-no-source-files.md:17	scenarioExemptionsCurrent	packages/crossvalidate/src/gherkin-ts.ts:305	declared at 318	in-body	Cited lines open the function docblock, declaration at 318.
m06	work/plans/completed/0458-the-examples-gate-a-document-shape-from-public-blocks-only.md:419	gateArchOneTagComparison	scripts/check-nonvacuity.mjs:752	declared at 934	drifted	Line 752 is unrelated gate code; function at 934.
m07	work/plans/completed/0454-box-marks-are-the-callers.md:262	openTaskItems	ledger.ts:914	declared at 1093	drifted	Line 914 is an unrelated finding suggestion; peek at 1093.
m08	work/proposals/promoted/005-crossvalidate-stale-wip-detection.md:302	scenariosCovered	gherkin-ts.ts:176-226	declared at 259	drifted	Lines are mid-function citation code; scenariosCovered at 259.
m09	work/bugs/0175-kernel-configuration-findings-sit-outside-every-census.md:24	zeroExaminedViolation	packages/core/src/vacuity-findings.ts:24	declared at 63	drifted	Closing comment of other item; function at 63.
m10	work/proposals/PROPOSALS.md:194	withEvidenceGate	packages/core/src/report.ts:100	declared at 101	drifted	Closing line of docblock; function at 101, off by one.
m11	work/bugs/fixed/0467-eess-ts-expectnonempty-does-nothing.md:13	_requireNonEmpty	packages/ts/src/core/terminal-builder.ts:253	declared at 242	not-a-locator	Cited lines are expectNonEmpty() docblock; the flag is only context.
m12	work/bugs/fixed/0604-a-field-heading-in-a-non-ascii-label-ends-the-header.md:52	PLAIN_LABEL	packages/md/src/model/label.ts:61	declared at 68	drifted	Comment near LABEL_HEADING; PLAIN_LABEL now at 68.
m13	work/proposals/027-a-finding-says-whose-it-is-and-a-run-reports-it-once.md:87	dedupeConfigFindings	packages/core/src/dedupe-config-findings.ts:69	declared at 80	drifted	Inside affectedNote docblock; function at 80.
m14	work/bugs/fixed/0363-a-remedy-that-cannot-remediate-survives-one-input-over.md:124	TerminalBuilder	packages/ts/src/core/terminal-builder.ts:507	declared at 707	drifted	assertsCardinality gone from 507; unrelated docblock there.
m15	work/plans/completed/0456-kernel-notexist-and-dead-glob.md:37	TaskItemRuleBuilder	packages/md/src/builders/task-items.ts:24	declared at 43	drifted	Line 24 is a type alias; class at 43.
m16	work/proposals/promoted/022-md-a-raw-html-link-is-resolved.md:216	movedLinkFix	packages/md/src/model/resolve-link.ts:273-294	declared at 491	drifted	Unrelated helper code; movedLinkFix at 491.
m17	work/bugs/0175-kernel-configuration-findings-sit-outside-every-census.md:29	assertionLessViolation	packages/core/src/terminal-builder.ts:413	declared at 504	drifted	Line is copy() code; function at 504.
m18	work/bugs/fixed/0155-a-rule-with-no-condition-passes-in-total-silence.md:211	should	packages/core/src/rule-builder.ts:333	declared at 149	drifted	Line is copy() code; _phase guard term not there.
m19	work/bugs/fixed/0606-the-terminal-formats-never-print-a-rule-id.md:27	executeWarn	packages/core/src/execute-rule.ts:400	declared at 410	drifted	Line is inside previous function; executeWarn at 410.
m20	work/plans/completed/0458-the-examples-gate-a-document-shape-from-public-blocks-only.md:353	haveSection	packages/md/src/builders/docs.ts:30	declared at 88	drifted	Class docblock line; haveSection at 88.
m21	work/plans/completed/0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md:320	withRewrittenFile	scripts/check-nonvacuity.mjs:650	declared at 660	drifted	Line is restoreAllPending; function at 660.
m22	work/bugs/fixed/0600-select-drops-an-unread-mention-without-a-word.md:20	select	packages/core/src/rule-builder.ts:195	declared at 196	drifted	Closing docblock line; select declared at 196, off by one.
m23	work/plans/completed/0582-md-a-document-has-a-section-that-satisfies-a-predicate.md:37	HaveSectionOptions	packages/md/src/model/sections.ts:29	declared at 30	in-body	One-line docblock directly above the interface at 30.
m24	work/plans/completed/0457-a-rule-limited-to-the-documents-the-caller-chooses.md:176	expectEmpty	packages/core/src/terminal-builder.ts:311	declared at 69	in-body	Line is the expectEmpty check inside the zero-examined logic the sentence means.
m25	work/plans/completed/0080-gherkin-ts-crossvalidation.md:245	scenarioCitationStats	md-gherkin.ts:152	declared at 171	drifted	Mid-call arg line; function at 171.
m26	work/proposals/promoted/013-md-a-declared-relation-is-reciprocated.md:21	linkResolves	packages/md/src/conditions/resolve.ts:31	declared at 35	in-body	Inside the condition docblock, four lines above declaration.
m27	work/bugs/0447-adr-enforcement-reads-a-dotted-name-as-a-file.md:14	PATH_RE	packages/md/src/rules/adr.ts:50	declared at 54	drifted	Closing brace; PATH_RE at 54.
m28	work/proposals/017-md-blocks-to-check-a-documents-shape.md:325	scenarioCitationsResolve	packages/crossvalidate/src/md-gherkin.ts:104	declared at 110	in-body	Inside the function docblock, six lines above declaration.
m29	work/bugs/fixed/0286-a-fenced-example-can-turn-the-close-checks-off.md:57	isDoneItem	packages/md/src/rules/ledger.ts:200-208	declared at 546	drifted	Docblock for a label regex; isDoneItem at 546.
m30	work/proposals/017-md-blocks-to-check-a-documents-shape.md:709	DEFAULT_FROZEN	packages/md/src/corpus.ts:53	declared at 78	drifted	Comment in options docs; DEFAULT_FROZEN at 78.
```

## Appendix C — ask A as written on 2026-11-08 (superseded 2026-11-09)

The sections of the 2026-11-08 rewrite that "Ask A1, rewritten 2026-11-09" replaces, kept as they were. The second and third Reviews judged this text.

### What the measurement settles (the review's critical items)

1. **The relation to [bug 0215](../bugs/0215-pointer-gate-proves-existence-not-aboutness.md), and its
   fork: the name is the anchor, the line is where it is cited.** A reference that names its code is
   checked against the code by that name; a pointer that names nothing is checked as today. Both of
   the fork's forms are kept, and each is checked for what it says:
   - **a line and a name** (`` `name` (`path:line`) ``): the cited lines must hold the name as code,
     or lie inside the named declaration (rule below). It drifts when code moves, `prettier`
     included, and is red then. That couples code and records, and it is stated, not hidden: under
     the review's critical 1 this repository runs the check under `.warn()` until ask C's fix exists,
     and an adopter chooses.
   - **a name alone** (a pointer the caller's pattern reads with no line, such as
     `` `path#name` `` or a name beside a bare path): the file must declare the name exactly once. It
     cannot drift under formatting; it reds on a rename or a move, which is the one change it must
     catch. Measured: 16 of the 26 correct holders cite the declaration itself, and could be written
     this way.
2. **Criterion 1 is restated against the AST, not text** (the review's critical 2). The verdict reads
   the declaration's span and the occurrences of the name as code. A reference whose sentence cites a
   neighbouring thing and names something else (the sample's one in 30) is red, and its remedy is to
   reword: name the thing cited, or leave the name out of the reference form. That is a Tier-1 check
   with an honest remedy, not a Tier-4 judgment of what the sentence meant.
3. **The green side has break classes and a rule** (critical 3). A reference holds when either:
   - the cited lines hold the name **as code**: an identifier occurrence, a declaration, an import or a
     use, as the AST reads it; a name only in a comment or a string does not hold (the 3 wrong
     holders); or
   - the cited lines lie **inside the named declaration's span, its leading doc comment included**
     (the 41 body lines the instrument measured, and the 5 doc-comment rows as the judge read them;
     the instrument's span starts at the declaration, so it did not count those 5).

   On the samples this rule is wrong twice in 60, both false reds (a correct pointer at a text line,
   and one at a check inside a neighbouring function), against 10 for a text check (4 false greens, 6
   false reds). The match is the AST's identifier, never a substring, never a `RegExp` built from a
   name.

4. **No text-found "now at"** (critical 4). The finding names where the code is only from the AST,
   and only when the name is declared exactly once in the file: "`judgeTargets` is declared at line
   492". Declared more than once, or not at all, it names no line and says which. A line the finding
   names is the declaration's, so an author who follows it cannot land on an import or a call.
5. **Its own rule id and denominator** (critical 5). The condition counts named references, not
   pointers; zero examined is a finding unless `.expectEmpty()` is declared; a `check:nonvacuity`
   row empties the caller's pattern and reds `check:corpus`. This repository's id is
   `corpus/code-references-hold`, so the existing `eess-exclude corpus/pointers-resolve` waivers do
   not silently cover drift. The gate's summary says "K references name their code", never "all
   ground in code".

**A file the code facts do not cover is not judged by text** ([ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md),
[ADR-016](../../adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md)): a reference into a
file in no project, or in a language with no parser, is reported as one it cannot judge, never
passed. Here that is 6 of 649 pairs, in files with no parser here; the caller's pattern can leave them
out on purpose.

### Ask A, reshaped

**A — a reference that names its code is checked against the code.** The reading is the caller's,
as [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md) requires: a `mentions()`
pattern with named groups `name`, `path` and, optionally, `line` and `end`. The check is one opt-in
eess-md condition on that selection, which takes the code facts as a kernel `Selection` from the
caller's rule file, as `beLinked({ fix })` takes its targets, so eess-md never imports eess-ts:

```ts
import { corpus, mentions } from '@nielspeter/eess-md'

const c = corpus({ roots: ['docs/**'] })
// A name, then its pointer: `judgeTargets` (`src/ledger.ts:492`). The caller's pattern, not eess's.
const NAMED =
  /`(?<name>[A-Za-z_$][\w$]*)(?:\(\))?`\s*(?:\(|at\s+)?`(?<path>[\w./-]+):(?<line>\d+)(?:-(?<end>\d+))?`/g
mentions(c, { pattern: NAMED })
  .should()
  .holdTheirCode({ code: codeNames(project('tsconfig.json')) })
  .rule({ id: 'docs/code-references-hold' })
  .check()
```

`holdTheirCode` and `codeNames` are placeholder names for the review. `codeNames(project)` is a
`Selection` of each declaration and each occurrence of a name as code, per file: `{ file, name, line,
kind: 'declaration' | 'import' | 'use', span? }`, the span on a declaration only, from its leading doc
comment to its last line. Its home is open question 1.

**What the finding says**, one per reference:

- the cited lines do not hold `X` as code and lie outside its declaration; `X` is declared at line N
  (declared once), or declared K times (lines …), or not declared in the file;
- `X` is not declared in the file (a name-alone reference);
- the file is outside the code facts the rule was given: not judged.

**Out of ask A**, as the review disposed: ask B (a link's `#L` anchor) and ask C (a fix that rewrites
the line) stay `Held`. Ask C is what makes the line-and-name form livable under `prettier`; until it
exists, the form runs under `.warn()` here.

### Acceptance criteria

- **Break class (drift):** a reference whose name is declared once elsewhere in the file and whose
  cited lines neither hold it as code nor lie inside its declaration is red, naming the declaration's
  line. The sample's 23 drifted rows are fixtures.
- **Break class (text only):** a reference whose cited line mentions the name only in a comment or a
  string is red. The sample's 3 wrong holders are fixtures.
- **Break class (rename):** a name-alone reference whose name the file no longer declares is red.
- **Break class (not judged):** a reference into a file outside the code facts is reported as not
  judged, never passed.
- **Green side:** a reference whose lines hold the name as a declaration, an import or a use is
  green; one whose lines lie inside the named declaration, its doc comment included, is green. The
  sample's 26 correct holders and 5 doc-comment rows are fixtures, each asserting green.
- **Evidence:** `examined` counts named references; zero examined is a finding unless declared; a
  `check:nonvacuity` row empties the pattern and reds `check:corpus`.
- **Fixtures are frozen:** the samples' rows become fixtures through `corpusFromText`
  ([plan 0455](../plans/completed/0455-a-corpus-built-from-text.md)) and a fixture code tree, so the
  dogfood migration cannot heal them.
- **The instrument agrees:** run over this repository, the built condition's counts are reconciled
  with `scripts/measure-code-reference-names.mjs`'s, and any difference is explained.
- **Dogfood:** this repository's live named references (336 resolved pairs by the instrument) are
  migrated in a plan of their own, as [plan 0542](../plans/completed/0542-this-repositorys-record-mentions-are-migrated.md)
  was for mentions; the eess-md release does not wait on the records.

### Open questions

1. **Where the code facts come from.** eess-ts selects classes, functions and types, not variables;
   the review found 5 of its 26 drifted targets were `const`s and 4 sat in `.mjs` or root files, and
   `check:corpus` loads no TypeScript project. Either eess-ts gains a selection of every declaration
   and occurrence (`codeNames`), or a helper beside `adrCitationsResolve` in eess-crossvalidate reads
   them through eess-ts's public API. Either way ts-morph stays behind eess-ts
   ([ADR-007](../../adr/007-isolate-ast-engine-boundary.md)), and this repository's dogfood needs a
   project that covers `scripts/` and root files.
2. **The name-alone form's syntax.** `` `path#name` `` reads like a link fragment and may collide
   with ask B's `#L` if B is ever built; a name beside a bare path is the caller's pattern either way.
3. **A range.** The rule reads "the cited lines": a range holds when any line in it holds the name as
   code, or when it lies inside the declaration. The review flagged that fail-open concentrates in
   ranges; a range wider than the declaration it names may need its own finding.
4. **Overloads, methods of the same name across classes, re-exports:** "declared once" needs a rule
   for each before a finding may name one line.

### Out of scope

- Asks B and C, held (above and the review's disposition).
- Whether the prose describes the code correctly: a reference that names the function still on its
  line, while the sentence describes behaviour that moved elsewhere, is green. That is a Tier-4
  judgment and stays human review, as it was in the consuming project's case if its README had named
  the old function.
- Rewriting this repository's pointers into either form: a migration plan, after the check exists.
