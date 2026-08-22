# Plan 0213: a fence caller should not have to re-attribute every violation

## Status

- **State:** Draft — **blocked on [bug 0211](../bugs/0211-diagram-sniffs-its-input-and-reads-arbitrary-files.md)**,
  and reshaped by it. Review found `diagram()`'s path-vs-source dispatch is unsound, so
  the entry point has to be split for correctness anyway; this plan is what that split
  should hand the caller, not a separate overload bolted onto the sniff.
- **Implements:** proposal 006
- **Priority:** Medium — every current and future fence consumer hand-rolls the same
  workaround, and the workaround is lossy (below).
- **Effort:** Small — **two** packages (`eess-mermaid` ships the signature via bug 0211;
  this plan rewires `eess-crossvalidate`), and **not additive**: narrowing a published
  entry point's contract is a break. An earlier draft said "one package, additive"; both
  halves were wrong. The break itself is declared by bug 0211's changeset — this plan must
  not declare a second one for the same change.
- **Created:** 2026-08-22

## Problem

`diagram(fenceString)` parses a lifted fence today, but returns a project with
`filePath: undefined`. So every violation from it is attributed to `<inline>`
(`packages/mermaid/src/conditions/class.ts:14` — `file: c.project.filePath ?? '<inline>'`)
with a line number that is an offset into the fence body, pointing at nothing on disk.

`md-mermaid` works around it by re-attributing inside `identify`:

```ts
identify: (c) => ({ name: c.name, file: doc.file, line: block.line })
```

Two costs:

1. **Every fence consumer must know to do this**, and the next one will forget. The
   workaround is a comment in one file, not a property of the API.
2. **It is lossy.** It reports the _fence opening line for every class_, discarding the
   per-class line the AST already has. So a diagram with twenty drifted classes points
   twenty findings at one line.

Under ADR-009 that is an attribution failure in the dialect's own front door: a finding an
agent cannot act on.

## Approach

Bug 0211 splits `diagram()` because content sniffing is unsound, **and lands the
`(text, provenance?)` signature with provenance unconsumed.** This plan is the wiring:

- the **path loader** reads a file and sets `filePath` as it does now;
- the **source parser** takes `(text, provenance?)` where provenance carries `{ file, line }`.

With `line` treated as an **offset**, a class at body-line _n_ reports
`docs/architecture.md:line + n` — precision no consumer has today, and strictly better
than the workaround it replaces.

**One naming hazard, called out because it is silently wrong if fumbled.** `line` is
ambiguous between "the line the fence opens on" and "the line the diagram body starts on".
`packages/md/src/model/document.ts:41` documents `MdCodeBlock.line` as the 1-based line
where the fence _starts_, so the arithmetic is `line + n`, not `line + n - 1`. Name and
document the datum precisely.

## Verification

- [ ] A violation from a fence reports the markdown file and the **class's own** line,
      not the fence opening line.
- [ ] Mutating the provenance to a constant reds a fixture. Bug 0209's matrix already has
      the half of this shape that works (`parse-error line → 1` reds 1 test).
- [ ] The standalone-`.mmd` path still reports `filePath` unchanged.
- [ ] `md-mermaid`'s `identify` workaround is removed, and its findings get _better_
      attribution than before — that is the regression test that this was worth doing.

## Out of Scope

- **The sniffing defect itself** — [bug 0211](../bugs/0211-diagram-sniffs-its-input-and-reads-arbitrary-files.md).
  This plan consumes its fix; it does not duplicate it. Sequence 0211 first.
- Whether `diagram()` keeps its name once it is one loader among several. Raised by review
  as a fifth open question on proposal 006; not settled here.
