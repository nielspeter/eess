# Bug 0604: a field heading in a non-ASCII label ends the header

## Status

- **State:** Fixed — a label's letters are Unicode letters in both shape tests (2026-11-04).
  Measured 2026-11-02 on `main` at 39ee7ebd.
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
  non-ASCII label is not measured here. [Plan 0498](../../plans/0498-honestyatclose-places-a-record-with-block-5.md)
  moves that reading onto `fields()`, so after it the ledger rows below read through the first two.

## Fix

`LABEL_HEADING` and `PLAIN_LABEL` (`packages/md/src/model/label.ts`) read a label's letters as
`\p{L}`, with the `u` flag, so `## Größe: F7` continues a header and `Größe: F7` ends a value above
it, as their ASCII twins do. A label's letters may carry combining marks (`\p{M}`), so an NFD-normalised `Größe` or a
Devanagari label is one too (the review, measured). Their callers, measured: `fields()`' header
boundary (`headerEnd`) and value continuation (through `opensWithLabelShape`) read a non-ASCII
label as an ASCII one; and the ledger, which this record first said was unchanged, changed too
(the review measured it): `findState` now reads a state below a non-ASCII field heading
(`packages/md/src/rules/ledger.ts:385`), so `honestyAtClose`, which was green with examined 2 over a
closed record outside its done folder, now reports `ledger/state-folder-mismatch`, and a plain
non-ASCII state label (`:341`) is named as "a state under another label" rather than "no readable
state". Nothing else builds on either regex's source.

## Verification

- [x] Red first: `## Größe: F7` continues a header; `**Owner:**` below it is read in
      `region: 'header'`, and so is the heading's own value: `packages/md/tests/builders/fields-non-ascii-label.test.ts` ·
      `it('## Größe: F7 continues the header, its own value and the bold field below are read')`;
      three of the file's rows red against main's `label.ts` (measured).
- [x] Red first: over two records, the value rule above judges `b.md`'s `Owner` (red, `Zed` is not
      `Ann` or `Bob`), and `examined` is 2: `it('a value rule over the header judges every record')`.
- [x] Red first: `**Owner:** Ann` above `Größe: F7` reads `Ann`: `it('a continued value ends at a non-ASCII plain label')`.
- [x] `## Area: F7` and `Area: F7` read as before; a non-label heading (`## Background`) still ends
      the header: `it('ASCII labels read as before, and a heading that is no label still ends the header')`.
- [x] The ledger's reading of a non-ASCII state label is measured and pinned by a row:
      `it('honestyAtClose reads a state below a non-ASCII field heading, so a misplaced close reds')`,
      red on main (the review measured `[]`, examined 2); combining marks by
      `it('a label with combining marks is a label: NFD Latin and Devanagari')`. Label shapes still
      unread (a full-width colon, digits, apostrophes, hyphens) are [bug 0620](../0620-some-label-shapes-are-still-not-read-as-labels.md).
- [x] A changeset naming `@nielspeter/eess-md`: `.changeset/a-non-ascii-label-is-a-label.md`.
- [x] `npm run validate` green.

Deferred: none
