# Bug 0426: parseCodeBlocks and md-mermaid read the Mermaid tag differently

## Status

- **State:** Draft — recorded 2026-10-15 at plan 0413's freeze, which settled the rule. No red test yet.
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

`packages/md/src/model/code-block-parse.ts:296` tests `block.lang === language`; a tag equal only when
case-folded goes to `nearMisses`. Plan 0412 chose exact matching before bug 0423 chose the other way.

## Fix

**Decided at plan 0413's freeze, 2026-10-15, overrulable: a tag is matched case-insensitively,
family-wide.** A fence tagged `Mermaid` (or `JSON`) is plainly meant as that language, and reading it
needs nothing from the author. So `parseCodeBlocks` reads a tag equal to the language when case-folded.
The near-miss disclosure then has nothing left to disclose for a case difference, and goes, with its
tests, its non-vacuity row (`near-miss` in `scripts/nonvacuity/bad-code-block-parse.mjs`) and the docs'
"Which blocks" paragraph rewritten. That removes public API: the `NearMissTag` export and the
`ParsedCodeBlocks.nearMisses` field, unless a reason to keep them is recorded. eess-md takes a minor
whose changeset carries a `**Breaking**` line: an export goes, and a block that was disclosed is now
parsed, so a green build can go red. Proposal 006's condition 10 gets a dated note.

## Verification

- [ ] Red test first, through `parseCodeBlocks`: a `Mermaid`-tagged block is parsed and examined.
- [ ] The near-miss machinery is removed with its tests and row, or kept only for a reason stated here.
- [ ] `npm run validate` green.

Deferred: none
