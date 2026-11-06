# Bug 0622: an indented line like a heading ends the field header

## Status

- **State:** Fixed — 2026-11-06: a heading ends the header only with at most three spaces before its
  `#`. Measured 2026-11-05 on `main` at b2231b70 (eess-md 0.14.0).
- **Severity:** High — a false green: a value rule over `region: 'header'` passes without judging a
  record's field, while `haveField` reads the same field as present in the header, so a corpus that
  pairs the two passes with the value unchecked.
- **Origin:** inbound · a consuming project, 2026-11-05, measuring why `fields()` and `haveField`
  read one record differently ([proposal 028](../../proposals/028-md-one-documents-field-read-as-the-gate-reads-it.md)).
- **Reported:** 2026-11-05

## Symptom

Two records, a value rule over the header:

```markdown
<!-- a.md -->

# A

**Status:** open

<!-- b.md -->

# B

    ## Notes

**Status:** bogus
```

`fields(c, { label: 'Status', forms: ['bold'], region: 'header' }).should().resolveAgainst(vocabulary(c, { terms: ['open'] }))`
returns no finding with `examined` 1: `b.md`'s `bogus` is never judged. `docs(c).should().haveField(…)`
with the same options passes `b.md`, reading its `Status` in the header. Measured the same with the
line indented by a tab. A real `## Notes` heading is the control: the value rule skips `b.md` as
before, and `haveField` reports `Status at line 5 is outside the header`, so that case is not silent.
A `## Notes` inside a fence that never closes, below the field, is read correctly. Alone, `b.md` is
not silent: the rule reports that it examined zero units. The pass needs another record with a header
value, which any real corpus has.

## Root cause

`headerEnd` (`packages/md/src/model/fields.ts:158`) ends the header at the first line matching
`DEEP_HEADING`, `^\s*#{2,6}\s`, which admits any leading whitespace. `fieldLines`
(`packages/md/src/model/fields.ts:233`) hands it lines with only closed fences set aside
(`'closed-fences'`, its default), so an indented code block is still there, and four spaces or a tab
before `## Notes` match. CommonMark reads that line as code, not a heading. This is the third record
about `headerEnd`: [bug 0604](./0604-a-field-heading-in-a-non-ascii-label-ends-the-header.md)
(fixed) ended the header at a non-ASCII label heading, and
[bug 0471](../0471-the-header-region-reads-a-body-value-past-a-label-shaped-section.md) (open) has it
run too long, past a label-shaped `## X: …` section. `haveField` reads with
`'code-blocks'`, which blanks the indented block, so its header runs on past it: the two readers draw
the header's end in different places.

## Fix

Not designed. A heading ends the header only where CommonMark reads one: at most three spaces before
the `#`, and not inside code. Either `headerEnd` takes its headings from the parse tree, or it reads
the lines with every code block set aside while the field scan keeps `'closed-fences'`. The fix
measures the label-heading rule beside it (`LABEL_HEADING` allows at most three spaces already) and
the two siblings with the same `^\s*` shape. `HEADING` (`packages/md/src/model/fields.ts:140`), which
ends a continued value, is shared by both readers and does not make them disagree: an indented line
right after a value is a lazy continuation, which neither reading blanks. The `heading()` form pattern
(`packages/md/src/model/label.ts:39`) does: measured, `fields()` reads an indented `    ## Status: fake`
as a heading-form label and `haveField` sets it aside. That is the false-red direction, the same as
[proposal 028](../../proposals/028-md-one-documents-field-read-as-the-gate-reads-it.md)'s first Measured
row, not this bug's silent one. A `headerEnd` read from the parse tree
must keep [bug 0471](../0471-the-header-region-reads-a-body-value-past-a-label-shaped-section.md)'s
case reproducible.

## Fixed

`DEEP_HEADING` (`packages/md/src/model/fields.ts:148`) is `^ {0,3}#{2,6}\s`, the top-level rule:
four spaces or a tab make an indented-code or lazy-continuation line, which no longer ends the header,
and `fields()` and `haveField` draw the header's end at the same line for every case below. A line
pattern cannot see containers: a heading nested in a list item at four spaces no longer ends the header
either (it did before this fix), and a setext heading, `- ## X` and an empty `##` never did. That, and
a misattributed message after an unclosed fence, is [bug 0626](../0626-the-field-header-end-is-a-line-pattern-not-a-parse.md), with the parse-tree
`headerEnd` this record's Fix names.

`HEADING` keeps `\s*` and is shared, so the readers agree on where a value ends. The `heading()` form
keeps `\s*` and still reads an indented `    ## Status: x` that `haveField` sets aside (the false-red
direction, [proposal 028](../../proposals/028-md-one-documents-field-read-as-the-gate-reads-it.md)'s
first Measured row). This fix makes that reachable at a header's top, where the indented line used to
end the header first.

## Verification

- [x] Red first: the two records above, the value rule reports `b.md`'s `bogus`.
- [x] The tab-indented line, likewise.
- [x] Sabotage: reverting the fix (restoring `DEEP_HEADING`'s `^\s*`) reds the four-space, tab,
      space-then-tab and lazy-continuation rows (measured: 4 failed, 2 passed); the three-space and real-heading rows are
      controls, red under `^#{2,6}` and under a depth drift (the review's matrix).
- [x] The control holds: a real `## Notes` heading still ends the header, and `haveField` still says the
      field is outside it.
- [x] `haveField` and the value rule agree on where the header ends for every case above.
- [x] A changeset naming `@nielspeter/eess-md`: `.changeset/an-indented-line-is-not-a-heading.md`.
- [x] `npm run validate` green: exit 0 in 37 min 32 s on 668e81aa, the final code.

Deferred: none
