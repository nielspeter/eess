# Bug 0291: the kernel's markdown masker honours a directive written inside code, and no dialect the kernel executes can supply a better one

## Status

- **State:** Draft. Measured end to end on `main`. No red test yet, and no fix has been designed.
- **Severity:** **High**. It is a **fail-open on the waiver path**: a teaching example of an exclusion comment, written inside code, silently waives a real finding on the next line.
  - **Precondition.** The single-line form needs two things: the example names the violated rule's id, and it sits directly above the violating line. The region form reaches more shapes.
  - **No live instance found here.** Measured on `main`'s kernel over this repository's markdown, with commonmark.js deciding which lines are code: no directive line inside code is honoured. The region-merging shape below was not searched for.
- **Origin:** self-found · enforcement and testing reviews of a fence-handling fix
- **Reported:** 2026-09-13

## Symptom

The kernel reads exclusion comments in a markdown file through `maskMarkdownCodeSpans` (`packages/core/src/mask-non-comment.ts:171`). The routing is at `packages/core/src/exclusion-comments.ts:393`.

That masker finds fences with a line loop, which gets code wrong in two ways:

- **Containers.** The loop does not see list items or blockquotes.
- **Closers.** It opens a fence at any indentation (`packages/core/src/mask-non-comment.ts:178`). It closes on a run of the same character at least as long, even one followed by an info string (`packages/core/src/mask-non-comment.ts:184`). CommonMark does not treat such a line as a closer.
- **Indentation.** It blanks every line indented four spaces (`packages/core/src/mask-non-comment.ts:203`), including an exclusion region's `-end` or `-start` written inside a list item, which CommonMark calls prose. The region then runs on to the next `-end`.

A directive on a line that CommonMark calls code, but the loop calls prose, is honoured. So is a directive inside `<pre>`.

## Reproduce

Each document puts a pointer to a missing file on its last line, beside a document with one live pointer. The rule is `pointers(c).that().areLive().should().resolve().rule({ id: 'corpus/pointers-resolve' }).violations()`, on `main` at `2a2a503`.

````text
D1: a directive inside a blockquoted fence
> ```md
> <!-- eess-exclude corpus/pointers-resolve: teaching the syntax -->
see `missing.ts:1`

D2: a directive inside a list-item fence
- ```md
  <!-- eess-exclude corpus/pointers-resolve: teaching the syntax -->
see `missing.ts:1`
````

| Document                              | Result     |
| ------------------------------------- | ---------- |
| the fence with no directive (control) | reported   |
| a real directive in prose (control)   | waived     |
| D1                                    | **waived** |
| D2                                    | **waived** |

The control is D1's document with the directive line replaced by `> example`.

**D3: a region widened with no directive inside code.** The document is in ADR-012's property 2 correction: two exclusion regions whose inner delimiters sit inside list items, indented four spaces. The default merges them into one exclusion covering lines 1–14, and the missing-file pointer on line 6, between the regions, is **silent**. With the same delimiters at column 0, the exclusions are lines 1–4 and 10–14 and the pointer is reported.

**Directly through the parser.** `parseExclusionComments('<pre>\n<!-- eess-exclude a/b: teaching -->\n</pre>\ntarget\n', 'doc.md')` returns one live exclusion.

**Across generated documents,** each with a directive on every code line and one in prose after the block, on `main`'s kernel:

- **Inside code:** 20,845 of 44,100 directives are honoured.
- **In prose:** 5,149 of 15,750 are dropped.

These counts come from an instrument not kept in the repository. They show that the shapes exist, not how often adopters write them.

## Root cause

1. **The default is not conservative for markdown.** A line loop cannot prove a line is prose once containers are involved.
2. **No dialect can supply accuracy.** The kernel's rule executor calls `parseExclusionComments(sourceText, filePath)` with no masker (`packages/core/src/execute-rule.ts:151`), although the parser accepts one and runs it first (`packages/core/src/exclusion-comments.ts:400`). A masker also receives only text and a path (`packages/core/src/exclusion-comments.ts:355`), not a document.

## The corruption that must produce a violation

A directive written inside code, or inside `<pre>`, must waive nothing:

- at top level;
- in a list item;
- in a blockquote;
- after a closer that carries an info string (region form).

A real directive in prose must keep waiving, and a region must end at its `-end` when CommonMark renders that line as prose: hiding a delimiter must not widen a waiver (D3).

## Measured constraints for a fix

None of these is a design; each rules one out or costs it.

- **Injecting exact code lines closes the silent direction.** With a masker that blanks the lines a markdown parser calls code, in-code directives honoured drop to 0 under the shipped default.
- **A conservative default costs loudly, and sometimes silently.** Blanking more is not safe for regions: a hidden `-end` widens a waiver (D3). A kernel spike that never closes a fence once one is seen honoured 0 in-code directives. It had three costs:
  - Without injection, it dropped every prose directive after a fence.
  - It left a documented region-form waiver inert: a README with an install fence above a waived table went from 1 exclusion to 0, with **no warning**.
  - It had no HTML rule, so a directive in `<pre>` still applied.
- **Composition cannot bound an injected masker.** ADR-012's property 3 is false for any default that tracks lexer state; see ADR-012's 2026-09-13 correction. A masker that blanks only a fence's delimiter lines makes the parser honour an `eess-exclude-start` written inside the fence. A fix that injects a masker must test the masker itself.

## Verification ledger

- [x] D1 and D2 waive a real finding on `main`; both controls behave.
- [x] A directive inside `<pre>` is honoured on `main`.
- [x] The executor passes no masker, and a masker receives only text and a path.
- [ ] A design for the fix, recorded before it is built.
- [ ] Red tests: D1, D2, `<pre>` and the region form waive nothing; a prose directive still waives.
- [ ] A non-vacuity row: a directive inside a nested fence must not waive, and D3's pointer must report.
- [ ] Correct the two code comments that restate the false property: `packages/core/src/exclusion-comments.ts:361` and `packages/core/src/mask-non-comment.ts:201`.

## Related

- [ADR-012](../../adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md): the properties this breaks, with their dated corrections.
- [0154](./fixed/0154-a-directive-inside-a-string-literal-suppresses-a-real-violation.md): the same direction in code files.
- [0293](./0293-an-example-inside-an-html-block-is-read-as-prose.md): HTML blocks read as prose.
