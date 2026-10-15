# Bug 0426: parseCodeBlocks and md-mermaid read the Mermaid tag differently

## Status

- **State:** Fixed — 2026-10-15, in the PR that closes it. Recorded the same day at plan 0413's
  freeze, which settled the rule.
- **Severity:** Medium — an honesty gap between two parts of the family (`BUGS.md`'s Medium row). No
  false green: `parseCodeBlocks` discloses the tag it does not read, as a near miss.
- **Origin:** self-found · the review of PR #214 (bug 0423), and plan 0413's freeze, 2026-10-15.
- **Reported:** 2026-10-15

## Symptom

A fence tagged `Mermaid` is read by eess-crossvalidate's md-mermaid since bug 0423, which compares the
tag case-insensitively. eess-md's `parseCodeBlocks(corpus, { language: 'mermaid', … })` matches it
exactly, does not read it, and names it as a near miss, telling the author to retag it `mermaid`. One
fence, two answers to "is this Mermaid?".

## Root cause

`parseCodeBlocks` (`packages/md/src/model/code-block-parse.ts`) tested `block.lang === language`; a tag
equal only when case-folded went to `nearMisses`. Plan 0412 chose exact matching before bug 0423 chose the other way.

## Fix

**Decided by [ADR-019](../../../adr/019-a-code-blocks-language-tag-is-read-in-any-letter-case.md) (first at plan 0413's freeze, 2026-10-15): a tag is matched case-insensitively,
family-wide.** A fence tagged `Mermaid` (or `JSON`) is plainly meant as that language, and reading it
needs nothing from the author. So `parseCodeBlocks` reads a tag equal to the language when case-folded.
The near-miss disclosure then has nothing left to disclose for a case difference, and goes, with its
tests, its non-vacuity row (`near-miss` in `scripts/nonvacuity/bad-code-block-parse.mjs`) and the docs'
"Which blocks" paragraph rewritten. That removes public API: the `NearMissTag` export and the
`ParsedCodeBlocks.nearMisses` field (read by `deadGlobDiagnosis` in
`packages/md/src/builders/code-blocks.ts`, which changes with it), unless a reason to keep them is recorded. eess-md takes a minor
whose changeset carries a `**Breaking**` line: an export goes, and a block that was disclosed is now
parsed, so a green build can go red. Proposal 006's condition 10 gets a dated note.

ADR-019 also sets the shape of the fix: one comparison function in eess-md behind
`@nielspeter/eess-md/internal`, which `parseCodeBlocks` uses and eess-crossvalidate's `isMermaidTag`
delegates to; an `arch.rules.ts` rule against any other `.lang` comparison; and a near-miss fixture
on each side (` ```mmd `, ` ```json5 `) proving nothing but case is folded. The changeset carries
ADR-019's Consequences.

### As built

- The owner is `tagIsLanguage(lang, language)` in `packages/md/src/model/code-block-tag.ts`, exported
  from `@nielspeter/eess-md/internal`.
- `isMermaidTag` moved out of `packages/crossvalidate/src/shared.ts` into a module of its own,
  `packages/crossvalidate/src/mermaid-tag.ts`, which delegates. Every crossvalidate entry point loads
  `shared.ts`, and eess-md is an optional peer, so importing it there would have made `./mermaid-ts`
  and `./gherkin-ts` need eess-md. The first draft did exactly that, and nothing here went red; that
  gap is [bug 0432](../0432-nothing-checks-a-crossvalidate-entry-loads-only-its-own-peers.md).
- So crossvalidate's peer floor on eess-md rises to `>=0.11.0`, the release that adds the export.
  ADR-019 had said the delegation ships nothing an adopter can observe; its Consequences carry a
  dated correction.
- The arch rule is `eess/one-code-block-tag-comparison` in `arch.rules.ts`. It matches a `.lang`
  equality (other than with `null`/`undefined`), a method called on `.lang`, and `switch (x.lang)`.
  It misses a tag read into a variable first, a lookup keyed on it, and `x['lang']`; the rule's
  comment says so.
- The `near-miss` non-vacuity row became `capitalised-tag`: a broken block tagged `Mermaid` must be
  reported at its line. A new row, `arch/one-code-block-tag-comparison`, plants one probe per
  spelling and one `.lang === null` probe the rule must stay quiet on.

## Verification

- [x] Red test first, through `parseCodeBlocks`: `packages/md/tests/code-block-parse.test.ts`,
      `it('reads a block tagged Mermaid or MERMAID as mermaid')` and the caller-side fold, red before
      the fix and green after.
- [x] The near-miss machinery is removed with its tests and row: `NearMissTag`,
      `ParsedCodeBlocks.nearMisses`, `describeNearMisses`, the dead-glob diagnosis, and the docs'
      "Which blocks" paragraph rewritten.
- [x] One owner of the comparison; `isMermaidTag` delegates; the arch rule reds a second comparison
      (each of the three spellings measured red by hand, `.lang === null` measured quiet).
- [x] The near-miss fixtures, on both sides: ` ```mmd ` in both crossvalidate bindings, ` ```mmd `
      and ` ```json5 ` through `parseCodeBlocks`.
- [x] Two sabotages of `tagIsLanguage`: the exact comparison reds the four case tests (bugs 0423
      and 0424's included, through the built eess-md); an `mmd`/`json5` alias reds the four alias tests.
- [x] ADR-019's pending Enforcement rows moved to `gated`.
- [x] `npm run validate` green.

Deferred: none
