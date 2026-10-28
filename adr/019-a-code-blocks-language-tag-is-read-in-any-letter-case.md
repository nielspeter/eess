# ADR-019: A code block's language tag is read in any letter case

- **Status:** Accepted 2026-10-15, on review of PR #221. Decided at [plan 0413](../work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md)'s freeze (PR #217);
  that freeze's architect review asked for it as an ADR rather than a bug's Fix section, because it
  reverses a ruled condition, removes public API and claims the whole family.
- **Context:** [proposal 006](../work/proposals/006-mermaid-beyond-classdiagram.md) condition 10 and
  its 2026-10-15 note, [bug 0423](../work/bugs/fixed/0423-a-capitalised-mermaid-fence-is-skipped-in-silence.md),
  [bug 0424](../work/bugs/fixed/0424-a-capitalised-mermaid-er-fence-is-skipped-in-silence.md),
  [bug 0426](../work/bugs/fixed/0426-parsecodeblocks-and-md-mermaid-read-the-mermaid-tag-differently.md),
  [plan 0413](../work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md)

## The question

A fenced code block names its language in its info string: ` ```mermaid `, ` ```json `. Two parts of
the family select blocks by that tag, and they compare it differently. eess-crossvalidate's Mermaid
bindings compare it case-insensitively since [bugs 0423](../work/bugs/fixed/0423-a-capitalised-mermaid-fence-is-skipped-in-silence.md) and 0424, so ` ```Mermaid ` is read. eess-md's
`parseCodeBlocks` compares it exactly; it does not read ` ```Mermaid `, and discloses it beside the
count as a "near miss", with a dead-glob diagnosis telling the author to retag it. One fence gets two
answers to "is this Mermaid?", and [proposal 006](../work/proposals/006-mermaid-beyond-classdiagram.md) had ruled the exact comparison (condition 10).

## Decision

**Every part of the family that selects a code block by its language tag compares the tag
case-insensitively, and normalises nothing else.** Precisely:

- The comparison is on mdast's `lang`, the info string's first word; its `meta`, the rest, is never
  read. Both sides are folded with `toLowerCase()`: ASCII letter case, which is all real tags use.
  ` ```Mermaid `, ` ```MERMAID ` and ` ```mermaid ` are one language.
- No aliases: ` ```mmd ` is not `mermaid`, ` ```json5 ` is not `json`. A caller that selects two tags
  on purpose (this repository's `scripts/check-docs-code.mjs` reads `ts` and `typescript`) is choosing
  two languages, not aliasing one to the other; that script is dogfood, not a dialect.
- **One owner.** eess-md owns code blocks (`MdCodeBlock.lang`), so it owns the comparison: one
  function behind `@nielspeter/eess-md/internal`. eess-crossvalidate's `isMermaidTag`
  (`packages/crossvalidate/src/mermaid-tag.ts`) delegates to it, and an `arch.rules.ts` rule forbids any
  other comparison of `.lang`. A future reader of fence tags, in any dialect, uses it.
- **Out of scope:** whether a block with **no** tag may be selected by its content. The ER binding
  does that and no other reader does; that is [bug 0431](../work/bugs/0431-an-untagged-fence-is-mermaid-to-one-binding-only.md),
  undecided here.

What this changes: eess-md's `parseCodeBlocks` ([bug 0426](../work/bugs/fixed/0426-parsecodeblocks-and-md-mermaid-read-the-mermaid-tag-differently.md)). The near-miss disclosure existed only to
report a case difference, so it goes, with its public API (`NearMissTag`,
`ParsedCodeBlocks.nearMisses`) and the dead-glob diagnosis it fed.

**[ADR-016](./016-a-bounded-instrument-limits-knowledge-never-the-verdict.md) rule 7 still holds.** Condition 10 grounded the near-miss disclosure in it: what an
instrument does not read is disclosed, not silent. After this decision a case difference is read, so
there is nothing unread to disclose for it. A tag that differs in more than case (` ```mmd `) was
never disclosed and still is not; a corpus whose every block is tagged that way gets eess-md's
zero-examined finding, with no pointer to the spelling. That is no regression, and it is where a
reader will look.

## Why this, and not the alternatives

