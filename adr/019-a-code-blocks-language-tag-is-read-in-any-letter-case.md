# ADR-019: A code block's language tag is read in any letter case

- **Status:** Accepted (2026-10-15). Decided at plan 0413's freeze (PR #217); the architect review of
  that freeze asked for it as an ADR rather than a bug's Fix section, because it reverses a ruled
  condition, removes public API and claims the whole family. Overrulable like any ADR.
- **Context:** [proposal 006](../work/proposals/006-mermaid-beyond-classdiagram.md) condition 10 and
  its 2026-10-15 note, [bug 0423](../work/bugs/fixed/0423-a-capitalised-mermaid-fence-is-skipped-in-silence.md),
  [bug 0424](../work/bugs/fixed/0424-a-capitalised-mermaid-er-fence-is-skipped-in-silence.md),
  [bug 0426](../work/bugs/0426-parsecodeblocks-and-md-mermaid-read-the-mermaid-tag-differently.md),
  [plan 0413](../work/plans/0413-eess-mermaid-ships-mermaids-own-parser.md)

## The question

A fenced code block names its language in its info string: ` ```mermaid `, ` ```json `. Two parts of
the family select blocks by that tag, and they read it differently. eess-crossvalidate's Mermaid
bindings compare it case-insensitively since bugs 0423 and 0424, so ` ```Mermaid ` is read.
eess-md's `parseCodeBlocks` compares it exactly, does not read ` ```Mermaid `, and discloses it as a
"near miss" telling the author to retag it. One fence gets two answers to "is this Mermaid?", and
proposal 006 had ruled the exact reading (condition 10).

## Decision

**Every part of the family that selects a code block by its language tag compares the tag
case-insensitively.** ` ```Mermaid `, ` ```MERMAID ` and ` ```mermaid ` are one language. Nothing else
in the tag is normalised: no trimming of other words, no aliases (` ```mmd ` is not `mermaid`).

Consequences for what exists:

- eess-crossvalidate already reads the tag this way (`isMermaidTag` in
  `packages/crossvalidate/src/shared.ts`).
- eess-md's `parseCodeBlocks` changes to it (bug 0426). The near-miss disclosure, which existed only
  to report a case difference, goes with its public API (`NearMissTag`,
  `ParsedCodeBlocks.nearMisses`): a **Breaking** eess-md minor.
- A future reader of fence tags, in any dialect, follows it.

## Why this, and not the alternatives

- **Exact matching, with the near miss disclosed** (proposal 006's ruling). Honest, but it makes the
  author retag a fence whose meaning is plain and that renderers commonly treat the same way, and it
  leaves the family split, since crossvalidate already reads both. A finding whose only remedy is
  "change the letter case" protects nothing.
- **Exact matching everywhere**, reverting bugs 0423 and 0424. That brings back the false green those
  bugs fixed: a ` ```Mermaid ` diagram that drifted from its code was neither compared nor counted.
- **Leave each reader to choose.** That is the split this ADR exists to end. One word meaning one
  thing across the family is the rule ADR-017 set for predicate names; a language tag is the same kind
  of word.

What was not measured: how GitHub and other renderers treat ` ```Mermaid `. The decision does not rest
on it; it rests on the family agreeing with itself and on the false green above.

## Consequences

- A corpus that tagged a fence ` ```Mermaid ` gets it checked by eess-md after bug 0426, so a green
  build can go red on a block it used to disclose. The eess-md changeset says so.
- No ADR or code keeps a list of tag spellings; case is the only normalisation.

## Enforcement

| Clause                                                  | Tier | Mechanism                                                                                                                                                                                                                                                                                                                                     | Status  |
| ------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| **C1** — eess-crossvalidate reads the tag in any case   | 2    | `packages/crossvalidate/tests/md-mermaid.test.ts` (the ` ```Mermaid ` fence of bug 0423) and `packages/crossvalidate/tests/md-mermaid-er.test.ts` (bug 0424's). Cited by file, not by `it()` title, because `check:crossval` resolves titles against eess-ts's tests only ([bug 0262](../work/bugs/0262-an-adr-cannot-cite-a-kernel-test.md)) | gated   |
| **C1** — eess-md reads the tag in any case              | 2    | Bug 0426's red-first test, through `parseCodeBlocks`; not built yet                                                                                                                                                                                                                                                                           | pending |
| **C2** — eess-crossvalidate normalises nothing but case | 2    | `packages/crossvalidate/tests/md-mermaid-er.test.ts`: an erDiagram in a fence tagged as another language is not read. Cited by file, for the same reason as C1                                                                                                                                                                                | gated   |
| **C2** — eess-md normalises nothing but case            | 2    | Bug 0426's test: a fence tagged `json5` is not read as `json`; not built yet                                                                                                                                                                                                                                                                  | pending |
| **C3** — a future tag reader follows this ADR           | 5    | Ratification at review; no gate can see a reader that does not exist yet                                                                                                                                                                                                                                                                      | manual  |
