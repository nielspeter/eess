# Bug 0588: `agreeWithFolder` never checks its field's region

## Status

- **State:** Draft — reproduced 2026-11-01 on `packages/md/dist`, built from the current tree; no
  red test yet.
- **Severity:** Low — fails closed: the run throws, but with a `TypeError` from eess-md's
  internals instead of an `ArchConfigError` that names the option.
- **Origin:** self-found ·
  [proposal 025](../proposals/025-md-a-field-written-empty-can-mean-absent.md)'s architect review,
  which found it by reading; reproduced before filing.
- **Reported:** 2026-11-01

## Symptom

`checkRegion` (`packages/md/src/model/fields.ts:63`) refuses a region that is neither `'header'`
nor `{ section, depth? }`, and a depth outside 1 to 6. `haveField` calls it
(`packages/md/src/builders/have-field.ts:45`), and so does `fields()`
(`packages/md/src/builders/vocabulary.ts:277`). `agreeWithFolder`
([plan 0495](../plans/completed/0495-a-value-agrees-with-its-folder.md)) reads the same
`FieldOptions` (`packages/md/src/conditions/agree-with-folder.ts:32`), but its own refusals
(`refuse`, `packages/md/src/conditions/agree-with-folder.ts:73`) never call `checkRegion`.

So a misspelt region is not refused. The rule builds, and when it runs it throws
`TypeError: Cannot read properties of undefined (reading 'global')`. The message names no option,
so the author does not know what to fix. A depth of 7 is not refused either. It becomes one finding
per document instead of one configuration finding.

The TypeScript type rejects `region: 'heder'`, so that crash reaches a rule file written in plain
JavaScript, or a region built at run time. `{ section: 'Status', depth: 7 }` is type-legal.

## Reproduction

One document, `done/a.md`, holding `**Confirmed:** yes` (under `## Status` for the depth case). The
same `field` is given to `haveField` and to `agreeWithFolder`, with
`direction: 'both', groups: [{ name: 'done', values: ['yes'], folders: ['done/**'] }]`. Measured
with a throwaway script against `packages/md/dist`, 0.14 s per run:

```text
-- region "heder"
haveField: refused at build: ArchConfigError - haveField: region must be 'header' or { section, depth? }, got "heder"
agreeWithFolder: built without refusal
agreeWithFolder at run: TypeError - Cannot read properties of undefined (reading 'global')
    at stateless (file:///.../packages/md/dist/model/name-match.js:10:13)
    at matchName (file:///.../packages/md/dist/model/name-match.js:21:56)
    at file:///.../packages/md/dist/model/sections.js:46:88
-- region {"sectoin":"Status"}
haveField: refused at build: ArchConfigError - haveField: region must be 'header' or { section, depth? }, got {"sectoin":"Status"}
agreeWithFolder: built without refusal
agreeWithFolder at run: TypeError - Cannot read properties of undefined (reading 'global')
    (same stack)
-- region {"section":"Status","depth":7}
haveField: refused at build: ArchConfigError - haveField: depth must be an integer from 1 to 6 (a heading's level), got 7
agreeWithFolder: built without refusal
violation: .../fx/done/a.md 1 - done/a.md is in yes's folders and has no section "Status" at depth 7 to read Confirmed from (region); "Status" at line 3 is at depth 2
```

For comparison, `agreeWithFolder`'s other refusals also fire when the rule runs, not when it is
built. A bad `direction` builds, and then `violations()` throws
`ArchConfigError - agreeWithFolder: direction must be one of left-to-right, right-to-left, both; it has no default`.
So the defect is not "refused at run instead of at build". It is that the region is not refused at
all.

## Root cause

`refuse` checks `direction`, `groups`, their values and their folders, and nothing in `field`. A
region with no `section` reaches `sectionsMatching`, which hands the missing name to `matchName`
(`packages/md/src/model/sections.ts:81`). `matchName` treats anything that is not a string as a
`RegExp` (`packages/md/src/model/name-match.ts:22`), and `stateless` reads `.global` on
`undefined` (`packages/md/src/model/name-match.ts:12`).

There is no single check for `FieldOptions`. Each reader calls `checkRegion` itself, and the third
reader was written without the call.

## Fix

Call `checkRegion(o.field.region, 'agreeWithFolder')` from `refuse`, so a bad region is an
`ArchConfigError` that names the option, at the same point as the rule's other refusals.

[Proposal 025](../proposals/025-md-a-field-written-empty-can-mean-absent.md)'s review suggests one
`checkFieldOptions(options, call)` in `fields.ts`, called from all three readers, so that a new
field option cannot miss one of them. Whether this fix is that function, or is built inside that
proposal's plan, is the plan's call to make.

## Verification

- [ ] Red test written first, through `docs().should().agreeWithFolder()`: a region of `'heder'`
      is an `ArchConfigError` naming `region`, not a `TypeError`.
- [ ] A section region with a depth of 7 is one `ArchConfigError`, not a finding per document.
- [ ] A valid `'header'` region and a valid `{ section, depth }` region still run as before.
- [ ] A changeset naming `@nielspeter/eess-md`.
- [ ] `npm run validate` green.

Deferred: none
