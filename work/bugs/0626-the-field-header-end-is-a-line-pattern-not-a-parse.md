# Bug 0626: the field header's end is a line pattern, not a parse

## Status

- **State:** Draft — measured 2026-11-06 by the enforcement review of
  [bug 0622](./fixed/0622-an-indented-line-like-a-heading-ends-the-field-header.md)'s fix, on
  `fix/0622-indented-heading` (eess-md 0.14.0 plus that fix); no red test yet.
- **Severity:** Medium — `haveField` passes a body field as a header field for the shapes below, but
  each is rare in a record, and the value rule over the header judges the field (it does not go
  silent).
- **Origin:** self-found · the enforcement review of
  [bug 0622](./fixed/0622-an-indented-line-like-a-heading-ends-the-field-header.md)'s fix, 2026-11-06.
- **Reported:** 2026-11-06

## Symptom

`fields()`' header (`region: 'header'`, also `haveField`'s) ends at the first line `DEEP_HEADING`
(`packages/md/src/model/fields.ts:148`) matches, a line pattern. Where the parse disagrees with the
pattern, the header's end is wrong. Measured with `forms: ['bold', 'heading']`, a second record
supplying a header value:

| shape above `**Status:** bogus`                                   | the parse                         | the header                                                                                                                                                                                            |
| ----------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `- item`, blank, `    ## Notes` (a heading nested in a list item) | a depth-2 heading                 | runs past it; `haveField` passes the field as a header field. New with [bug 0622](./fixed/0622-an-indented-line-like-a-heading-ends-the-field-header.md)'s fix, which was "outside the header" before |
| `1.  item`, blank, `    ## Notes`                                 | a depth-2 heading                 | likewise                                                                                                                                                                                              |
| `- ## Notes`, `> ## Notes`                                        | a heading in a list item or quote | runs past it (before [bug 0622](./fixed/0622-an-indented-line-like-a-heading-ends-the-field-header.md) too)                                                                                           |
| a setext `Notes` / `-----`                                        | a depth-2 heading                 | runs past it                                                                                                                                                                                          |
| `##` alone                                                        | an empty depth-2 heading          | runs past it                                                                                                                                                                                          |
| `<div>`, `## Notes`, `</div>`                                     | HTML, not a heading               | ends at it (the false-red direction)                                                                                                                                                                  |

A related misattribution: with a `## Notes` inside a fence that never closes, above the field,
`haveField` says "no Status field … it carries no wrapped label" while `**Status:**` is in the file.
The `'closed-fences'` code probe (`packages/md/src/model/field-verdict.ts:293`) reads the header-cut
lines, so it never reaches the field.

## Root cause

`headerEnd` (`packages/md/src/model/fields.ts:158`) reads text lines; it cannot tell a heading nested
in a container from indented code, nor see a setext heading or an HTML block. [Bug 0622](./fixed/0622-an-indented-line-like-a-heading-ends-the-field-header.md)'s fix limited
the indent to three spaces, the top-level rule, which is right outside containers and wrong inside a
list item.

## Fix

Not designed. `headerEnd` takes its headings from the parse tree (the document's `root`), so a heading
ends the header exactly where the parse has one at depth 2 or more, and nowhere else. It must keep
[bug 0471](./0471-the-header-region-reads-a-body-value-past-a-label-shaped-section.md)'s case
reproducible, and [bug 0622](./fixed/0622-an-indented-line-like-a-heading-ends-the-field-header.md)'s
rows green.

## Verification

- [ ] Red first: each shape in the table ends the header where the parse has a heading, and only there.
- [ ] The unclosed-fence case names the fence, not a missing label.
- [ ] [Bug 0622](./fixed/0622-an-indented-line-like-a-heading-ends-the-field-header.md)'s six rows and [bug 0471](./0471-the-header-region-reads-a-body-value-past-a-label-shaped-section.md)'s reproduction unchanged.
- [ ] A changeset naming `@nielspeter/eess-md`.
- [ ] `npm run validate` green.

Deferred: none