- **Exact comparison, with the near miss disclosed** ([proposal 006](../work/proposals/006-mermaid-beyond-classdiagram.md)'s ruling). Honest, but it leaves
  the family split, since crossvalidate already reads both, and it asks the author to retag a fence
  whose meaning is plain. A disclosure whose only remedy is a change of letter case protects nothing.
- **Exact comparison everywhere**, reverting [bugs 0423](../work/bugs/fixed/0423-a-capitalised-mermaid-fence-is-skipped-in-silence.md) and 0424. That brings back the false green
  those bugs fixed: a ` ```Mermaid ` diagram that drifted from its code was neither compared nor
  counted.
- **Leave each reader to choose.** That is the split this ADR ends. One word meaning one thing across
  the family is the rule [ADR-017](./017-a-heritage-predicate-names-a-relation-not-a-clause.md) set for predicate names; a language tag is the same kind of word.
  This is an analogy, not an extension of [ADR-017](./017-a-heritage-predicate-names-a-relation-not-a-clause.md).

What was not measured: how GitHub and other renderers treat ` ```Mermaid `. The decision does not
rest on it; it rests on the family agreeing with itself and on the false green above.

## Consequences

For [bug 0426](../work/bugs/fixed/0426-parsecodeblocks-and-md-mermaid-read-the-mermaid-tag-differently.md)'s changeset, which must carry them:

- eess-md takes a minor with a `**Breaking**` line: `NearMissTag` and `ParsedCodeBlocks.nearMisses`
  are removed, and a block tagged ` ```Mermaid ` that was disclosed is now parsed, so a green build
  can go red. A corpus that declared `.expectEmpty()` because its only blocks were capitalised now
  has blocks, and the declaration is reported as expired.
- The caller's side is folded too: `language: 'JSON'` selects ` ```json `. `ParsedCodeBlocks.language`
  keeps the caller's spelling in messages.
- eess-crossvalidate is not named under [bug 0185](../work/bugs/fixed/0185-a-kernel-break-reaches-adopters-as-a-dialect-patch.md)'s rule: it neither imports nor re-exports the
  removed API, and its peer range admits the minor. Its `isMermaidTag` changes to delegate.

  **Correction, 2026-10-15 ([bug 0426](../work/bugs/fixed/0426-parsecodeblocks-and-md-mermaid-read-the-mermaid-tag-differently.md)'s build).** This said the delegation ships nothing an adopter can
  observe. It does: delegating imports the owner from eess-md, so eess-crossvalidate's peer floor on
  eess-md rises to the release that adds it, in that release's commit, and the crossvalidate
  changeset says so. (The Decision's pointer to `isMermaidTag` moved with it, from `shared.ts`.) The import sits
  in a module only the two Markdown bindings load, so `./mermaid-ts` and `./gherkin-ts` still need no
  eess-md.

## Enforcement

| Clause                                                | Tier | Mechanism                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Status |
| ----------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **C1** — eess-crossvalidate reads the tag in any case | 2    | `packages/crossvalidate/tests/md-mermaid.test.ts` (the ` ```Mermaid ` fence of [bug 0423](../work/bugs/fixed/0423-a-capitalised-mermaid-fence-is-skipped-in-silence.md)) and `packages/crossvalidate/tests/md-mermaid-er.test.ts` ([bug 0424](../work/bugs/fixed/0424-a-capitalised-mermaid-er-fence-is-skipped-in-silence.md)'s). Cited by file, not by `it()` title, because `check:crossval` resolves titles against eess-ts's tests only ([bug 0262](../work/bugs/0262-an-adr-cannot-cite-a-kernel-test.md)); so deleting those two tests and keeping the files would leave this citation green                                                      | gated  |
| **C1** — eess-md reads the tag in any case            | 2    | `packages/md/tests/code-block-parse.test.ts` (a ` ```Mermaid ` and a ` ```MERMAID ` block parsed through `parseCodeBlocks`, and `language: 'MERMAID'` folded on the caller's side), and the non-vacuity row `corpus/code-block-parse/capitalised-tag` in `scripts/check-nonvacuity.mjs`. Cited by file, for the reason C1's first row gives                                                                                                                                                                                                                                                                                                              | gated  |
| **C2** — nothing but case is normalised               | 2    | ` ```mmd ` is not read as `mermaid` by either crossvalidate binding (`packages/crossvalidate/tests/md-mermaid.test.ts`, `packages/crossvalidate/tests/md-mermaid-er.test.ts`), and neither ` ```mmd ` nor ` ```json5 ` (as `json`) by `parseCodeBlocks` (`packages/md/tests/code-block-parse.test.ts`). An `mmd`/`json5` alias in the owner reds all four, measured for [bug 0426](../work/bugs/fixed/0426-parsecodeblocks-and-md-mermaid-read-the-mermaid-tag-differently.md). Cited by file, with C1's weakness: deleting those tests and keeping the files leaves this citation green                                                                 | gated  |
| **C3** — one owner; no other comparison of `.lang`    | 1    | `tagIsLanguage` in `packages/md/src/model/code-block-tag.ts`, behind `@nielspeter/eess-md/internal`; `isMermaidTag` (`packages/crossvalidate/src/mermaid-tag.ts`) delegates. `arch.rules.ts`'s `eess/one-code-block-tag-comparison` reds a `.lang` equality, a method called on `.lang`, or `switch (x.lang)` in `packages/*/src`, proven by the non-vacuity row `arch/one-code-block-tag-comparison`. Each of its three branches has a probe only that branch catches. It misses the tag passed as an argument or used as an operand of anything but an equality (a regex `.test`, `includes`, `in`), a tag read into a variable first, and `x['lang']` | gated  |
