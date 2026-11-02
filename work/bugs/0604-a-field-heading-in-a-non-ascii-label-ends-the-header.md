# Bug 0604: a field heading in a non-ASCII label ends the header

## Status

- **State:** Draft — measured 2026-11-02 on `main` at 39ee7ebd; no red test yet.
- **Severity:** Medium — fail-closed but wrong: a header field below such a heading is read as
  absent, so a required-field rule reds a record that holds the field, and the heading's own value is
  not read in `region: 'header'`.
- **Origin:** inbound · a consuming project, 2026-11-02, while replacing its copy of eess-md's label
  grammar with `fields()`.
- **Reported:** 2026-11-02

## Symptom

A record's header runs up to its first heading of depth 2 or more that is not a `## Label: value`
field heading (`packages/md/src/model/fields.ts:147-154`). Whether a heading is a field heading is
decided by `LABEL_HEADING` (`packages/md/src/model/label.ts:61`), whose label is
`[A-Za-z][A-Za-z ]{0,40}`: ASCII letters only. So `## Größe: F7` is not a field heading, and the
header ends just before it.

Measured against `packages/md/dist` (0.14 s), `fields(c, { …, region: 'header' })` over two records
that differ only in one letter:

| Record                                                | `Owner` (bold) | the heading's field |
| ----------------------------------------------------- | -------------- | ------------------- |
| `# T` · `## Area: F7` · `**Owner:** Ann` · `## Body`  | `Ann`, line 5  | `F7`, line 3        |
| `# T` · `## Größe: F7` · `**Owner:** Ann` · `## Body` | none           | none                |

With no region, every form reads `Größe: F7` (`bold`, `bold-line`, `plain` and `heading`, each
with the label named): the defect is the header boundary, not the field reader.

## Root cause

`LABEL_HEADING` and `PLAIN_LABEL` (`packages/md/src/model/label.ts:61,64`) spell a label's letters
as ASCII, while `labelBody`, which reads a label the caller names, takes any character. The two
shape tests are shared: `fields()`' header boundary, and the ledger's state reading
(`packages/md/src/rules/ledger.ts:325,341,385`), whose behaviour on a non-ASCII label is not measured
here.

## Fix

Not designed. The direction: a label's letters are Unicode letters (`\p{L}`, with the `u` flag) in
both shape tests, so `## Größe: F7` continues a header as `## Area: F7` does. The fix measures the
ledger's reading of a non-ASCII state label and `PLAIN_LABEL`'s callers, and says what each now does.

## Verification

- [ ] Red first: `## Größe: F7` continues a header; `**Owner:**` below it is read in
      `region: 'header'`, and so is the heading's own value.
- [ ] `## Area: F7` reads as before; a non-label heading (`## Background`) still ends the header.
- [ ] The ledger's reading of a non-ASCII state label is measured and pinned by a row.
- [ ] A changeset naming `@nielspeter/eess-md`.
- [ ] `npm run validate` green.

Deferred: none
