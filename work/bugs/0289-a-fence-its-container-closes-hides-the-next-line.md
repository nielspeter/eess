# Bug 0289: a fence its container closes hides the next line from `pointers()`

## Status

- **State:** Draft. Measured end to end on `main`; no red test yet.
- **Severity:** **High**. A **fail-open in a gated rule**: `pointers().resolve()`, which runs as this repository's `corpus/pointers-resolve`, passes a pointer to a file that does not exist, in five shapes. Each shape needs an unclosed fence that its list item or blockquote ends.
- **Origin:** self-found · design review of a fence-handling fix
- **Reported:** 2026-09-13

## Symptom

When a list item or blockquote ends a code block, the block's end position sits at column 1 of the following line. The pointer reader counts that following line as code, so a pointer written there is never checked.

## Reproduce

Each document below is exact. It is checked beside a document holding one live pointer, so the verdict carries evidence. The rule is `pointers(c).that().areLive().should().resolve().violations()`, on `main` at `2a2a503`.

Shape 1: an unclosed fence in an ordered item, then a nested bullet.

````text
1. ```
  - see `missing.ts:1`
````

Shape 2: an unclosed fence in an ordered item, then a bullet.

````text
1. Run:
   ```sh
   npm test
- see `missing.ts:1`
````

Shape 3: an unclosed fence in a bullet, then a bullet.

````text
- a
  ```
  x
- see `missing.ts:1`
````

Shape 4: an unclosed fence in a blockquote, then a bullet.

````text
> ```
> x
- see `missing.ts:1`
````

Shape 5: minimal, found by deleting lines while the defect held.

`````text
1. ```
  - ````a`b `missing.ts:1`
`````

Control A: the pointer in plain prose.

```text
see `missing.ts:1`
```

Control B: shape 2 with the fence closed.

````text
1. Run:
   ```sh
   npm test
   ```
- see `missing.ts:1`
````

Control C: the pointer on the last line of an unclosed fence at end of file, with no trailing newline. That line is code, so it must produce no pointer finding. A future report of the unclosed fence itself does not break this control.

````text
# Doc

```
see `missing.ts:1`
````

| Document         | Result      |
| ---------------- | ----------- |
| Controls A and B | reported    |
| Control C        | not checked |
| Shapes 1–5       | **silent**  |

## Root cause

A unist position's end is exclusive. A code block that its container ends has its end at column 1 of the next line, but `packages/md/src/model/pointers.ts:37` records the block's range as `[start.line, end.line]`, so that next line is counted inside it.

## The corruption that must produce a violation

After a code block that its container ends, a line that CommonMark renders as prose must be read: a missing-file pointer there is reported. Control C's line stays code: no pointer finding there.

## Measured fact for a fix

When `end.column` is 1, take the last line as `end.line - 1`.

- **Evidence.** That rule agreed with commonmark.js on every non-blank line measured, across generated documents and this repository's markdown.
- **Instrument.** The instrument is not kept in the repository. Its counts show that the shapes exist, not how often adopters write them.
- **Coverage.** A red test must include control C, which catches the reverse mistake of always taking the line before.

## Verification ledger

- [x] Shapes 1–5 are silent on `main`; controls A–C behave.
- [ ] Red tests: shapes 1–5, and controls A–C.
- [ ] The fix.
- [ ] A `scripts/check-nonvacuity.mjs` row on shape 3.

## Related

- [0215](./0215-pointer-gate-proves-existence-not-aboutness.md): the pointer gate's other blind spot.
- [0290](./0290-a-code-block-nested-in-a-list-is-never-checked.md): the same document model missing nested blocks.
