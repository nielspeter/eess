# Bug 0520: waivers in a text corpus are refused, so directive placement can't be tested in memory

## Status

- **State:** Draft — recorded 2026-10-19 from PR #251's product review of [plan 0455](../plans/completed/0455-a-corpus-built-from-text.md). Owned since 2026-11-06 by [plan 0632](../plans/0632-a-text-corpus-honours-its-waivers.md).
- **Severity:** Low — nothing passes that should fail: the waiver is refused loudly ([ADR-009](../../adr/009-agent-first-failure-surfaces.md)), and
  `corpus()` over a fixture tests it. What is lost is convenience: a caller cannot test where a
  `<!-- eess-exclude … -->` directive sits, or that it waives the finding it names, with an in-memory
  corpus.
- **Origin:** review · PR #251, product finding P1 on [plan 0455](../plans/completed/0455-a-corpus-built-from-text.md)
- **Owner:** the kernel, decided by [ADR-024](../../adr/024-a-claimed-files-waivers-are-read-from-its-registered-text.md) (extending [ADR-012](../../adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md)): a dialect registers a root's texts.
- **Reported:** 2026-10-19

Note 2026-11-05: a second asker. A consuming project reads one record's field from text through
`corpusFromText`, and its valid record throws because it holds a waiver directive it never meant to
apply ([proposal 028](../proposals/028-md-one-documents-field-read-as-the-gate-reads-it.md)).

Note 2026-11-06: owned by [plan 0632](../plans/0632-a-text-corpus-honours-its-waivers.md). The consuming project's plan
125 waits on it. Measured at v0.19.0 over the 592 `.md` files `git ls-files 'work/**/*.md'` lists:
2 hold a waiver directive, so one `corpusFromText` over all of them is refused. With the four files at
the top of `work/`, 596 in all, 3 do.

## Symptom

`corpusFromText` ([plan 0455](../plans/completed/0455-a-corpus-built-from-text.md)) throws an `ArchConfigError` for any loaded document in which the
kernel's `parseExclusionComments` reports an exclusion or a warning. It has to: the kernel reads a
violating file's waivers from disk by its path (`packages/core/src/execute-rule.ts`, the exclusion
scan), and a text corpus's documents are not on disk, so the waiver would silently not apply.

## Why it is not an eess-md fix

Reading waivers from the map inside eess-md would be a second waiver reader beside the kernel's, the
duplication [ADR-012](../../adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md) removed. The fix is a capability the kernel takes from its caller: the source
text of a violating file, so a dialect whose files are not on disk can hand it over. Once the kernel
has it, `corpusFromText` registers its reader there and drops the refusal.

## Out of scope

- [Plan 0455](../plans/completed/0455-a-corpus-built-from-text.md)'s refusal itself, which stays until this is fixed.
