# Bug 0604: a field heading in a non-ASCII label ends the header

## Status

- **State:** Draft — measured 2026-11-02 on `main` at 39ee7ebd; no red test yet. Revised the same day
  after PR #298's method review, which measured the continuation case and the silent skip below.
- **Severity:** High — a false green. A value rule over `region: 'header'` silently skips a record
  whose header holds a non-ASCII field heading, so its value is never judged and nothing says so; and
  a value continued over lines runs on into a non-ASCII plain label below it, so the rule judges a
  wrong value. Only a presence rule (`haveField`) reds, and then with a misleading remedy ("move it
  into the header"). The trigger is narrow in English and common in a corpus written in another
  language.
- **Origin:** inbound · a consuming project, 2026-11-02, while replacing its copy of eess-md's label
  grammar with `fields()`.
- **Reported:** 2026-11-02

## Symptom

Two shape tests in eess-md read a label's letters as ASCII only (Root cause), and each misreads a
non-ASCII label. Measured against `packages/md/dist` (each probe about 0.15 s):

**The header ends at a non-ASCII field heading.** A record's header runs up to its first heading of
depth 2 or more that is not a `## Label: value` field heading (`headerEnd`,
`packages/md/src/model/fields.ts:145-156`). `## Größe: F7` is not taken for one, so the header ends
just before it. `fields(c, { …, region: 'header' })`:

| Record                                                | `Owner` (bold) | the heading's field |
| ----------------------------------------------------- | -------------- | ------------------- |
| `# T` · `## Area: F7` · `**Owner:** Ann` · `## Body`  | `Ann`, line 5  | `F7`, line 3        |
| `# T` · `## Größe: F7` · `**Owner:** Ann` · `## Body` | none           | none                |

Over two records, `a.md` with `**Owner:** Bob` in its header and `b.md` with `## Größe: F7` above `**Owner:** Zed`, the value rule
`fields(c, { label: 'Owner', forms: ['bold'], region: 'header' }).should().resolveAgainst(vocabulary(c, { terms: ['Ann', 'Bob'] }))`
is green with `examined` 1: `Zed` is never judged.

**A continued value runs into a non-ASCII plain label.** A value continued over lines ends at a line
that opens with a label's shape (`packages/md/src/model/fields.ts:200`, through
`opensWithLabelShape`, `packages/md/src/model/label.ts:103-105`). `Größe: F7` does not, so it is
read as part of the value above it. `fields(c, { label: 'Owner', forms: ['bold'] })`:

| Record                                 | `Owner`         |
| -------------------------------------- | --------------- |
| `# T` · `**Owner:** Ann` · `Area: F7`  | `Ann`           |
| `# T` · `**Owner:** Ann` · `Größe: F7` | `Ann Größe: F7` |

A field whose label is named is read in every form (`bold`, `bold-line`, `plain` and `heading` each
read `Größe: F7` when the label is `Größe`): `labelBody` takes any character. It is the shape tests
that are ASCII.

## Root cause

`LABEL_HEADING` and `PLAIN_LABEL` (`packages/md/src/model/label.ts:61,64`) spell a label's letters as
`[A-Za-z]`. They are shared by three readers:

- `fields()`' header boundary (`headerEnd`, `fields.ts:145-156`), through `LABEL_HEADING`;
- `fields()`' value continuation (`fields.ts:200`), through `PLAIN_LABEL` in `opensWithLabelShape`;
- the ledger's state reading (`packages/md/src/rules/ledger.ts:325,341,385`), whose behaviour on a
  non-ASCII label is not measured here. [Plan 0498](../plans/0498-honestyatclose-places-a-record-with-block-5.md)
  moves that reading onto `fields()`, so after it the ledger rows below read through the first two.

## Fix

Not designed. The direction: a label's letters are Unicode letters (`\p{L}`, with the `u` flag) in
both shape tests, so `## Größe: F7` continues a header and `Größe: F7` ends a value above it, as
their ASCII twins do. The fix measures the ledger's reading of a non-ASCII state label and every
caller of `PLAIN_LABEL`, and says what each now does.

## Verification

- [ ] Red first: `## Größe: F7` continues a header; `**Owner:**` below it is read in
      `region: 'header'`, and so is the heading's own value.
- [ ] Red first: over two records, the value rule above judges `b.md`'s `Owner` (red, `Zed` is not
      `Ann` or `Bob`), and `examined` is 2.
- [ ] Red first: `**Owner:** Ann` above `Größe: F7` reads `Ann`.
- [ ] `## Area: F7` and `Area: F7` read as before; a non-label heading (`## Background`) still ends
      the header.
- [ ] The ledger's reading of a non-ASCII state label is measured and pinned by a row.
- [ ] A changeset naming `@nielspeter/eess-md`.
- [ ] `npm run validate` green.

Deferred: none
