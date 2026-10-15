# Bug 0431: an untagged fence is Mermaid to one binding only

## Status

- **State:** Draft — recorded 2026-10-15 from PR #221's reviews of ADR-019. Not yet decided.
- **Severity:** Low — no false green today: the binding that reads an untagged fence reads more, not
  less. The defect is that one fence gets different answers to "is this Mermaid?".
- **Origin:** self-found · PR #221's architect and method reviews, 2026-10-15.
- **Reported:** 2026-10-15

## Symptom

An untagged fence whose diagram is an `erDiagram` is read by `tableErAgree`
(`packages/crossvalidate/src/md-mermaid-er.ts:65`, pinned by `it('still reads an untagged erDiagram')`).
An untagged `classDiagram` is not read by `embeddedDiagramsMatchCode`
(`packages/crossvalidate/src/md-mermaid.ts:161`), and eess-md's `parseCodeBlocks` reads no untagged
block (`packages/md/src/model/code-block-parse.ts:287`).

## Root cause

ADR-019 decides how a tag is compared, not whether a block with no tag can be selected by its
content. The ER binding chose to, so an untagged schema diagram is not skipped; no other reader did.

## Fix

Undecided. Either every Mermaid reader selects an untagged block by its declared kind, or none does
and the ER binding's untagged read is reported instead of selected. Decide from ADR-009 (a skip that
reads as a pass) before choosing; the ER binding's branch was kept because dropping it brought back a
silent skip.

## Verification

- [ ] The rule decided and recorded (ADR-019's scope note, or an amendment)
- [ ] Red test first for the reader that changes

Deferred: none
