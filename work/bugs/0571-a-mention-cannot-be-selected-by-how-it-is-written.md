# Bug 0571: a mention cannot be selected by how it is written: in inline code, or escaped

## Status

- **State:** Draft — found 2026-10-31 building [bug 0558](./0558-a-reference-style-or-raw-html-link-is-never-examined.md)'s dangling-reference example; measured; no red
  test yet.
- **Severity:** Medium — a false red with no remedy inside the rule: a match in inline code, or
  in text an author escaped so it shows literally, is matched like markup, and no public block
  leaves it out.
- **Origin:** self-found · PR #284, building `examples/md/a-reference-with-no-definition-is-reported.test.ts`.
- **Reported:** 2026-10-31

## Symptom

`mentions()` matches its pattern against the text the parser decoded, so a backslash escape is
gone before the pattern sees it, and the text of inline code is read like prose (by design, so
backticks do not hide a record's mention). Two facts a rule needs for a bracket shape are
therefore out of reach:

1. **In inline code.** A mention carries `inCode`, but eess-md exports no predicate that selects
   by it, and an example may compose only public blocks (`arch.rules.ts:125`, [plan 0458](../plans/completed/0458-the-examples-gate-a-document-shape-from-public-blocks-only.md)), so
   `matrix[i][j]` in a code span cannot be left out of a rule built from the documented API.
2. **Escaped.** Nothing records that a match was written with a backslash escape, so
   `\[text\]\[label\]`, written so the brackets show, cannot be left out at all.

## Reproduction

`docs/a.md` holds `The syntax is \[text\]\[label\], escaped so it shows.`. The example's rule,
`mentions(c, { pattern: /\[[^[\]\n]+\]\[[^[\]\n]*\]/g })` with `.that().satisfy(not(inCode))
.and().satisfy(not(areLinked())).should().notExist()`, measured on main's build:

```text
["docs/a.md:3 should not exist"]
```

## Fix

Not chosen. Following the `areLinked()` precedent: exported predicates over a mention's facts,
one for `inCode` and one for a new `escaped` fact (any part of the match written with a backslash
escape, read from the source by offset), so a rule leaves such matches out with
`satisfy(not(…))`. Record patterns are unaffected unless they choose to use them. Then
`examples/md/a-reference-with-no-definition-is-reported.test.ts` adds both to its rule.

## Verification

- [ ] Red test written first: the reproduction's match is selected by the escaped predicate, and
      the example's rule leaving it out reports nothing.
- [ ] A match in inline code is selected by the in-code predicate; an unescaped prose match by
      neither.
- [ ] The example's rule uses both, and its clean fixture holds `matrix[i][j]` in a code span.
- [ ] A changeset naming `@nielspeter/eess-md`.
- [ ] `npm run validate` green.

Deferred: none
